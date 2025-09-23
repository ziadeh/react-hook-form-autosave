import { useRef, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { SavePayload } from "../../../core/types";
import type { PendingState } from "../utils/types";
import { AutosaveManager } from "../../../core/autosave";
import { createLogger } from "../../../utils/logger";

export function usePendingState<T extends FieldValues>(
  form: FormSubset<T>,
  manager: AutosaveManager,
  equalsBaseline: (vals: any) => boolean,
  ignoreHistoryOps: boolean,
  debug?: boolean
) {
  const logger = createLogger("pending-state", debug);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueuedSigRef = useRef<string>("");
  const pendingPayloadRef = useRef<SavePayload>({});
  const historyPendingRef = useRef(false);
  const noPendingGuardRef = useRef(false);
  const lastSavedStateRef = useRef<string>("");

  const clearDebounceTimeout = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const setPendingPayload = useCallback((payload: SavePayload) => {
    pendingPayloadRef.current = payload;
  }, []);

  const clearPendingPayload = useCallback(() => {
    pendingPayloadRef.current = {};
  }, []);

  const setHistoryPending = useCallback((pending: boolean) => {
    historyPendingRef.current = pending;
  }, []);

  const setNoPendingGuard = useCallback((guard: boolean) => {
    noPendingGuardRef.current = guard;
  }, []);

  const setLastQueuedSig = useCallback((sig: string) => {
    lastQueuedSigRef.current = sig;
  }, []);

  const setDebounceTimeout = useCallback(
    (timeoutId: ReturnType<typeof setTimeout>) => {
      debounceTimeoutRef.current = timeoutId;
    },
    []
  );

  const updateLastSavedState = useCallback(
    (values: any) => {
      const stableValues = JSON.stringify(
        Object.keys(values)
          .sort()
          .reduce((acc, key) => {
            acc[key] = values[key];
            return acc;
          }, {} as any)
      );
      lastSavedStateRef.current = stableValues;
      logger.debug("Updated last saved state", { stableValues });
    },
    [logger]
  );

  const computeHasPendingChanges = useCallback(() => {
    const debugInfo = {
      noPendingGuard: noPendingGuardRef.current,
      pendingPayloadKeys: Object.keys(pendingPayloadRef.current),
      managerEmpty: manager.isEmpty(),
      historyPending: historyPendingRef.current,
      ignoreHistoryOps,
      debounceActive: !!debounceTimeoutRef.current,
      isDirty: form.formState.isDirty,
      dirtyFieldsCount: Object.keys(form.formState.dirtyFields).length,
    };

    logger.debug("[hasPendingChanges] Checking state", debugInfo);

    // If we explicitly set no pending guard, respect it
    if (noPendingGuardRef.current) {
      // Auto-clear the guard after a short delay
      setTimeout(() => {
        noPendingGuardRef.current = false;
      }, 100);
      logger.debug("[hasPendingChanges] No pending guard active", debugInfo);
      return false;
    }

    // Check if there's an active debounce timer (save is scheduled but not executed)
    if (debounceTimeoutRef.current) {
      logger.debug(
        "[hasPendingChanges] Debounce timer active - changes pending",
        debugInfo
      );
      return true;
    }

    // Check if we have pending payload in React layer
    const reactPending = Object.keys(pendingPayloadRef.current).length > 0;
    if (reactPending) {
      logger.debug(
        "[hasPendingChanges] React pending payload exists",
        debugInfo
      );
      return true;
    }

    // Check if manager has pending changes
    const managerPending = !manager.isEmpty();
    if (managerPending) {
      logger.debug(
        "[hasPendingChanges] Manager has pending changes",
        debugInfo
      );
      return true;
    }

    // Check history operations if not ignoring them
    if (!ignoreHistoryOps && historyPendingRef.current) {
      logger.debug("[hasPendingChanges] History operation pending", debugInfo);
      return true;
    }

    // NEW: If form is dirty but we have a matching saved state, we're actually clean
    if (form.formState.isDirty && lastSavedStateRef.current) {
      try {
        const currentValues = form.getValues();
        const currentStableValues = JSON.stringify(
          Object.keys(currentValues)
            .sort()
            .reduce((acc, key) => {
              acc[key] = currentValues[key];
              return acc;
            }, {} as any)
        );

        if (currentStableValues === lastSavedStateRef.current) {
          logger.debug(
            "[hasPendingChanges] Current values match last saved state - no pending changes",
            {
              ...debugInfo,
              currentMatchesSaved: true,
            }
          );
          return false;
        }
      } catch (error) {
        logger.error("[hasPendingChanges] Error comparing saved state");
      }
    }

    // Check if form has dirty fields (standard RHF dirty tracking)
    const hasDirtyFields = Object.keys(form.formState.dirtyFields).length > 0;
    if (hasDirtyFields) {
      logger.debug("[hasPendingChanges] Form has dirty fields", {
        ...debugInfo,
        dirtyFields: Object.keys(form.formState.dirtyFields),
      });
      return true;
    }

    // Final check: compare current values with baseline
    try {
      const currentValues = form.getValues();
      const baselineEqual = equalsBaseline(currentValues);
      logger.debug("[hasPendingChanges] Baseline comparison", {
        ...debugInfo,
        baselineEqual,
      });
      return !baselineEqual;
    } catch (error) {
      logger.error("[hasPendingChanges] Error comparing with baseline");
      return false;
    }
  }, [manager, ignoreHistoryOps, form, equalsBaseline, logger]);

  const getPendingChanges = useCallback(() => {
    const reactPending = pendingPayloadRef.current;
    const managerPending = manager.getPendingChanges();
    return { ...reactPending, ...managerPending };
  }, [manager]);

  const isEmpty = useCallback(() => {
    const reactPendingEmpty =
      Object.keys(pendingPayloadRef.current).length === 0;
    const managerEmpty = manager.isEmpty();
    const debounceEmpty = !debounceTimeoutRef.current;
    return reactPendingEmpty && managerEmpty && debounceEmpty;
  }, [manager]);

  const flush = useCallback(async () => {
    clearDebounceTimeout();
    if (Object.keys(pendingPayloadRef.current).length > 0) {
      manager.queueChange(pendingPayloadRef.current);
      pendingPayloadRef.current = {};
    }
    const result = await manager.flush();

    // Update last saved state after successful flush
    if (result.ok) {
      const currentValues = form.getValues();
      updateLastSavedState(currentValues);
    }

    return result;
  }, [manager, clearDebounceTimeout, form, updateLastSavedState]);

  const abort = useCallback(() => {
    clearDebounceTimeout();
    pendingPayloadRef.current = {};
    historyPendingRef.current = false;
    const snap = form.getValues();
    if (equalsBaseline(snap)) {
      noPendingGuardRef.current = true;
      updateLastSavedState(snap);
    }
    manager.abort();
  }, [
    manager,
    clearDebounceTimeout,
    form,
    equalsBaseline,
    updateLastSavedState,
  ]);

  return {
    // Refs (for other hooks to access)
    debounceTimeoutRef,
    lastQueuedSigRef,
    pendingPayloadRef,
    historyPendingRef,
    noPendingGuardRef,

    // Setters
    clearDebounceTimeout,
    setPendingPayload,
    clearPendingPayload,
    setHistoryPending,
    setNoPendingGuard,
    setLastQueuedSig,
    setDebounceTimeout,
    updateLastSavedState,

    // Computed values
    computeHasPendingChanges,
    getPendingChanges,
    isEmpty,

    // Actions
    flush,
    abort,
  };
}
