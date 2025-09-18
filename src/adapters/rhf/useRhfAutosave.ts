"use client";

import { useEffect, useReducer, useRef, useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";

import { AutosaveManager } from "../../core/autosave";
import { autosaveReducer, initialAutosaveState } from "../../state/reducer";
import type { Transport, SavePayload, SaveResult } from "../../core/types";
import type { FormSubset } from "../../strategies/validation/types";
import {
  createValidationStrategy,
  type ValidationMode,
} from "../../strategies/validation";
import { ValidationCache } from "../../cache/validationCache";
import { PayloadCache } from "../../cache/payloadCache";
import { MetricsCollector } from "../../metrics/collector";
import { pickChanged } from "../../utils/pickChanged";
import { mapKeys, type KeyMap } from "../../utils/mapKeys";
import { createLogger } from "../../utils/logger";
import type { AutosaveConfig } from "../../config/schema";

export interface DiffHandler {
  idOf: (item: any) => string | number;
  onAdd: (item: any) => Promise<void> | void;
  onRemove: (item: any) => Promise<void> | void;
}

export interface RhfAutosaveOptions<T extends FieldValues> {
  form: FormSubset<T>;
  transport: Transport;
  config?: Partial<AutosaveConfig>;
  selectPayload?: (values: T, dirtyFields: any) => Partial<T>;
  shouldSave?: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
    dirtyFields: any;
  }) => boolean;
  onSaved?: (result: any, payload: SavePayload) => void;
  keyMap?: KeyMap;
  mapPayload?: (payload: Record<string, any>) => Record<string, any>;
  validateBeforeSave?: ValidationMode;
  diffMap?: Record<string, DiffHandler>;
  debug?: boolean;
}

function stableStringify(obj: Record<string, any>): string {
  const keys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const k of keys) result[k] = obj[k];
  return JSON.stringify(result);
}

