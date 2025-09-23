import { useRef, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import type { FormSubset } from "../../../strategies/validation/types";
import type { SavePayload } from "../../../core/types";
import type { BaselineState, DiffHandler } from "../utils/types";
import { deepEqual } from "../utils/diff";
import { createLogger, type Logger } from "../../../utils/logger";

export function useBaseline<T extends FieldValues>(
  form: FormSubset<T>,
  diffMap?: Record<string, DiffHandler>,
  undoEnabled?: boolean,
  debug?: boolean
) {
  const logger = createLogger("baseline", debug);
  const baselineRef = useRef<Record<string, any> | null>(null);
  const isBaselineInitializedRef = useRef<boolean>(false);

  const equalsBaseline = useCallback((vals: any): boolean => {
    if (!baselineRef.current) return false;
    const keys = new Set([
      ...Object.keys(vals || {}),
      ...Object.keys(baselineRef.current || {}),
    ]);
    for (const k of keys) {
      if (!deepEqual(vals[k], (baselineRef.current as any)[k])) return false;
    }
    return true;
  }, []);

  const initializeBaseline = useCallback(
    (values: Record<string, any>) => {
      logger.debug("Initializing baseline from clean form state", values);
      baselineRef.current = { ...values };
      isBaselineInitializedRef.current = true;
    },
    [logger]
  );

  const updateBaseline = useCallback(
    (payload: SavePayload): void => {
      if (!baselineRef.current) return;
      const nextBaseline = { ...baselineRef.current };
      for (const k of Object.keys(payload)) {
        (nextBaseline as any)[k] = (payload as any)[k];
      }
      baselineRef.current = nextBaseline;
      logger.debug("Baseline updated after success", nextBaseline);
    },
    [logger]
  );

  const resetBaseline = useCallback(() => {
    baselineRef.current = null;
    isBaselineInitializedRef.current = false;
  }, []);

  const forceBaselineUpdate = useCallback(() => {
    const currentValues = form.getValues() as any;
    baselineRef.current = { ...currentValues };
    isBaselineInitializedRef.current = true;
    logger.debug("Forced baseline update", currentValues);
  }, [form, logger]);

  const getBaseline = useCallback(() => baselineRef.current, []);

  const isBaselineInitialized = useCallback(
    () => isBaselineInitializedRef.current,
    []
  );

  const shouldInitializeBaseline = useCallback(
    (isDirty: boolean) => {
      return (
        (diffMap || undoEnabled) &&
        !isDirty &&
        !isBaselineInitializedRef.current
      );
    },
    [diffMap, undoEnabled]
  );

  const shouldResetBaseline = useCallback(
    (isDirty: boolean, dirtyFields: any) => {
      return !isDirty && Object.keys(dirtyFields).length === 0;
    },
    []
  );

  return {
    // State refs
    baselineRef,
    isBaselineInitializedRef,

    // Methods
    equalsBaseline,
    initializeBaseline,
    updateBaseline,
    resetBaseline,
    forceBaselineUpdate,
    getBaseline,
    isBaselineInitialized,

    // Conditional checks
    shouldInitializeBaseline,
    shouldResetBaseline,
  };
}
