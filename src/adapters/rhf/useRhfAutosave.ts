"use client";

import { useEffect, useReducer, useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";

import { AutosaveManager } from "../../core/autosave";
import { autosaveReducer, initialAutosaveState } from "../../state/reducer";
import type { Transport, SavePayload } from "../../core/types";
import {
  createValidationStrategy,
  type ValidationMode,
} from "../../strategies/validation";
import { ValidationCache } from "../../cache/validationCache";
import { PayloadCache } from "../../cache/payloadCache";
import { MetricsCollector } from "../../metrics/collector";
import { createLogger } from "../../utils/logger";
import type { AutosaveConfig } from "../../config/schema";

// Import our modular hooks and utilities
import type {
  RhfAutosaveOptions,
  AutosaveReturn,
  DiffHandler,
  UndoOptions,
} from "./utils/types";
import {
  createDefaultSelectPayload,
  createDefaultShouldSave,
  createEffectiveDirtyFieldsGetter,
} from "./utils/transforms";
import { createComposedTransport } from "./utils/composeTransport";
import { useBaseline } from "./hooks/useBaseline";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { usePendingState } from "./hooks/usePendingState";
import { useDebouncedSave } from "./hooks/useDebouncedSave";
import { useAutosaveEffects } from "./hooks/useAutosaveEffects";

export function useRhfAutosave<T extends FieldValues>(
  options: RhfAutosaveOptions<T>
): AutosaveReturn {
  const {
    form,
    transport: baseTransport,
    config = {},
    selectPayload: userSelectPayload,
    shouldSave: userShouldSave,
    onSaved,
    keyMap,
    mapPayload,
    validateBeforeSave = "payload",
    diffMap,
    debug,
    undo,
    autoHydrate = true,
  } = options;

  const undoEnabled = !!undo?.enabled;
  const ignoreHistoryOps = undo?.ignoreHistoryOps ?? false;

  // Initialize state and caches
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosaveState);
  const validationCache = useMemo(() => new ValidationCache(), []);
  const payloadCache = useMemo(() => new PayloadCache(), []);
  const metrics = useMemo(() => new MetricsCollector(), []);
  const logger = useMemo(() => createLogger("rhf", debug), [debug]);

  // Get form state
  const values = form.watch();
  const { isDirty, isValid, dirtyFields, isValidating } = form.formState;

  // Initialize baseline management
  const baseline = useBaseline(form, diffMap, undoEnabled, debug);

  // Initialize autosave manager FIRST (with dummy transport, will be updated)
  const manager = useMemo(
    () =>
      new AutosaveManager(
        async () => ({ ok: true }), // Temporary transport
        config.debounceMs || 600,
        logger
      ),
    [config.debounceMs, logger]
  );

  // NOW initialize pending state with the actual manager
  const pendingState = usePendingState(
    form,
    manager,
    baseline.equalsBaseline,
    ignoreHistoryOps,
    debug
  );

  // Initialize effective dirty fields getter
  const getEffectiveDirtyFields = useMemo(
    () =>
      createEffectiveDirtyFieldsGetter(
        undoEnabled,
        { current: null },
        { current: new Set() }
      ),
    [undoEnabled]
  );

  // Create payload selector
  const selectPayload = useMemo(() => {
    if (userSelectPayload) return userSelectPayload;
    return createDefaultSelectPayload<T>(
      getEffectiveDirtyFields,
      diffMap,
      baseline.baselineRef,
      { current: null } // Will be connected to undo hook
    );
  }, [
    userSelectPayload,
    getEffectiveDirtyFields,
    diffMap,
    baseline.baselineRef,
  ]);

  // Create shouldSave function
  const shouldSave = useMemo(() => {
    if (userShouldSave) return userShouldSave;
    return createDefaultShouldSave<T>(
      getEffectiveDirtyFields,
      baseline.baselineRef,
      { current: null } // Will be connected to undo hook
    );
  }, [userShouldSave, getEffectiveDirtyFields, baseline.baselineRef]);

  // Create composed transport with updateLastSavedState
  const composedTransport = useMemo(
    () =>
      createComposedTransport({
        baseTransport,
        diffMap,
        keyMap,
        mapPayload,
        updateBaseline: baseline.updateBaseline,
        undoEnabled,
        onSaved,
        metrics,
        logger,
        baselineRef: baseline.baselineRef,
        dispatch,
        form,
        updateLastSavedState: pendingState.updateLastSavedState,
      }),
    [
      baseTransport,
      diffMap,
      keyMap,
      mapPayload,
      baseline.updateBaseline,
      undoEnabled,
      onSaved,
      metrics,
      logger,
      baseline.baselineRef,
      form,
      pendingState.updateLastSavedState,
      dispatch,
    ]
  );

  // Update manager's transport to use the composed one
  useEffect(() => {
    (manager as any).transport = composedTransport;
  }, [manager, composedTransport]);

  // Initialize debounced save
  const debouncedSaveHook = useDebouncedSave({
    form,
    manager,
    validationCache,
    metrics,
    logger,
    validateBeforeSave,
    equalsBaseline: baseline.equalsBaseline,
    getEffectiveDirtyFields,
    selectPayload,
    config,
    ...pendingState,
    baselineRef: baseline.baselineRef,
    lastOpRef: { current: null }, // Will be connected to undo hook
  });

  // Initialize undo/redo (this needs to be after debouncedSave)
  const undoRedo = useUndoRedo(
    form,
    undo,
    ignoreHistoryOps,
    baseline.equalsBaseline,
    debouncedSaveHook.debouncedSave,
    shouldSave,
    debug,
    {
      updateBaseline: baseline.initializeBaseline,
      updateLastSavedState: pendingState.updateLastSavedState,
    }
  );

  // Now connect the lastOpRef to the selectPayload and shouldSave
  const finalSelectPayload = useMemo(() => {
    if (userSelectPayload) return userSelectPayload;
    return createDefaultSelectPayload<T>(
      getEffectiveDirtyFields,
      diffMap,
      baseline.baselineRef,
      undoRedo.lastOpRef
    );
  }, [
    userSelectPayload,
    getEffectiveDirtyFields,
    diffMap,
    baseline.baselineRef,
    undoRedo.lastOpRef,
  ]);

  const finalShouldSave = useMemo(() => {
    if (userShouldSave) return userShouldSave;
    return createDefaultShouldSave<T>(
      getEffectiveDirtyFields,
      baseline.baselineRef,
      undoRedo.lastOpRef
    );
  }, [
    userShouldSave,
    getEffectiveDirtyFields,
    baseline.baselineRef,
    undoRedo.lastOpRef,
  ]);

  // Initialize autosave effects
  useAutosaveEffects({
    form,
    values,
    isDirty,
    isValidating,
    dirtyFields,
    diffMap,
    logger,
    undoEnabled,
    ignoreHistoryOps,
    validationCache,
    debouncedSave: debouncedSaveHook.debouncedSave,
    isHydratingRef: undoRedo.isHydratingRef,
    isBaselineInitializedRef: baseline.isBaselineInitializedRef,
    lastOpRef: undoRedo.lastOpRef,
    undoAffectedFieldsRef: undoRedo.undoAffectedFieldsRef,
    historyPendingRef: undoRedo.historyPendingRef,
    initializeBaseline: baseline.initializeBaseline,
    resetBaseline: baseline.resetBaseline,
    setHistoryPending: pendingState.setHistoryPending,
    clearPendingPayload: pendingState.clearPendingPayload,
    setLastQueuedSig: pendingState.setLastQueuedSig,
    setNoPendingGuard: pendingState.setNoPendingGuard,
    updateLastSavedState: pendingState.updateLastSavedState, // ADD THIS
    autoHydrate,
    lastRecordedValuesSigRef: undoRedo.lastRecordedValuesSigRef,
    handleHydration: undoRedo.handleHydration,
    undoMgrRef: undoRedo.undoMgrRef,
  });

  // Cleanup effect
  useEffect(() => {
    return () => {
      pendingState.clearDebounceTimeout();
      manager.abort();
    };
  }, [manager, pendingState]);

  // Return the complete API
  return {
    // Status
    isSaving: state.isSaving,
    lastError: state.lastError,
    metrics: state.metrics,

    // Pending - Now using the accurate computation
    hasPendingChanges: pendingState.computeHasPendingChanges(),

    // Actions
    flush: pendingState.flush,
    abort: pendingState.abort,
    forceSave: debouncedSaveHook.forceSave,

    // Baseline (diffMap) helpers
    forceBaselineUpdate: baseline.forceBaselineUpdate,
    getBaseline: baseline.getBaseline,
    isBaselineInitialized: baseline.isBaselineInitialized,

    // Metrics / debug
    getMetrics: useCallback(() => metrics.getMetrics(), [metrics]),
    getCacheStats: useCallback(
      () => ({
        validationCacheSize: validationCache.size(),
        payloadCacheSize: payloadCache.size(),
      }),
      [validationCache, payloadCache]
    ),
    getPendingChanges: pendingState.getPendingChanges,
    isEmpty: pendingState.isEmpty,

    // Undo/redo
    undo: undoRedo.undoAPI.undo,
    redo: undoRedo.undoAPI.redo,
    undoLastSave: undoRedo.undoAPI.undoLastSave,
    canUndo: undoRedo.undoAPI.canUndo,
    canRedo: undoRedo.undoAPI.canRedo,

    // Hydrate safely from server
    hydrateFromServer: undoRedo.hydrateFromServer,
  } as const;
}

// Re-export types for convenience
export type {
  RhfAutosaveOptions,
  DiffHandler,
  UndoOptions,
  AutosaveReturn,
} from "./utils/types";
