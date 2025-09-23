import { useCallback, useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { SavePayload } from "../../../core/types";
import type { ValidationMode } from "../utils/types";
import { AutosaveManager } from "../../../core/autosave";
import { ValidationCache } from "../../../cache/validationCache";
import { MetricsCollector } from "../../../metrics/collector";
import { stableStringify } from "../utils/diff";
import { createLogger, type Logger } from "../../../utils/logger";
import {
  createValidationStrategy,
  type ValidationStrategy,
} from "../../../strategies/validation";

interface DebouncedSaveHookParams<T extends FieldValues> {
  form: FormSubset<T>;
  manager: AutosaveManager;
  validationCache: ValidationCache;
  metrics: MetricsCollector;
  logger: Logger;
  validateBeforeSave: ValidationMode;
  equalsBaseline: (vals: any) => boolean;
  getEffectiveDirtyFields: (dirty: any) => any;
  selectPayload: (values: T, dirtyFields: any) => Partial<T>;
  config: { debounceMs?: number };
  // Refs from other hooks
  debounceTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  pendingPayloadRef: { current: SavePayload };
  lastQueuedSigRef: { current: string };
  historyPendingRef: { current: boolean };
  noPendingGuardRef: { current: boolean };
  baselineRef: { current: Record<string, any> | null };
  lastOpRef: { current: string | null };
  // Setters
  setDebounceTimeout: (timeoutId: ReturnType<typeof setTimeout>) => void;
  clearDebounceTimeout: () => void;
  setPendingPayload: (payload: SavePayload) => void;
  clearPendingPayload: () => void;
  setLastQueuedSig: (sig: string) => void;
  setHistoryPending: (pending: boolean) => void;
  setNoPendingGuard: (guard: boolean) => void;
  updateLastSavedState?: (values: any) => void; // NEW: Add this parameter
}

export function useDebouncedSave<T extends FieldValues>({
  form,
  manager,
  validationCache,
  metrics,
  logger,
  validateBeforeSave,
  equalsBaseline,
  getEffectiveDirtyFields,
  selectPayload,
  config,
  debounceTimeoutRef,
  pendingPayloadRef,
  lastQueuedSigRef,
  historyPendingRef,
  noPendingGuardRef,
  baselineRef,
  lastOpRef,
  setDebounceTimeout,
  clearDebounceTimeout,
  setPendingPayload,
  clearPendingPayload,
  setLastQueuedSig,
  setHistoryPending,
  setNoPendingGuard,
  updateLastSavedState, // NEW: Accept this parameter
}: DebouncedSaveHookParams<T>) {
  const validationStrategy = useMemo(
    () => createValidationStrategy<T>(validateBeforeSave),
    [validateBeforeSave]
  );

  const debouncedSave = useCallback(
    (valuesArg: T, dirtyFieldsArg: any, forceAfterUndo = false) => {
      clearDebounceTimeout();

      const timeoutId = setTimeout(async () => {
        try {
          // Build the payload right here, not earlier
          let payloadToSave: SavePayload;

          if (
            forceAfterUndo &&
            (lastOpRef.current === "undo" || lastOpRef.current === "redo")
          ) {
            payloadToSave = {};
            if (baselineRef.current) {
              for (const key of Object.keys(valuesArg)) {
                if (
                  !deepEqual((valuesArg as any)[key], baselineRef.current[key])
                ) {
                  (payloadToSave as any)[key] = (valuesArg as any)[key];
                }
              }
            }
            logger.debug(
              "Building payload after undo/redo by comparing with baseline",
              {
                changedFields: Object.keys(payloadToSave),
              }
            );
          } else {
            const effectiveDirty = getEffectiveDirtyFields(dirtyFieldsArg);
            payloadToSave = selectPayload(
              valuesArg,
              effectiveDirty
            ) as SavePayload;
          }

          logger.debug("Built payload for save", {
            payloadKeys: Object.keys(payloadToSave),
            payloadToSave,
            isUndoRedo: forceAfterUndo,
            lastOp: lastOpRef.current,
          });

          // Check if we have anything to save
          if (Object.keys(payloadToSave).length === 0) {
            logger.debug("Skipping save - empty payload");
            clearPendingPayload();
            const snap = form.getValues();
            if (equalsBaseline(snap)) {
              setHistoryPending(false);
              setNoPendingGuard(true);
              // Update last saved state since we're in sync
              if (updateLastSavedState) {
                updateLastSavedState(snap);
              }
            }
            return;
          }

          // Validation check
          if (validateBeforeSave !== "none") {
            const sig = stableStringify(payloadToSave as any);
            let validationResult = validationCache.get(sig);
            if (validationResult === undefined) {
              validationResult = await validationStrategy.validate(
                form,
                payloadToSave
              );
              validationCache.set(sig, validationResult);
              metrics.recordCacheMiss();
            } else {
              metrics.recordCacheHit();
            }
            if (!validationResult) {
              logger.debug("Skipping save - validation failed");
              clearPendingPayload();
              const snap = form.getValues();
              if (equalsBaseline(snap)) {
                setHistoryPending(false);
                setNoPendingGuard(true);
              }
              return;
            }
          }

          // Check for duplicate payload
          const sig = stableStringify(payloadToSave as any);
          if (sig === lastQueuedSigRef.current) {
            logger.debug("Skipping save - duplicate payload");
            clearPendingPayload();
            const snap = form.getValues();
            if (equalsBaseline(snap)) {
              setHistoryPending(false);
              setNoPendingGuard(true);
              // Update last saved state since we're in sync
              if (updateLastSavedState) {
                updateLastSavedState(snap);
              }
            }
            return;
          }
          setLastQueuedSig(sig);

          logger.debug("Sending payload to transport", {
            payloadKeys: Object.keys(payloadToSave),
            isUndoRedo: forceAfterUndo,
            lastOp: lastOpRef.current,
          });

          // Queue and flush immediately
          manager.queueChange(payloadToSave);
          const result = await manager.flush();

          clearPendingPayload();
          setHistoryPending(false);

          // Update last saved state on successful save
          if (result.ok && updateLastSavedState) {
            const currentValues = form.getValues();
            updateLastSavedState(currentValues);
          }

          const snapAfter = form.getValues();
          if (equalsBaseline(snapAfter)) {
            setNoPendingGuard(true);
          }

          if (result.ok && forceAfterUndo) {
            lastOpRef.current = null;
          }
        } catch (error) {
          logger.error("Error in debounced save");
          clearPendingPayload();
          setHistoryPending(false);
        }
      }, config.debounceMs || 600);

      setDebounceTimeout(timeoutId);
    },
    [
      clearDebounceTimeout,
      lastOpRef,
      baselineRef,
      logger,
      getEffectiveDirtyFields,
      selectPayload,
      form,
      equalsBaseline,
      setHistoryPending,
      setNoPendingGuard,
      clearPendingPayload,
      validateBeforeSave,
      validationCache,
      validationStrategy,
      metrics,
      setLastQueuedSig,
      lastQueuedSigRef,
      manager,
      config.debounceMs,
      setDebounceTimeout,
      updateLastSavedState, // Include in dependencies
    ]
  );

  const forceSave = useCallback(async () => {
    logger.debug("Force save requested");
    clearDebounceTimeout();

    const currentValues = form.getValues() as any;
    let currentPayload: SavePayload = {};

    if (baselineRef.current) {
      for (const key of Object.keys(currentValues)) {
        if (!deepEqual(currentValues[key], baselineRef.current[key])) {
          (currentPayload as any)[key] = currentValues[key];
        }
      }
    }

    if (Object.keys(currentPayload).length > 0) {
      manager.queueChange(currentPayload);
      clearPendingPayload();
      const res = await manager.flush();
      setHistoryPending(false);

      // Update last saved state on successful save
      if (res.ok && updateLastSavedState) {
        updateLastSavedState(currentValues);
      }

      return res;
    }
    return { ok: true } as const;
  }, [
    logger,
    clearDebounceTimeout,
    form,
    baselineRef,
    manager,
    clearPendingPayload,
    setHistoryPending,
    updateLastSavedState,
  ]);

  return {
    debouncedSave,
    forceSave,
  };
}

// Helper function to avoid circular dependency
function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (
    a !== null &&
    typeof a === "object" &&
    b !== null &&
    typeof b === "object"
  ) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!deepEqual(a[k], (b as any)[k])) return false;
    }
    return true;
  }
  return false;
}
