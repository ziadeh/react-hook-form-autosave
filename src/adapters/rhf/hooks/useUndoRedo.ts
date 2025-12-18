import { useRef, useEffect, useMemo, useReducer, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type {
  UndoOptions,
  UndoOp,
  UndoRedoState,
  UndoRedoAPI,
  Patch,
} from "../utils/types";
import { InternalUndoManager } from "../managers/InternalUndoManager";
import {
  diffToPatches,
  stableStringify,
  isEditableElement,
  deepEqual,
} from "../utils/diff";
import { createLogger, type Logger } from "../../../utils/logger";

interface UndoRedoHookParams {
  updateBaseline?: (values: any) => void;
  updateLastSavedState?: (values: any) => void;
}

export function useUndoRedo<T extends FieldValues>(
  form: FormSubset<T>,
  undoOptions: UndoOptions | undefined,
  ignoreHistoryOps: boolean,
  equalsBaseline: (vals: any) => boolean,
  debouncedSave: (values: T, dirtyFields: any, forceAfterUndo: boolean) => void,
  shouldSave: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
    dirtyFields: any;
  }) => boolean,
  debug?: boolean,
  params?: UndoRedoHookParams // NEW: Add optional params for baseline/saved state updates
) {
  const logger = createLogger("undo-redo", debug);

  const undoEnabled = !!undoOptions?.enabled;
  const hotkeysEnabled = undoEnabled && (undoOptions?.hotkeys ?? true);
  const captureInInputs = undoOptions?.captureInInputs ?? false;
  const hotkeyTarget: Document | HTMLElement =
    undoOptions?.target ??
    (typeof document !== "undefined" ? document : (undefined as any));

  // Helper to deep clone values (needed because RHF watch() returns mutable reference)
  const cloneValues = useCallback((obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => cloneValues(item));
    if (typeof obj === 'object') {
      const clone: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clone[key] = cloneValues(obj[key]);
        }
      }
      return clone;
    }
    return obj;
  }, []);

  // State refs - clone initial values to avoid reference issues
  const initialValues = useMemo(() => cloneValues(form.getValues()), []);
  const lastValuesRef = useRef<any>(initialValues);
  const suppressRecordRef = useRef<UndoOp>(null);
  const undoMgrRef = useRef<InternalUndoManager | null>(null);
  const lastOpRef = useRef<UndoOp>(null);
  const undoAffectedFieldsRef = useRef<Set<string>>(new Set());
  const isHydratingRef = useRef(false);
  // Initialize with initial form state to prevent recording empty first step
  const lastRecordedValuesSigRef = useRef<string>(stableStringify(initialValues as any));
  const historyPendingRef = useRef(false);
  const noPendingGuardRef = useRef(false);

  // Rerender when undo stack changes (so canUndo/canRedo stay live)
  const [undoRenderTrigger, forceUndoRender] = useReducer((x) => x + 1, 0);

  const values = form.watch();

  // Never mutate baseline during history ops (only after confirmed save)
  const updateBaselineAfterHistory = useCallback(
    (_entry: any, op: "undo" | "redo") => {
      logger.debug(
        `History applied (${op}) â€” baseline unchanged (server state)`
      );
    },
    [logger]
  );

  // Helper to get current form values in a flat structure for undo tracking
  const getCurrentValues = useCallback(() => {
    const currentValues = form.getValues();
    // Flatten nested objects for proper tracking
    const flattened: Record<string, any> = {};

    const flatten = (obj: any, prefix = "") => {
      if (obj === null || obj === undefined) return;
      
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        // Arrays should be stored as-is (not flattened further)
        if (Array.isArray(value)) {
          flattened[fullKey] = value;
        }
        // Dates should be stored as-is
        else if (value instanceof Date) {
          flattened[fullKey] = value;
        }
        // Plain objects should be flattened recursively
        else if (value !== null && typeof value === "object") {
          flatten(value, fullKey);
        }
        // Primitives
        else {
          flattened[fullKey] = value;
        }
      }
    };

    flatten(currentValues);
    return flattened;
  }, [form]);

  // Initialize undo manager
  useEffect(() => {
    if (!undoEnabled) return;
    if (undoMgrRef.current) return;

    logger.debug("Creating undo manager");

    const writer = (name: string, value: unknown) => {
      // Reflect true op while applying history (helps skip recording)
      suppressRecordRef.current = lastOpRef.current ?? "undo";

      // Track affected fields - include all parent paths for nested fields
      undoAffectedFieldsRef.current.add(name);
      if (name.includes(".")) {
        // Add all parent paths (e.g., for "profile.firstName", add "profile")
        const parts = name.split(".");
        let parentPath = "";
        for (let i = 0; i < parts.length - 1; i++) {
          parentPath = parentPath ? `${parentPath}.${parts[i]}` : parts[i];
          undoAffectedFieldsRef.current.add(parentPath);
        }
      }

      logger.debug(`Undo writer: setting ${name} =`, value);

      // Use React Hook Form's setValue which handles nested paths
      (form as any)?.setValue?.(name, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });

      // For arrays, trigger validation after a short delay
      if (Array.isArray(value)) {
        setTimeout(() => (form as any)?.trigger?.(name), 0);
      }
    };

    undoMgrRef.current = new InternalUndoManager(
      writer,
      getCurrentValues,
      updateBaselineAfterHistory
    );
    
    logger.debug("Undo manager created successfully");
  }, [undoEnabled, updateBaselineAfterHistory, form, getCurrentValues, logger]);

  // Subscribe to undo manager changes for live updates
  useEffect(() => {
    if (!undoEnabled) return;
    if (!undoMgrRef.current) return;
    const unsub = undoMgrRef.current.subscribe(() => forceUndoRender());
    return () => unsub();
  }, [undoEnabled]);

  // Track the last signature to detect real changes
  const lastSignatureRef = useRef<string>("");
  
  // Record user changes - use signature-based comparison which worked for simple fields
  useEffect(() => {
    if (!undoEnabled) {
      lastValuesRef.current = cloneValues(values);
      return;
    }

    // Skip recording while hydrating
    if (isHydratingRef.current) {
      lastValuesRef.current = cloneValues(values);
      lastSignatureRef.current = stableStringify(values as any);
      return;
    }

    // If we're in the middle of applying an undo/redo operation, skip recording
    if (
      suppressRecordRef.current === "undo" ||
      suppressRecordRef.current === "redo"
    ) {
      lastValuesRef.current = cloneValues(values);
      lastSignatureRef.current = stableStringify(values as any);
      suppressRecordRef.current = null;
      return;
    }

    // Skip hydrate operations
    if (suppressRecordRef.current === "hydrate") {
      lastValuesRef.current = cloneValues(values);
      lastSignatureRef.current = stableStringify(values as any);
      suppressRecordRef.current = null;
      return;
    }

    noPendingGuardRef.current = false;

    const mgr = undoMgrRef.current;
    if (!mgr) {
      lastValuesRef.current = cloneValues(values);
      return;
    }
    
    // Create signature of current values
    const currentSignature = stableStringify(values as any);
    
    // Initialize on first run
    if (!lastSignatureRef.current) {
      lastSignatureRef.current = currentSignature;
      lastValuesRef.current = cloneValues(values);
      logger.debug("Initialized undo tracking");
      return;
    }
    
    // Check if signature changed (meaning real change happened)
    if (currentSignature === lastSignatureRef.current) {
      return; // No actual change
    }
    
    // Clone both for comparison - prev from ref, next from current values
    const prev = lastValuesRef.current;
    const next = cloneValues(values);
    const patches = diffToPatches(prev, next, "");

    logger.debug("Undo diff check", {
      patchCount: patches.length,
      patches: patches.slice(0, 3).map(p => ({ name: p.name, prev: p.prevValue, next: p.nextValue })),
    });

    if (patches.length) {
      // Clear future stack if user makes new change after undo
      if (mgr.canRedo()) {
        logger.debug("Clearing redo stack due to new user change after undo");
        mgr.clearFuture();
      }

      // Record the change
      mgr.record(patches);
      lastOpRef.current = "user";
      noPendingGuardRef.current = false;

      logger.debug("✅ Recorded user change for undo", {
        patches: patches.length,
        patchNames: patches.map(p => p.name),
        canUndo: mgr.canUndo(),
        canRedo: mgr.canRedo(),
        state: mgr.getState(),
      });
    }
    
    // Update tracking state AFTER comparison
    lastSignatureRef.current = currentSignature;
    lastValuesRef.current = next;
    lastRecordedValuesSigRef.current = currentSignature;
  }, [values, undoEnabled, logger, cloneValues]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!hotkeysEnabled || !undoEnabled || !undoMgrRef.current || !hotkeyTarget)
      return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl pressed?
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;

      // We only care about "z"
      const key = (e.key || "").toLowerCase();
      if (key !== "z") return;

      // Respect inputs unless explicitly told not to
      if (
        !captureInInputs &&
        isEditableElement((e.target as Element) ?? null)
      ) {
        return;
      }

      // Prevent the browser's default undo in those contexts
      e.preventDefault();
      e.stopPropagation();

      const mgr = undoMgrRef.current!;
      const wantsRedo = e.shiftKey; // Shift+Cmd/Ctrl+Z => redo

      if (wantsRedo) {
        if (mgr.canRedo()) {
          executeRedo();
        }
      } else {
        if (mgr.canUndo()) {
          executeUndo();
        }
      }
    };

    hotkeyTarget.addEventListener("keydown", onKeyDown as any, {
      capture: true,
    });
    return () => {
      hotkeyTarget.removeEventListener(
        "keydown",
        onKeyDown as any,
        { capture: true } as any
      );
    };
  }, [hotkeysEnabled, captureInInputs, undoEnabled, hotkeyTarget]);

  const executeUndo = useCallback(() => {
    if (!undoMgrRef.current) return;

    logger.debug("Execute undo - state before:", undoMgrRef.current.getState());

    undoAffectedFieldsRef.current.clear();
    suppressRecordRef.current = "undo";
    lastOpRef.current = "undo";

    // Perform the undo
    const undoSuccessful = undoMgrRef.current.undo();

    logger.debug("Execute undo - state after:", undoMgrRef.current.getState());

    if (!undoSuccessful) {
      // Reset state if undo failed
      suppressRecordRef.current = null;
      lastOpRef.current = null;
      return;
    }

    lastRecordedValuesSigRef.current = ""; // allow next real edit to record

    // Wait a tick for the form state to update, then check if we need to save
    setTimeout(() => {
      const valuesAfter = form.getValues() as T;
      const { isDirty, isValid, dirtyFields } = form.formState;
      const baselineAfter = equalsBaseline(valuesAfter);

      // Use the existing shouldSave logic to determine if we need to save
      const needsSave = shouldSave({
        values: valuesAfter,
        isValid,
        isDirty,
        dirtyFields,
      });

      logger.debug("Undo executed", {
        undoSuccessful,
        baselineAfter,
        needsSave,
        isDirty,
        dirtyFieldsCount: Object.keys(dirtyFields).length,
        ignoreHistoryOps,
        undoRedoState: undoMgrRef.current?.getState(),
      });

      if (baselineAfter) {
        historyPendingRef.current = false;
        noPendingGuardRef.current = true;
        lastRecordedValuesSigRef.current = stableStringify(valuesAfter as any);
      }

      // Only trigger autosave if shouldSave returns true and we're not ignoring history ops
      if (!ignoreHistoryOps && needsSave) {
        logger.debug(
          "Triggering autosave after undo - changes need to be saved"
        );

        historyPendingRef.current = true;

        setTimeout(() => {
          const currentValuesAfter = form.getValues();
          const currentDirtyFields = form.formState.dirtyFields;
          debouncedSave(currentValuesAfter as T, currentDirtyFields, true);

          // Reset lastOpRef after the save is queued
          setTimeout(() => {
            lastOpRef.current = null;
          }, 50);
        }, 100);
      } else {
        logger.debug(
          "Skipping autosave after undo - no changes need to be saved",
          {
            ignoreHistoryOps,
            needsSave,
            baselineAfter,
          }
        );

        // Reset lastOpRef immediately since we're not saving
        setTimeout(() => {
          lastOpRef.current = null;
        }, 50);
      }
    }, 10);
  }, [
    form,
    ignoreHistoryOps,
    equalsBaseline,
    debouncedSave,
    shouldSave,
    logger,
  ]);

  const executeRedo = useCallback(() => {
    if (!undoMgrRef.current) return;

    logger.debug("Execute redo - state before:", undoMgrRef.current.getState());

    undoAffectedFieldsRef.current.clear();
    suppressRecordRef.current = "redo";
    lastOpRef.current = "redo";

    // Perform the redo
    const redoSuccessful = undoMgrRef.current.redo();

    logger.debug("Execute redo - state after:", undoMgrRef.current.getState());

    if (!redoSuccessful) {
      // Reset state if redo failed
      suppressRecordRef.current = null;
      lastOpRef.current = null;
      return;
    }

    lastRecordedValuesSigRef.current = "";

    // Wait a tick for the form state to update, then check if we need to save
    setTimeout(() => {
      const valuesAfter = form.getValues() as T;
      const { isDirty, isValid, dirtyFields } = form.formState;
      const baselineAfter = equalsBaseline(valuesAfter);

      // Use the existing shouldSave logic to determine if we need to save
      const needsSave = shouldSave({
        values: valuesAfter,
        isValid,
        isDirty,
        dirtyFields,
      });

      logger.debug("Redo executed", {
        redoSuccessful,
        baselineAfter,
        needsSave,
        isDirty,
        dirtyFieldsCount: Object.keys(dirtyFields).length,
        ignoreHistoryOps,
        undoRedoState: undoMgrRef.current?.getState(),
      });

      if (baselineAfter) {
        historyPendingRef.current = false;
        lastRecordedValuesSigRef.current = stableStringify(valuesAfter as any);
      }

      // Only trigger autosave if shouldSave returns true and we're not ignoring history ops
      if (!ignoreHistoryOps && needsSave) {
        logger.debug(
          "Triggering autosave after redo - changes need to be saved"
        );

        historyPendingRef.current = true;

        setTimeout(() => {
          const currentValuesAfter = form.getValues();
          const currentDirtyFields = form.formState.dirtyFields;
          debouncedSave(currentValuesAfter as T, currentDirtyFields, true);

          // Reset lastOpRef after the save is queued
          setTimeout(() => {
            lastOpRef.current = null;
          }, 50);
        }, 100);
      } else {
        logger.debug(
          "Skipping autosave after redo - no changes need to be saved",
          {
            ignoreHistoryOps,
            needsSave,
            baselineAfter,
          }
        );

        // Reset lastOpRef immediately since we're not saving
        setTimeout(() => {
          lastOpRef.current = null;
        }, 50);
      }
    }, 10);
  }, [
    form,
    ignoreHistoryOps,
    equalsBaseline,
    debouncedSave,
    shouldSave,
    logger,
  ]);

  const executeUndoLastSave = useCallback(() => {
    if (!undoMgrRef.current) return;

    logger.debug("Execute undoLastSave - reverting to last save point");

    suppressRecordRef.current = "undo";
    lastOpRef.current = "undo";

    // Try to undo to last checkpoint
    const undidSomething = undoMgrRef.current.undoToLastCheckpoint();

    if (!undidSomething) {
      logger.debug("No changes to undo");
      suppressRecordRef.current = null;
      lastOpRef.current = null;
      return;
    }

    // Mark that we need to save these changes
    if (!ignoreHistoryOps) {
      historyPendingRef.current = true;
    }

    // Trigger save after a short delay
    setTimeout(() => {
      const currentValuesAfter = form.getValues();
      const currentDirtyFields = form.formState.dirtyFields;

      logger.debug("After undoLastSave, triggering save", {
        values: currentValuesAfter,
        dirtyFields: currentDirtyFields,
      });

      if (!ignoreHistoryOps) {
        debouncedSave(currentValuesAfter as T, currentDirtyFields, true);
      }

      // Reset the operation ref
      setTimeout(() => {
        suppressRecordRef.current = null;
        lastOpRef.current = null;
      }, 100);
    }, 100);
  }, [form, ignoreHistoryOps, debouncedSave, logger]);

  const handleHydration = useCallback(
    (data: T) => {
      // Validate input data
      if (!data || typeof data !== 'object') {
        logger.error("Invalid data provided to handleHydration");
        return;
      }

      logger.debug("Auto-hydrating form data", data);

      isHydratingRef.current = true;
      suppressRecordRef.current = "hydrate";

      // Don't call form.reset() since the form is already in the correct state
      // Just update our internal tracking
      if (undoMgrRef.current) undoMgrRef.current.clear();
      lastValuesRef.current = data;
      lastRecordedValuesSigRef.current = stableStringify(data as any);

      // IMPORTANT: Update baseline and saved state are handled by useAutosaveEffects
      // which calls this function and then updates those states

      suppressRecordRef.current = null;
      Promise.resolve().then(() => {
        isHydratingRef.current = false;
      });
    },
    [logger]
  );

  // Public API
  const undoAPI: UndoRedoAPI = useMemo(() => {
    if (!undoEnabled || !undoMgrRef.current) {
      return {
        undo: undefined as unknown as () => void,
        redo: undefined as unknown as () => void,
        undoLastSave: undefined as unknown as () => void,
        canUndo: false,
        canRedo: false,
      };
    }

    const mgr = undoMgrRef.current;
    return {
      undo: executeUndo,
      redo: executeRedo,
      undoLastSave: executeUndoLastSave,
      canUndo: mgr.canUndo(),
      canRedo: mgr.canRedo(),
    };
  }, [
    undoEnabled,
    executeUndo,
    executeRedo,
    executeUndoLastSave,
    undoRenderTrigger,
  ]);

  const hydrateFromServer = useCallback(
    (data: T) => {
      // Validate input data
      if (!data || typeof data !== 'object') {
        logger.error("Invalid data provided to hydrateFromServer");
        return;
      }

      logger.debug("Manual hydration requested", data);

      isHydratingRef.current = true;
      suppressRecordRef.current = "hydrate";

      form.reset(data as any, {
        keepDirty: false,
        keepTouched: false,
        keepValues: false,
      });

      if (undoMgrRef.current) undoMgrRef.current.clear();
      lastValuesRef.current = data;
      lastRecordedValuesSigRef.current = stableStringify(data as any);

      // Update baseline and saved state if provided
      if (params?.updateBaseline) {
        params.updateBaseline(data);
      }
      if (params?.updateLastSavedState) {
        params.updateLastSavedState(data);
      }

      suppressRecordRef.current = null;
      Promise.resolve().then(() => {
        isHydratingRef.current = false;
      });
    },
    [form, logger, params]
  );

  return {
    // API
    undoAPI,
    hydrateFromServer,
    handleHydration,

    // State refs (for other hooks to access)
    lastOpRef,
    undoAffectedFieldsRef,
    isHydratingRef,
    historyPendingRef,
    noPendingGuardRef,
    undoMgrRef,
    lastRecordedValuesSigRef,

    // State getters
    undoEnabled,
    ignoreHistoryOps,
  };
}
