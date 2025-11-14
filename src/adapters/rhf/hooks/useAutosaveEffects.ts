import { useEffect, useRef } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { DiffHandler } from "../utils/types";
import { ValidationCache } from "../../../cache/validationCache";
import { createLogger, type Logger } from "../../../utils/logger";
import { stableStringify } from "../utils/diff";

interface AutosaveEffectsParams<T extends FieldValues> {
  form: FormSubset<T>;
  values: T;
  isDirty: boolean;
  isValidating: boolean;
  dirtyFields: any;
  diffMap?: Record<string, DiffHandler>;
  logger: Logger;
  undoEnabled: boolean;
  ignoreHistoryOps: boolean;
  validationCache: ValidationCache;
  debouncedSave: (values: T, dirtyFields: any, forceAfterUndo: boolean) => void;
  shouldSave?: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
    dirtyFields: any;
  }) => boolean;
  autoHydrate?: boolean;
  // State refs
  isHydratingRef: { current: boolean };
  isBaselineInitializedRef: { current: boolean };
  lastOpRef: { current: string | null };
  undoAffectedFieldsRef: { current: Set<string> };
  historyPendingRef: { current: boolean };
  lastRecordedValuesSigRef: { current: string };
  // Actions
  initializeBaseline: (values: Record<string, any>) => void;
  resetBaseline: () => void;
  setHistoryPending: (pending: boolean) => void;
  clearPendingPayload: () => void;
  setLastQueuedSig: (sig: string) => void;
  setNoPendingGuard: (guard: boolean) => void;
  updateLastSavedState?: (values: any) => void;
  isEmpty: () => boolean; // Check if manager queue is empty
  // Hydration action
  handleHydration: (data: T) => void;
  // Undo manager ref
  undoMgrRef: { current: any };
}

