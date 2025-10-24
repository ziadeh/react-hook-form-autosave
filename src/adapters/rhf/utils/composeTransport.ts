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
      const failedDiffMapFields: string[] = [];
      let diffMapErrors: Error[] = [];

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

          // Execute diff operations and handle errors properly
          let hasErrors = false;

          // Handle additions
          for (const item of added) {
            try {
              await Promise.resolve(handler.onAdd(item));
              logger?.debug(
                `Successfully added item to ${key}:`,
                handler.idOf(item)
              );
            } catch (error) {
              hasErrors = true;
              const err =
                error instanceof Error ? error : new Error(String(error));
              diffMapErrors.push(
                new Error(
                  `Failed to add ${handler.idOf(item)} to ${key}: ${
                    err.message
                  }`
                )
              );
              logger?.error(`Failed to add item to ${key}:`, err, {
                item: handler.idOf(item),
              });
            }
          }

          // Handle removals
          for (const item of removed) {
            try {
              await Promise.resolve(handler.onRemove(item));
              logger?.debug(
                `Successfully removed item from ${key}:`,
                handler.idOf(item)
              );
            } catch (error) {
              hasErrors = true;
              const err =
                error instanceof Error ? error : new Error(String(error));
              diffMapErrors.push(
                new Error(
                  `Failed to remove ${handler.idOf(item)} from ${key}: ${
                    err.message
                  }`
                )
              );
              logger?.error(`Failed to remove item from ${key}:`, err, {
                item: handler.idOf(item),
              });
            }
          }

          // Only mark as processed if no errors occurred
          if (hasErrors) {
            failedDiffMapFields.push(key);
            // Keep the field in remainingPayload so the main transport can see it
            logger?.warn(
              `DiffMap operations failed for field ${key}, keeping in payload`
            );
          } else {
            processedDiffMapFields.push(key);
            delete (remainingPayload as any)[key];
            logger?.debug(
              `DiffMap operations succeeded for field ${key}, removed from payload`
            );
          }
        }
      }

      // If we have diffMap errors and no main payload to save, fail immediately
      if (
        diffMapErrors.length > 0 &&
        Object.keys(remainingPayload).length === 0
      ) {
        const combinedError = new Error(
          `DiffMap operations failed: ${diffMapErrors
            .map((e) => e.message)
            .join("; ")}`
        );

        const duration = performance.now() - start;
        dispatch?.({ type: "SAVE_ERROR", error: combinedError, duration });
        metrics?.recordSave(duration, false);

        const failureResult = { ok: false, error: combinedError } as SaveResult;
        onSaved?.(failureResult, payload);
        return failureResult;
      }

      // Key transforms and mapping
      let finalPayload = remainingPayload;
      if (keyMap)
        finalPayload = mapKeys(finalPayload as any, keyMap) as SavePayload;
      if (mapPayload)
        finalPayload = mapPayload(finalPayload as any) as SavePayload;
      finalPayload = datesToIso(finalPayload);

      // Execute main transport if there's a payload
      let result: SaveResult;
      if (Object.keys(finalPayload).length > 0) {
        result = await baseTransport(finalPayload, ctx);

        // If main transport failed, but we had successful diffMap operations,
        // we need to decide how to handle this. For now, treat as overall failure.
        if (!result.ok && processedDiffMapFields.length > 0) {
          logger?.warn(
            "Main transport failed but diffMap operations succeeded",
            {
              failedMainFields: Object.keys(finalPayload),
              succeededDiffMapFields: processedDiffMapFields,
            }
          );
        }
      } else {
        // No main payload, only diffMap operations
        // Success depends on whether diffMap operations succeeded
        if (diffMapErrors.length > 0) {
          const combinedError = new Error(
            `DiffMap operations failed: ${diffMapErrors
              .map((e) => e.message)
              .join("; ")}`
          );
          result = { ok: false, error: combinedError } as SaveResult;
        } else {
          result = { ok: true } as SaveResult;
        }
      }

      // If main transport succeeded but we had diffMap errors, treat as partial failure
      if (result.ok && diffMapErrors.length > 0) {
        const combinedError = new Error(
          `Partial save failure - DiffMap operations failed: ${diffMapErrors
            .map((e) => e.message)
            .join("; ")}`
        );
        result = { ok: false, error: combinedError } as SaveResult;
        logger?.warn("Main transport succeeded but diffMap operations failed", {
          succeededMainFields: Object.keys(finalPayload),
          failedDiffMapFields,
          errors: diffMapErrors.map((e) => e.message),
        });
      }

      const duration = performance.now() - start;

      if (result.ok) {
        dispatch?.({ type: "SAVE_SUCCESS", duration });

        // Update baseline only with successfully saved data
        const successfulPayload = { ...payload };
        // Remove failed diffMap fields from baseline update
        failedDiffMapFields.forEach((field) => {
          delete (successfulPayload as any)[field];
        });

        updateBaseline?.(successfulPayload);
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

          // Reset form to clear dirty state for successfully saved fields only
          // For failed diffMap fields, keep them dirty so user knows they need attention
          const resetOptions = {
            keepValues: true,
            keepDirty: failedDiffMapFields.length > 0, // Keep dirty if we have failures
            keepDirtyValues: false,
            keepTouched: true,
            keepErrors: false,
            keepIsSubmitted: true,
            keepSubmitCount: true,
          };

          form.reset(currentValues, resetOptions);

          // If we had failed diffMap fields, manually mark them as dirty
          if (failedDiffMapFields.length > 0) {
            failedDiffMapFields.forEach((field) => {
              try {
                form.setValue(field, form.getValues(field), {
                  shouldDirty: true,
                });
              } catch (e) {
                logger?.warn(
                  `Could not mark failed field ${field} as dirty`,
                  e
                );
              }
            });
          }

          logger?.debug("Reset form after save", {
            regularFields: Object.keys(finalPayload),
            succeededDiffMapFields: processedDiffMapFields,
            failedDiffMapFields,
            resetOptions,
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
      const failureResult = { ok: false, error: err };
      onSaved?.(failureResult, payload);
      return failureResult;
    }
  };
}
