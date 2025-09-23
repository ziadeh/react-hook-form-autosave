import { useRef, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { SavePayload } from "../../../core/types";
import type { PendingState } from "../utils/types";
import { AutosaveManager } from "../../../core/autosave";

export function usePendingState<T extends FieldValues>(
  form: FormSubset<T>,
  manager: AutosaveManager,
  equalsBaseline: (vals: any) => boolean,
  ignoreHistoryOps: boolean
) {
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueuedSigRef = useRef<string>("");
  const pendingPayloadRef = useRef<SavePayload>({});
  const historyPendingRef = useRef(false);
  const noPendingGuardRef = useRef(false);

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

  const computeHasPendingChanges = useCallback(() => {
    // Debug logging to understand what's happening
    const debugInfo = {
      noPendingGuard: noPendingGuardRef.current,
      pendingPayloadKeys: Object.keys(pendingPayloadRef.current),
      managerEmpty: manager.isEmpty(),
      historyPending: historyPendingRef.current,
      ignoreHistoryOps,
    };

    // If we explicitly set no pending guard, respect it only briefly
    if (noPendingGuardRef.current) {
      // Auto-clear the guard after a short delay to prevent it from sticking
      setTimeout(() => {
        noPendingGuardRef.current = false;
      }, 100);
      console.debug("[hasPendingChanges] No pending guard active", debugInfo);
      return false;
    }

    // Check if we have pending payload in React layer
    const reactPending = Object.keys(pendingPayloadRef.current).length > 0;
    if (reactPending) {
      console.debug(
        "[hasPendingChanges] React pending payload exists",
        debugInfo
      );
      return true;
    }

    // Check if manager has pending changes
    const managerPending = !manager.isEmpty();
    if (managerPending) {
      console.debug(
        "[hasPendingChanges] Manager has pending changes",
        debugInfo
      );
      return true;
    }

    // Check history operations if not ignoring them
    if (!ignoreHistoryOps && historyPendingRef.current) {
      console.debug("[hasPendingChanges] History operation pending", debugInfo);
      return true;
    }

    // Final check: compare current values with baseline
    try {
      const currentValues = form.getValues();
      const baselineEqual = equalsBaseline(currentValues);
      console.debug("[hasPendingChanges] Baseline comparison", {
        ...debugInfo,
        baselineEqual,
        currentValues: Object.keys(currentValues),
      });
      return !baselineEqual;
    } catch (error) {
      console.error("[hasPendingChanges] Error comparing with baseline", error);
      return false;
    }
  }, [manager, ignoreHistoryOps, form, equalsBaseline]);

  const getPendingChanges = useCallback(() => {
    const reactPending = pendingPayloadRef.current;
    const managerPending = manager.getPendingChanges();
    return { ...reactPending, ...managerPending };
  }, [manager]);

  const isEmpty = useCallback(() => {
    const reactPendingEmpty =
      Object.keys(pendingPayloadRef.current).length === 0;
    const managerEmpty = manager.isEmpty();
    return reactPendingEmpty && managerEmpty;
  }, [manager]);

  const flush = useCallback(async () => {
    clearDebounceTimeout();
    if (Object.keys(pendingPayloadRef.current).length > 0) {
      manager.queueChange(pendingPayloadRef.current);
      pendingPayloadRef.current = {};
    }
    return manager.flush();
  }, [manager, clearDebounceTimeout]);

  const abort = useCallback(() => {
    clearDebounceTimeout();
    pendingPayloadRef.current = {};
    historyPendingRef.current = false;
    const snap = form.getValues();
    if (equalsBaseline(snap)) noPendingGuardRef.current = true;
    manager.abort();
  }, [manager, clearDebounceTimeout, form, equalsBaseline]);

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

    // Computed values
    computeHasPendingChanges,
    getPendingChanges,
    isEmpty,

    // Actions
    flush,
    abort,
  };
}