export function useRhfAutosave<T extends FieldValues>(
  options: RhfAutosaveOptions<T>
) {
  const {
    form,
    transport: baseTransport,
    config = {},
    selectPayload = (values, dirty) =>
      pickChanged(values as any, dirty) as Partial<T>,
    shouldSave = ({ dirtyFields }) => {
      return Object.keys(dirtyFields).length > 0;
    },
    onSaved,
    keyMap,
    mapPayload,
    validateBeforeSave = "payload",
    diffMap,
    debug,
  } = options;

  // State management
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosaveState);

  // Caches and utilities - using useMemo for better lifecycle management
  const validationCache = useMemo(() => new ValidationCache(), []);
  const payloadCache = useMemo(() => new PayloadCache(), []);
  const metrics = useMemo(() => new MetricsCollector(), []);
  const logger = useMemo(() => createLogger("rhf", debug), [debug]);

  // Validation strategy
  const validationStrategy = useMemo(
    () => createValidationStrategy<T>(validateBeforeSave),
    [validateBeforeSave]
  );

  // Baseline management for diff operations
  const baselineRef = useRef<Record<string, any> | null>(null);
  const isBaselineInitializedRef = useRef<boolean>(false);

  // Debouncing refs
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueuedSigRef = useRef<string>("");

  // Form state
  const values = form.watch();
  const { isDirty, isValid, dirtyFields, isValidating } = form.formState;

  // Initialize baseline when form is clean
  useEffect(() => {
    if (!diffMap) return;

    if (!isDirty && !isBaselineInitializedRef.current) {
      const currentValues = form.getValues() as any;
      logger.debug(
        "Initializing baseline from clean form state",
        currentValues
      );
      dispatch({ type: "INITIALIZE_BASELINE", baseline: currentValues });
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
    }
  }, [isDirty, diffMap, form, logger]);

  // Reset baseline initialization after form reset
  useEffect(() => {
    if (!isDirty && Object.keys(dirtyFields).length === 0) {
      isBaselineInitializedRef.current = false;
      dispatch({ type: "RESET_BASELINE" });
    }
  }, [isDirty, dirtyFields]);

  // Helper functions
  const handleDiffOperations = useCallback(
    async (
      payload: SavePayload,
      diffMap: Record<string, DiffHandler>,
      baseline: Record<string, any> | null
    ): Promise<void> => {
      if (!baseline) return;

      const operations: Array<() => Promise<void>> = [];

      for (const [key, handler] of Object.entries(diffMap)) {
        if (!(key in payload)) continue;

        const prev = baseline[key] || [];
        const curr = (payload as any)[key] || [];

        if (!Array.isArray(prev) || !Array.isArray(curr)) continue;

        const prevIds = new Set(prev.map(handler.idOf));
        const currIds = new Set(curr.map(handler.idOf));

        const added = curr.filter((x: any) => !prevIds.has(handler.idOf(x)));
        const removed = prev.filter((x: any) => !currIds.has(handler.idOf(x)));

        logger.debug("Diff calculation", {
          key,
          baseline: prev.map(handler.idOf),
          current: curr.map(handler.idOf),
          added: added.map(handler.idOf),
          removed: removed.map(handler.idOf),
        });

        for (const item of added) {
          operations.push(async () => {
            const itemId = handler.idOf(item);
            logger.debug(`onAdd: ${key}`, { itemId, item });
            await Promise.resolve(handler.onAdd(item));
          });
        }
        for (const item of removed) {
          operations.push(async () => {
            const itemId = handler.idOf(item);
            logger.debug(`onRemove: ${key}`, { itemId, item });
            await Promise.resolve(handler.onRemove(item));
          });
        }

        // Remove from payload as it's handled by diff operations
        delete (payload as any)[key];
      }

      // Execute all diff operations
      await Promise.all(operations.map((op) => op()));
    },
    [logger]
  );

  const updateBaseline = useCallback(
    (payload: SavePayload): void => {
      if (!baselineRef.current) return;

      const newBaseline = { ...baselineRef.current };
      Object.keys(payload).forEach((key) => {
        if ((payload as any)[key] !== undefined) {
          newBaseline[key] = (payload as any)[key];
        }
      });

      baselineRef.current = newBaseline;
      dispatch({ type: "UPDATE_BASELINE", baseline: newBaseline });
      logger.debug("Baseline updated after success", newBaseline);
    },
    [logger]
  );

  // Create composed transport with diff handling - memoized to prevent recreations
  const composedTransport = useMemo((): Transport => {
    return async (payload, ctx) => {
      const startTime = performance.now();
      dispatch({ type: "SAVE_START" });

      try {
        // Handle diff operations first
        if (diffMap && Object.keys(diffMap).length > 0) {
          await handleDiffOperations(payload, diffMap, baselineRef.current);
        }

        // Apply key transformations
        let finalPayload = payload;
        if (keyMap) {
          finalPayload = mapKeys(finalPayload as any, keyMap) as SavePayload;
        }
        if (mapPayload) {
          finalPayload = mapPayload(finalPayload as any) as SavePayload;
        }

        // Early return if no payload to send
        if (Object.keys(finalPayload).length === 0) {
          const duration = performance.now() - startTime;
          dispatch({ type: "SAVE_SUCCESS", duration });
          updateBaseline(payload);
          metrics.recordSave(duration, true);
          logger.debug("Save completed (diff operations only)", { duration });

          const result = { ok: true as const };
          onSaved?.(result, payload);
          return result;
        }

        // Execute base transport
        const result = await baseTransport(finalPayload, ctx);
        const duration = performance.now() - startTime;

        if (result.ok) {
          dispatch({ type: "SAVE_SUCCESS", duration });
          updateBaseline(payload);
          metrics.recordSave(duration, true);
          logger.debug("Save completed successfully", { result, duration });
        } else {
          dispatch({ type: "SAVE_ERROR", error: result.error, duration });
          metrics.recordSave(duration, false);
          logger.error("Save failed", result.error, { payload, duration });
        }

        onSaved?.(result, payload);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        dispatch({ type: "SAVE_ERROR", error: err, duration });
        metrics.recordSave(duration, false);
        logger.error("Save failed with exception", err, { payload, duration });

        return { ok: false, error: err };
      }
    };
  }, [
    baseTransport,
    keyMap,
    mapPayload,
    diffMap,
    onSaved,
    metrics,
    logger,
    handleDiffOperations,
    updateBaseline,
  ]);

  // Create autosave manager with proper dependency management
  const manager = useMemo(() => {
    return new AutosaveManager(
      composedTransport,
      config.debounceMs || 600,
      logger
    );
  }, [composedTransport, config.debounceMs, logger]);

  // Debounced save function
  const debouncedSave = useCallback(
    (values: T, dirtyFields: any) => {
      // Clear any existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set a new timeout
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          // Enhanced shouldSave check
          const shouldTriggerSave = shouldSave({
            values,
            isValid,
            isDirty,
            dirtyFields,
          });

          if (!shouldTriggerSave) {
            logger.debug("Skipping save - shouldSave returned false");
            return;
          }

          // Build payload from all dirty fields
          const basePayload = selectPayload(values, dirtyFields) as SavePayload;

          if (Object.keys(basePayload).length === 0) {
            logger.debug("Skipping save - empty payload");
            return;
          }

          // Validate before queueing if requested
          if (validateBeforeSave !== "none") {
            const sig = stableStringify(basePayload as any);
            let validationResult = validationCache.get(sig);

            if (validationResult === undefined) {
              logger.debug("Running validation for payload", basePayload);
              validationResult = await validationStrategy.validate(
                form,
                basePayload
              );
              validationCache.set(sig, validationResult);
              metrics.recordCacheMiss();
            } else {
              logger.debug("Using cached validation result", {
                sig,
                valid: validationResult,
              });
              metrics.recordCacheHit();
            }

            if (!validationResult) {
              logger.debug("Skipping save - validation failed");
              return;
            }
          }

          // Only queue if payload is meaningfully different
          const sig = stableStringify(basePayload as any);
          if (sig === lastQueuedSigRef.current) {
            logger.debug("Skipping save - duplicate payload", sig);
            return;
          }
          lastQueuedSigRef.current = sig;

          logger.debug("Queueing change after debounce", basePayload);
          manager.queueChange(basePayload);
        } catch (error) {
          logger.error(
            "Error in debounced save",
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }, config.debounceMs || 600);
    },
    [
      shouldSave,
      isValid,
      isDirty,
      selectPayload,
      validateBeforeSave,
      validationCache,
      validationStrategy,
      form,
      metrics,
      logger,
      manager,
      config.debounceMs,
    ]
  );

  // Main autosave effect - Simplified to only trigger debounced save
  useEffect(() => {
    // Skip if form is currently validating
    if (isValidating) {
      logger.debug("Skipping save - form is validating");
      return;
    }

    // If using diffMap, wait for baseline to initialize
    if (diffMap && !isBaselineInitializedRef.current) {
      logger.debug("Skipping save - baseline not initialized yet");
      return;
    }

    // Detect if there are any changes worth saving
    const hasChanges = Object.keys(dirtyFields).length > 0 || isDirty;

    if (!hasChanges) {
      logger.debug("Skipping save - no changes detected");
      return;
    }

    // Trigger debounced save
    debouncedSave(values, dirtyFields);
  }, [
    values,
    dirtyFields,
    isDirty,
    isValidating,
    debouncedSave,
    diffMap,
    logger,
  ]);

  // Clear caches when form becomes clean
  useEffect(() => {
    if (Object.keys(dirtyFields).length === 0 && !isDirty) {
      validationCache.clear();
      lastQueuedSigRef.current = "";
      logger.debug("Cleared validation cache - form is clean");
    }
  }, [dirtyFields, isDirty, validationCache, logger]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      logger.debug("Cleaning up autosave hook");
      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      manager.abort();
    };
  }, [manager, logger]);

  // Return public API
  return {
    // Status
    isSaving: state.isSaving,
    lastError: state.lastError,
    metrics: state.metrics,

    // Actions
    flush: useCallback(() => {
      logger.debug("Manual flush requested");
      // Clear debounce and immediately flush
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      return manager.flush();
    }, [manager, logger]),

    abort: useCallback(() => {
      logger.debug("Manual abort requested");
      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      manager.abort();
      dispatch({ type: "ABORT" });
    }, [manager, logger]),

    // Baseline management
    forceBaselineUpdate: useCallback(() => {
      const currentValues = form.getValues() as any;
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
      dispatch({ type: "INITIALIZE_BASELINE", baseline: currentValues });
      logger.debug("Baseline force-updated", currentValues);
    }, [form, logger]),

    getBaseline: useCallback(() => baselineRef.current, []),

    isBaselineInitialized: useCallback(
      () => isBaselineInitializedRef.current,
      []
    ),

    // Metrics and debugging
    getMetrics: useCallback(() => metrics.getMetrics(), [metrics]),

    getCacheStats: useCallback(
      () => ({
        validationCacheSize: validationCache.size(),
        payloadCacheSize: payloadCache.size(),
      }),
      [validationCache, payloadCache]
    ),

    // Internal state for debugging
    getPendingChanges: useCallback(
      () => manager.getPendingChanges(),
      [manager]
    ),

    isEmpty: useCallback(() => manager.isEmpty(), [manager]),

    // Force save (bypass debounce)
    forceSave: useCallback(() => {
      logger.debug("Force save requested");
      // Clear debounce and trigger immediate save
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      // Trigger immediate save with current form state
      debouncedSave.call(null, values, dirtyFields);
    }, [logger, values, dirtyFields, debouncedSave]),
  };
}
