import { useCallback, useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { SavePayload } from "../../../core/types";
import type { ValidationMode } from "../utils/types";
import { AutosaveManager } from "../../../core/autosave";
import { ValidationCache } from "../../../cache/validationCache";
import { MetricsCollector } from "../../../metrics/collector";
import { stableStringify, deepEqual } from "../utils/diff";
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
  shouldSave?: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
    dirtyFields: any;
  }) => boolean;
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
  shouldSave,
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
            // After undo/redo, we need to sync the server with the current form state
            // Build payload by comparing with baseline (last saved state)
            payloadToSave = {};

            if (baselineRef.current) {
              // Compare current values with baseline to find what changed
              for (const key of Object.keys(valuesArg)) {
                if (
                  !deepEqual((valuesArg as any)[key], baselineRef.current[key])
                ) {
                  (payloadToSave as any)[key] = (valuesArg as any)[key];
                }
              }
            } else {
              // No baseline yet - send all current values
              payloadToSave = valuesArg as SavePayload;
            }

            logger.debug(
              "Building payload after undo/redo by comparing with baseline",
              {
                hasBaseline: !!baselineRef.current,
                changedFields: Object.keys(payloadToSave),
                payloadToSave,
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

    // Cancel any pending debounce
    clearDebounceTimeout();

    // Clear pending payload tracking
    clearPendingPayload();

    // Get current form values
    const currentValues = form.getValues() as T;

    // Check if we already match the baseline (nothing to save)
    if (equalsBaseline(currentValues)) {
      logger.debug("Force save - already in sync with baseline");
      setHistoryPending(false);
      setNoPendingGuard(true);
      return { ok: true } as const;
    }

    // Build payload of what changed
    let payloadToSave: SavePayload = {};

    if (baselineRef.current) {
      // Compare with baseline to find changes
      for (const key of Object.keys(currentValues)) {
        if (!deepEqual((currentValues as any)[key], baselineRef.current[key])) {
          (payloadToSave as any)[key] = (currentValues as any)[key];
        }
      }
    } else {
      // No baseline yet, save everything
      payloadToSave = currentValues as SavePayload;
    }

    // Check if we have anything to save
    if (Object.keys(payloadToSave).length === 0) {
      logger.debug("Force save - no changes detected");
      setHistoryPending(false);
      setNoPendingGuard(true);
      return { ok: true } as const;
    }

    // Check shouldSave before proceeding
    if (shouldSave) {
      const { isValid, isDirty, dirtyFields } = form.formState;
      const shouldProceed = shouldSave({
        values: currentValues,
        isValid,
        isDirty,
        dirtyFields,
      });

      if (!shouldProceed) {
        logger.debug("Force save blocked - shouldSave returned false", {
          isValid,
          isDirty,
          dirtyFieldsCount: Object.keys(dirtyFields).length,
        });
        return { ok: false, error: "Save blocked by shouldSave" } as const;
      }
    }

    logger.debug("Force save executing", {
      payloadKeys: Object.keys(payloadToSave),
      payload: payloadToSave,
    });

    // Queue and flush immediately
    manager.queueChange(payloadToSave);
    const result = await manager.flush();

    // Update state after save
    setHistoryPending(false);

    if (result.ok) {
      // Update last saved state on successful save
      if (updateLastSavedState) {
        updateLastSavedState(currentValues);
      }
      setNoPendingGuard(true);
    }

    return result;
  }, [
    logger,
    clearDebounceTimeout,
    clearPendingPayload,
    form,
    equalsBaseline,
    baselineRef,
    manager,
    setHistoryPending,
    setNoPendingGuard,
    updateLastSavedState,
    shouldSave,
  ]);

  return {
    debouncedSave,
    forceSave,
  };
}
