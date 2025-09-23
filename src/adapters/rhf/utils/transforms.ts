import type { FieldValues } from "react-hook-form";
import type { SavePayload } from "../../../core/types";
import { pickChanged } from "../../../utils/pickChanged";
import { mapKeys, type KeyMap } from "../../../utils/mapKeys";
import { createLogger } from "../../../utils/logger";

export function datesToIso(payload: SavePayload): SavePayload {
  const out: SavePayload = {};
  for (const k of Object.keys(payload)) {
    const v = (payload as any)[k];
    out[k] = v instanceof Date ? (v.toISOString() as any) : v;
  }
  return out;
}

export function createDefaultSelectPayload<T extends FieldValues>(
  getEffectiveDirtyFields: (dirty: any) => any,
  diffMap?: Record<string, any>,
  baselineRef?: { current: Record<string, any> | null },
  lastOpRef?: { current: string | null }
) {
  const logger = createLogger("SelectPayload");
  return (values: T, dirty: any) => {
    logger.debug("[selectPayload] Input:", {
      values,
      dirty,
      lastOp: lastOpRef?.current,
    });

    const effectiveDirty = getEffectiveDirtyFields(dirty);
    logger.debug("[selectPayload] Effective dirty:", effectiveDirty);

    const result = pickChanged(values as any, effectiveDirty) as Partial<T>;
    logger.debug("[selectPayload] After pickChanged:", result);

    // Rest of the function remains the same...

    logger.debug("[selectPayload] Final result:", result);
    return result;
  };
}

export function createDefaultShouldSave<T extends FieldValues>(
  getEffectiveDirtyFields: (dirty: any) => any,
  baselineRef?: { current: Record<string, any> | null },
  lastOpRef?: { current: string | null }
) {
  return ({ dirtyFields, values }: any) => {
    const effectiveDirtyFields = getEffectiveDirtyFields(dirtyFields);
    if (Object.keys(effectiveDirtyFields).length > 0) return true;

    if (
      baselineRef?.current &&
      lastOpRef?.current &&
      (lastOpRef.current === "undo" || lastOpRef.current === "redo")
    ) {
      for (const key of Object.keys(values)) {
        if (!deepEqual((values as any)[key], baselineRef.current[key])) {
          return true;
        }
      }
    }

    return false;
  };
}

export function createEffectiveDirtyFieldsGetter(
  undoEnabled: boolean,
  lastOpRef: { current: string | null },
  undoAffectedFieldsRef: { current: Set<string> }
) {
  return (currentDirty: any) => {
    const effective = { ...currentDirty };

    if (
      undoEnabled &&
      (lastOpRef.current === "undo" || lastOpRef.current === "redo")
    ) {
      for (const fieldName of undoAffectedFieldsRef.current) {
        const parts = fieldName.split(".");
        let current: any = effective;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = true;
      }
    }

    return effective;
  };
}

export function createComposedTransport(
  baseTransport: any,
  keyMap?: KeyMap,
  mapPayload?: (payload: Record<string, any>) => Record<string, any>,
  diffMap?: Record<string, any>,
  updateBaseline?: (payload: SavePayload) => void,
  undoEnabled?: boolean,
  undoMgrRef?: { current: any },
  onSaved?: (result: any, payload: SavePayload) => void,
  metrics?: any,
  logger?: any,
  baselineRef?: { current: Record<string, any> | null }
) {
  return async (payload: SavePayload, ctx: any) => {
    const start = performance.now();
    // Transport composition logic will go here
    // This is a placeholder for the complex transport logic
    return baseTransport(payload, ctx);
  };
}

// Import deepEqual from diff.ts to avoid circular dependency
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