export function useAutosaveEffects<T extends FieldValues>({
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
  debouncedSave,
  shouldSave,
  autoHydrate = true,
  isHydratingRef,
  isBaselineInitializedRef,
  lastOpRef,
  undoAffectedFieldsRef,
  historyPendingRef,
  lastRecordedValuesSigRef,
  initializeBaseline,
  resetBaseline,
  setHistoryPending,
  clearPendingPayload,
  setLastQueuedSig,
  setNoPendingGuard,
  updateLastSavedState,
  isEmpty,
  handleHydration,
  undoMgrRef,
}: AutosaveEffectsParams<T>) {
  // Track previous state to detect hydration
  const prevIsDirtyRef = useRef(isDirty);
  const prevValuesRef = useRef(values);
  const isInitialMountRef = useRef(true);

  // Auto-hydration effect - detects when form gets reset with new data
  useEffect(() => {
    if (!autoHydrate) return;

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevIsDirtyRef.current = isDirty;
      prevValuesRef.current = values;
      return;
    }

    const wasDirty = prevIsDirtyRef.current;
    const isNowClean = !isDirty;
    const valuesChanged =
      stableStringify(values as any) !==
      stableStringify(prevValuesRef.current as any);
    const hasNoErrors = Object.keys(form.formState.errors || {}).length === 0;

    // Detect hydration scenario:
    // 1. Form went from dirty to clean (or was already clean)
    // 2. Values actually changed
    // 3. No validation errors (indicates successful data load)
    // 4. Not currently hydrating (prevent loops)
    // 5. No pending saves in progress (prevent data loss)
    const queueIsEmpty = isEmpty();
    if (isNowClean && valuesChanged && hasNoErrors && !isHydratingRef.current && queueIsEmpty) {
      logger.debug("Auto-detecting form hydration", {
        wasDirty,
        isNowClean,
        valuesChanged,
        queueIsEmpty,
        newValues: values,
      });

      // Handle hydration
      handleHydration(values);

      // CRITICAL: Update baseline with hydrated values
      initializeBaseline(values as any);
      isBaselineInitializedRef.current = true;

      // CRITICAL: Update last saved state with hydrated values
      if (updateLastSavedState) {
        updateLastSavedState(values);
      }

      // Clear any pending changes since we're now in sync with server
      clearPendingPayload();
      setLastQueuedSig("");
      setNoPendingGuard(true);
    }

    // Update previous state
    prevIsDirtyRef.current = isDirty;
    prevValuesRef.current = values;
  }, [
    autoHydrate,
    isDirty,
    values,
    form.formState.errors,
    isHydratingRef,
    isEmpty,
    logger,
    handleHydration,
    initializeBaseline,
    isBaselineInitializedRef,
    updateLastSavedState,
    clearPendingPayload,
    setLastQueuedSig,
    setNoPendingGuard,
  ]);

  // Initialize baseline once, from clean state (but skip if hydration handled it)
  useEffect(() => {
    if (!diffMap && !undoEnabled) return;

    if (
      !isDirty &&
      !isBaselineInitializedRef.current &&
      !isHydratingRef.current
    ) {
      const currentValues = form.getValues() as any;
      logger.debug(
        "Initializing baseline from clean form state",
        currentValues
      );
      initializeBaseline(currentValues);

      // Also update last saved state
      if (updateLastSavedState) {
        updateLastSavedState(currentValues);
      }
    }
  }, [
    isDirty,
    diffMap,
    undoEnabled,
    form,
    logger,
    initializeBaseline,
    isBaselineInitializedRef,
    isHydratingRef,
    updateLastSavedState,
  ]);

  // When form becomes clean (e.g., after reset), reset baseline
  useEffect(() => {
    if (!isDirty && Object.keys(dirtyFields).length === 0) {
      // Only reset if we're not hydrating (hydration handles its own baseline)
      if (!isHydratingRef.current) {
        // Don't reset baseline here - it should stay as the last saved state
        // isBaselineInitializedRef.current = false;
        // resetBaseline();
        undoAffectedFieldsRef.current.clear();
      }
    }
  }, [
    isDirty,
    dirtyFields,
    resetBaseline,
    isBaselineInitializedRef,
    undoAffectedFieldsRef,
    isHydratingRef,
  ]);

  // Clear undo affected fields after successful save
  useEffect(() => {
    if (lastOpRef.current === "undo" || lastOpRef.current === "redo") {
      setTimeout(() => {
        undoAffectedFieldsRef.current.clear();
        lastOpRef.current = null;
      }, 100);
    } else if (lastOpRef.current === null) {
      undoAffectedFieldsRef.current.clear();
    }
  }, [lastOpRef, undoAffectedFieldsRef]);

  // Main autosave effect
  useEffect(() => {
    if (isHydratingRef.current) {
      logger.debug("Skipping save - hydrating from server");
      return;
    }

    if (lastOpRef.current === "revert") {
      logger.debug("Skipping save - reverting failed changes");
      return;
    }

    if (isValidating) {
      logger.debug("Skipping save - form is validating");
      return;
    }

    if (diffMap && !isBaselineInitializedRef.current) {
      logger.debug("Skipping save - baseline not initialized yet");
      return;
    }

    const isUndoRedo =
      lastOpRef.current === "undo" || lastOpRef.current === "redo";
    const hasUserChanges = Object.keys(dirtyFields).length > 0 || isDirty;

    if (isUndoRedo && undoEnabled && !ignoreHistoryOps) {
      logger.debug("Triggering save after undo/redo operation", {
        affectedFields: Array.from(undoAffectedFieldsRef.current),
      });

      // make it pending before debounce enqueues anything
      setHistoryPending(true);

      setTimeout(() => {
        const currentValues = form.getValues();
        const currentDirtyFields = form.formState.dirtyFields;
        debouncedSave(currentValues as T, currentDirtyFields, true);
      }, 10);
      return;
    }

    if (!isUndoRedo && hasUserChanges) {
      // Check shouldSave before triggering autosave
      if (shouldSave) {
        const { isValid } = form.formState;
        const shouldProceed = shouldSave({
          values,
          isValid,
          isDirty,
          dirtyFields,
        });

        if (!shouldProceed) {
          logger.debug("Skipping save - shouldSave returned false", {
            dirtyFields: Object.keys(dirtyFields),
            isDirty,
            isValid,
          });
          return;
        }
      }

      logger.debug("Triggering save for user changes", {
        dirtyFields: Object.keys(dirtyFields),
        isDirty,
      });
      debouncedSave(values, dirtyFields, false);
    }
  }, [
    values,
    dirtyFields,
    isDirty,
    isValidating,
    debouncedSave,
    shouldSave,
    diffMap,
    logger,
    undoEnabled,
    ignoreHistoryOps,
    form,
    isHydratingRef,
    isBaselineInitializedRef,
    lastOpRef,
    undoAffectedFieldsRef,
    setHistoryPending,
  ]);

  // Clear caches when clean
  useEffect(() => {
    if (Object.keys(dirtyFields).length === 0 && !isDirty) {
      validationCache.clear();
      setLastQueuedSig("");
      // Don't clear pending payload here - let the save logic handle it
      undoAffectedFieldsRef.current.clear();
    }
  }, [
    dirtyFields,
    isDirty,
    validationCache,
    setLastQueuedSig,
    undoAffectedFieldsRef,
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup is handled by individual hooks that manage their own resources
    };
  }, []);
}
