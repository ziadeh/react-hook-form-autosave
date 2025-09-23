import type {
  Transport,
  SavePayload,
  SaveContext,
  SaveResult,
} from "../../../core/types";
import type { DiffHandler } from "./types";
import { mapKeys, type KeyMap } from "../../../utils/mapKeys";
import { datesToIso } from "./transforms";
import { deepEqual } from "./diff";
import { createLogger, type Logger } from "../../../utils/logger";

interface ComposeTransportParams {
  baseTransport: Transport;
  diffMap?: Record<string, DiffHandler>;
  keyMap?: KeyMap;
  mapPayload?: (payload: Record<string, any>) => Record<string, any>;
  updateBaseline?: (payload: SavePayload) => void;
  undoEnabled?: boolean;
  undoMgrRef?: { current: any };
  onSaved?: (result: any, payload: SavePayload) => void;
  metrics?: any;
  logger?: Logger;
  baselineRef?: { current: Record<string, any> | null };
  lastOpRef?: { current: string | null };
  undoAffectedFieldsRef?: { current: Set<string> };
  dispatch?: (action: any) => void;
  form?: any;
  updateLastSavedState?: (values: any) => void;
}

export function createComposedTransport({
  baseTransport,
  diffMap,
  keyMap,
  mapPayload,
  updateBaseline,
  undoEnabled,
  undoMgrRef,
  onSaved,
  metrics,
  logger,
  baselineRef,
  lastOpRef,
  undoAffectedFieldsRef,
  dispatch,
  form,
  updateLastSavedState,
}: ComposeTransportParams): Transport {
  return async (payload: SavePayload, ctx?: SaveContext) => {
    const start = performance.now();
    dispatch?.({ type: "SAVE_START" });

    try {
      let remainingPayload = { ...payload };
      const processedDiffMapFields: string[] = [];

      // diffMap handling (list add/remove via callbacks)
      if (diffMap && Object.keys(diffMap).length > 0) {
        for (const [key, handler] of Object.entries(diffMap)) {
          if (!(key in payload)) continue;

          const prev = baselineRef?.current?.[key] || [];
          const curr = (payload as any)[key] || [];

          if (!Array.isArray(prev) || !Array.isArray(curr)) continue;

          const prevIds = new Set(prev.map(handler.idOf));
          const currIds = new Set(curr.map(handler.idOf));

          const added = curr.filter((x: any) => !prevIds.has(handler.idOf(x)));
          const removed = prev.filter(
            (x: any) => !currIds.has(handler.idOf(x))
          );

          logger?.debug(`DiffMap for ${key}`, {
            baseline: prev.map(handler.idOf),
            current: curr.map(handler.idOf),
            added: added.map(handler.idOf),
            removed: removed.map(handler.idOf),
          });

          const ops: Array<() => Promise<void>> = [];
          for (const item of added)
            ops.push(() => Promise.resolve(handler.onAdd(item)));
          for (const item of removed)
            ops.push(() => Promise.resolve(handler.onRemove(item)));

          // Execute diff operations
          if (ops.length) {
            await Promise.all(ops.map((fn) => fn()));
          }

          // Track processed fields even if no operations were needed
          // (the field is still "saved" even if no changes)
          processedDiffMapFields.push(key);
          delete (remainingPayload as any)[key];
        }
      }

      // Key transforms and mapping
      let finalPayload = remainingPayload;
      if (keyMap)
        finalPayload = mapKeys(finalPayload as any, keyMap) as SavePayload;
      if (mapPayload)
        finalPayload = mapPayload(finalPayload as any) as SavePayload;
      finalPayload = datesToIso(finalPayload);

      // Determine if we only had diffMap operations
      const onlyDiffMapOperations =
        Object.keys(finalPayload).length === 0 &&
        processedDiffMapFields.length > 0;

      // Execute main transport if there's a payload
      let result: SaveResult;
      if (Object.keys(finalPayload).length > 0) {
        result = await baseTransport(finalPayload, ctx);
      } else {
        // No main payload, only diffMap operations succeeded
        result = { ok: true } as SaveResult;
      }

      const duration = performance.now() - start;

      if (result.ok) {
        dispatch?.({ type: "SAVE_SUCCESS", duration });

        // Update baseline with ALL saved data (including diffMap fields)
        updateBaseline?.(payload);
        metrics?.recordSave(duration, true);

        // Clear the current operation state
        if (lastOpRef) lastOpRef.current = null;
        if (undoAffectedFieldsRef) undoAffectedFieldsRef.current.clear();

        // Update last saved state and reset form dirty state
        if (form) {
          const currentValues = form.getValues();

          // Update last saved state BEFORE resetting form
          if (updateLastSavedState) {
            updateLastSavedState(currentValues);
          }

          // IMPORTANT: Reset form to clear dirty state for ALL saved fields
          // This includes both regular fields and diffMap array fields
          form.reset(currentValues, {
            keepValues: true,
            keepDirty: false, // Clear ALL dirty flags
            keepDirtyValues: false,
            keepTouched: true,
            keepErrors: false,
            keepIsSubmitted: true,
            keepSubmitCount: true,
          });

          logger?.debug("Reset form after successful save", {
            regularFields: Object.keys(finalPayload),
            diffMapFields: processedDiffMapFields,
            onlyDiffMapOperations,
          });
        }

        // Mark checkpoint for undo but keep history
        if (undoEnabled && undoMgrRef?.current) {
          undoMgrRef.current.markCheckpoint();
          logger?.debug("Marked checkpoint after successful save", {
            checkpointState: undoMgrRef.current.getState?.(),
          });
        }

        onSaved?.(result, payload);
      } else {
        dispatch?.({ type: "SAVE_ERROR", error: result.error, duration });
        metrics?.recordSave(duration, false);
        onSaved?.(result, payload);
      }

      return result;
    } catch (e) {
      const duration = performance.now() - start;
      const err = e instanceof Error ? e : new Error(String(e));
      dispatch?.({ type: "SAVE_ERROR", error: err, duration });
      metrics?.recordSave(duration, false);
      return { ok: false, error: err };
    }
  };
}
