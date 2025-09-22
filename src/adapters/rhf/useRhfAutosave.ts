"use client";

import { useEffect, useReducer, useRef, useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";

import { AutosaveManager } from "../../core/autosave";
import { autosaveReducer, initialAutosaveState } from "../../state/reducer";
import type { Transport, SavePayload } from "../../core/types";
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

/* ============================= Undo/Redo internals ============================= */

type FieldPath = string;
type UndoOp = "user" | "undo" | "redo" | "hydrate" | null;

type Patch = {
  name: FieldPath;
  prevValue: unknown;
  nextValue: unknown;
  rootField?: string;
};

type HistoryEntry = Patch[];

/** Minimal manager that writes via RHF setValue */
class InternalUndoManager {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private listeners = new Set<() => void>();
  private lastOp: Exclude<UndoOp, "hydrate"> | null = null;
  private checkpoints: number[] = [];

  constructor(
    private setValue: (
      name: FieldPath,
      value: unknown,
      shouldDirty?: boolean
    ) => void,
    private onHistoryApplied?: (
      entry: HistoryEntry,
      op: "undo" | "redo"
    ) => void,
    private maxEntries?: number
  ) {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify() {
    for (const l of this.listeners) l();
  }

  record(entry: HistoryEntry) {
    if (!entry.length) return;
    this.past.push(entry);
    if (this.maxEntries && this.past.length > this.maxEntries) {
      this.past.shift();
    }
    this.future = []; // user change clears redo
    this.lastOp = "user";
    this.notify();
  }

  /** Explicit: allow callers to clear future on first sign of user input */
  clearFuture() {
    if (this.future.length) {
      this.future = [];
      this.notify();
    }
  }

  undo() {
    const entry = this.past.pop();
    if (!entry) return;
    this.future.push(entry);

    for (const { name, prevValue } of entry) {
      this.setValue(name, prevValue, true);
    }

    this.lastOp = "undo";
    this.onHistoryApplied?.(entry, "undo");
    this.notify();
  }

  redo() {
    const entry = this.future.pop();
    if (!entry) return;
    this.past.push(entry);

    for (const { name, nextValue } of entry) {
      this.setValue(name, nextValue, true);
    }

    this.lastOp = "redo";
    this.onHistoryApplied?.(entry, "redo");
    this.notify();
  }

  markCheckpoint() {
    this.checkpoints.push(this.past.length);
  }
  undoToLastCheckpoint() {
    const target = this.checkpoints.pop();
    if (target === undefined) return;
    while (this.past.length > target) this.undo();
  }

  canUndo() {
    return this.past.length > 0;
  }
  canRedo() {
    return this.future.length > 0;
  }
  getLastOp(): Exclude<UndoOp, "hydrate"> | null {
    return this.lastOp;
  }

  clear() {
    this.past = [];
    this.future = [];
    this.lastOp = null;
    this.checkpoints = [];
    this.notify();
  }
}

/* ================================ Utilities ================================== */

function isObject(x: any) {
  return x !== null && typeof x === "object";
}

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    const aHasIds =
      a.length > 0 && a[0] && typeof a[0] === "object" && "id" in a[0];
    const bHasIds =
      b.length > 0 && b[0] && typeof b[0] === "object" && "id" in b[0];

    if (aHasIds && bHasIds) {
      const aIds = a.map((item: any) => item.id).sort();
      const bIds = b.map((item: any) => item.id).sort();
      return JSON.stringify(aIds) === JSON.stringify(bIds);
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isObject(a) && isObject(b)) {
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

function diffToPatches(prev: any, next: any, basePath = ""): Patch[] {
  if (deepEqual(prev, next)) return [];

  if (Array.isArray(prev) && Array.isArray(next)) {
    return [
      {
        name: basePath,
        prevValue: prev,
        nextValue: next,
        rootField: basePath.includes(".") ? basePath.split(".")[0] : basePath,
      },
    ];
  }

  const prevIsObj =
    isObject(prev) && !Array.isArray(prev) && !(prev instanceof Date);
  const nextIsObj =
    isObject(next) && !Array.isArray(next) && !(next instanceof Date);

  if (!prevIsObj || !nextIsObj) {
    return [
      {
        name: basePath,
        prevValue: prev,
        nextValue: next,
        rootField: basePath.includes(".") ? basePath.split(".")[0] : basePath,
      },
    ];
  }

  const patches: Patch[] = [];
  const keys = new Set<string>([
    ...Object.keys(prev ?? {}),
    ...Object.keys(next ?? {}),
  ]);
  for (const k of keys) {
    const childPath = basePath ? `${basePath}.${k}` : k;
    const p = (prev ?? {})[k];
    const n = (next ?? {})[k];

    if (!deepEqual(p, n)) {
      if (Array.isArray(p) && Array.isArray(n)) {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      } else if (p instanceof Date && n instanceof Date) {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      } else if (isObject(p) && isObject(n)) {
        patches.push(...diffToPatches(p, n, childPath));
      } else {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      }
    }
  }
  return patches;
}

function stableStringify(obj: Record<string, any>): string {
  const keys = Object.keys(obj).sort();
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function datesToIso(payload: SavePayload): SavePayload {
  const out: SavePayload = {};
  for (const k of Object.keys(payload)) {
    const v = (payload as any)[k];
    out[k] = v instanceof Date ? (v.toISOString() as any) : v;
  }
  return out;
}

/* =============================== Public API ================================== */

export interface DiffHandler {
  idOf: (item: any) => string | number;
  onAdd: (item: any) => Promise<void> | void;
  onRemove: (item: any) => Promise<void> | void;
}

export interface UndoOptions {
  enabled?: boolean;
  ignoreHistoryOps?: boolean;
  maxEntries?: number;
}

export interface RhfAutosaveOptions<T extends FieldValues> {
  form: FormSubset<T>;
  transport: Transport;
  config?: Partial<AutosaveConfig>;
  hasPendingChanges?: boolean; // external override (optional)
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
  undo?: UndoOptions;
}

/* ================================== Hook ===================================== */

export function useRhfAutosave<T extends FieldValues>(
  options: RhfAutosaveOptions<T>
) {
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
  } = options;

  const undoEnabled = !!undo?.enabled;
  const ignoreHistoryOps = undo?.ignoreHistoryOps ?? false;

  const [state, dispatch] = useReducer(autosaveReducer, initialAutosaveState);

  const validationCache = useMemo(() => new ValidationCache(), []);
  const payloadCache = useMemo(() => new PayloadCache(), []);
  const metrics = useMemo(() => new MetricsCollector(), []);
  const logger = useMemo(() => createLogger("rhf", debug), [debug]);

  const validationStrategy = useMemo(
    () => createValidationStrategy<T>(validateBeforeSave),
    [validateBeforeSave]
  );

  const baselineRef = useRef<Record<string, any> | null>(null);
  const isBaselineInitializedRef = useRef<boolean>(false);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueuedSigRef = useRef<string>("");
  const pendingPayloadRef = useRef<SavePayload>({});

  const lastValuesRef = useRef<any>(form.getValues());
  const suppressRecordRef = useRef<UndoOp>(null);
  const undoMgrRef = useRef<InternalUndoManager | null>(null);
  const lastOpRef = useRef<UndoOp>(null);

  const undoAffectedFieldsRef = useRef<Set<string>>(new Set());
  const isHydratingRef = useRef(false);

  // Prevent duplicate history entries for the same logical state (StrictMode, re-renders)
  const lastRecordedValuesSigRef = useRef<string>("");

  // Make hasPendingChanges reflect undo/redo immediately
  const historyPendingRef = useRef(false);
  const noPendingGuardRef = useRef(false);
  // Rerender when undo stack changes (so canUndo/canRedo stay live)
  const [, forceUndoRender] = useReducer((x) => x + 1, 0);

  const values = form.watch();
  const { isDirty, isValid, dirtyFields, isValidating } = form.formState;

  useEffect(() => {
    if (!undoEnabled) return;
    if (!undoMgrRef.current) return;
    const unsub = undoMgrRef.current.subscribe(() => forceUndoRender());
    return () => unsub();
  }, [undoEnabled]);

  const equalsBaseline = useCallback((vals: any) => {
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

  const getEffectiveDirtyFields = useCallback(
    (currentDirty: any) => {
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
    },
    [undoEnabled]
  );

  const selectPayload = useMemo(() => {
    if (userSelectPayload) return userSelectPayload;

    return (values: T, dirty: any) => {
      const effectiveDirty = getEffectiveDirtyFields(dirty);
      const result = pickChanged(values as any, effectiveDirty) as Partial<T>;

      if (diffMap) {
        for (const fieldName of Object.keys(diffMap)) {
          if (
            fieldName in values &&
            Array.isArray((values as any)[fieldName])
          ) {
            if (baselineRef.current) {
              if (
                !deepEqual(
                  (values as any)[fieldName],
                  baselineRef.current[fieldName]
                )
              ) {
                (result as any)[fieldName] = (values as any)[fieldName];
              }
            }
          }
        }
      }

      if (lastOpRef.current === "undo" || lastOpRef.current === "redo") {
        if (baselineRef.current) {
          for (const key of Object.keys(values)) {
            if (!deepEqual((values as any)[key], baselineRef.current[key])) {
              (result as any)[key] = (values as any)[key];
            }
          }
        }
      }

      return result;
    };
  }, [userSelectPayload, diffMap, getEffectiveDirtyFields]);

  const shouldSave = useMemo(() => {
    if (userShouldSave) return userShouldSave;

    return ({ dirtyFields, values }: any) => {
      const effectiveDirtyFields = getEffectiveDirtyFields(dirtyFields);
      if (Object.keys(effectiveDirtyFields).length > 0) return true;

      if (
        baselineRef.current &&
        lastOpRef.current &&
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
  }, [userShouldSave, getEffectiveDirtyFields]);

  // Never mutate baseline during history ops (only after confirmed save)
  const updateBaselineAfterHistory = useCallback(
    (_entry: HistoryEntry, op: "undo" | "redo") => {
      logger.debug(
        `History applied (${op}) — baseline unchanged (server state)`
      );
    },
    [logger]
  );

  // Init undo manager
  useEffect(() => {
    if (!undoEnabled) return;
    if (undoMgrRef.current) return;

    const writer = (name: string, value: unknown) => {
      // Reflect true op while applying history (helps skip recording)
      suppressRecordRef.current = lastOpRef.current ?? "undo";

      undoAffectedFieldsRef.current.add(name);
      if (name.includes(".")) {
        undoAffectedFieldsRef.current.add(name.split(".")[0]);
      }

      (form as any)?.setValue?.(name, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });

      if (
        Array.isArray(value) &&
        value.length > 0 &&
        (value as any)[0]?.id !== undefined
      ) {
        setTimeout(() => (form as any)?.trigger?.(name), 0);
      }
    };

    undoMgrRef.current = new InternalUndoManager(
      writer,
      updateBaselineAfterHistory,
      undo?.maxEntries
    );
  }, [undoEnabled, updateBaselineAfterHistory, form, undo?.maxEntries]);

  // Initialize baseline once, from clean state
  useEffect(() => {
    if (!diffMap && !undoEnabled) return;

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
  }, [isDirty, diffMap, undoEnabled, form, logger]);

  // When form becomes clean (e.g., after reset), do NOT clear undo history by default
  useEffect(() => {
    if (!isDirty && Object.keys(dirtyFields).length === 0) {
      isBaselineInitializedRef.current = false;
      dispatch({ type: "RESET_BASELINE" });
      baselineRef.current = null;
      undoAffectedFieldsRef.current.clear();
      // keep undo history to allow undo-after-save behavior
      lastValuesRef.current = form.getValues();
    }
  }, [isDirty, dirtyFields, form]);

  const updateBaseline = useCallback(
    (payload: SavePayload): void => {
      if (!baselineRef.current) return;
      const nextBaseline = { ...baselineRef.current };
      for (const k of Object.keys(payload)) {
        (nextBaseline as any)[k] = (payload as any)[k];
      }
      baselineRef.current = nextBaseline;
      dispatch({ type: "UPDATE_BASELINE", baseline: nextBaseline });
      logger.debug("Baseline updated after success", nextBaseline);
    },
    [logger]
  );

  // Clear undo affected fields after successful save
  useEffect(() => {
    if (state.lastError || state.isSaving) return;

    if (lastOpRef.current === "undo" || lastOpRef.current === "redo") {
      setTimeout(() => {
        undoAffectedFieldsRef.current.clear();
        lastOpRef.current = null;
      }, 100);
    } else if (lastOpRef.current === null) {
      undoAffectedFieldsRef.current.clear();
    }
  }, [state.lastError, state.isSaving]);

  const composedTransport = useMemo((): Transport => {
    return async (payload, ctx) => {
      const start = performance.now();
      dispatch({ type: "SAVE_START" });

      try {
        let remainingPayload = { ...payload };

        // diffMap handling (list add/remove via callbacks)
        if (diffMap && Object.keys(diffMap).length > 0) {
          for (const [key, handler] of Object.entries(diffMap)) {
            if (!(key in payload)) continue;

            const prev = baselineRef.current?.[key] || [];
            const curr = (payload as any)[key] || [];

            if (!Array.isArray(prev) || !Array.isArray(curr)) continue;

            const prevIds = new Set(prev.map(handler.idOf));
            const currIds = new Set(curr.map(handler.idOf));

            const added = curr.filter(
              (x: any) => !prevIds.has(handler.idOf(x))
            );
            const removed = prev.filter(
              (x: any) => !currIds.has(handler.idOf(x))
            );

            logger.debug(`DiffMap for ${key}`, {
              baseline: prev.map(handler.idOf),
              current: curr.map(handler.idOf),
              added: added.map(handler.idOf),
              removed: removed.map(handler.idOf),
            });

            const ops: Array<() => Promise<void>> = [];
            for (const item of added)
              ops.push(() => Promise.resolve(handler.onAdd(item)));
            for (const item of removed)
              ops.push(() => Promise.resolve(handler.onRemove(item)));
            if (ops.length) await Promise.all(ops.map((fn) => fn()));

            delete (remainingPayload as any)[key];
          }
        }

        // Key transforms and mapping
        let finalPayload = remainingPayload;
        if (keyMap)
          finalPayload = mapKeys(finalPayload as any, keyMap) as SavePayload;
        if (mapPayload)
          finalPayload = mapPayload(finalPayload as any) as SavePayload;
        finalPayload = datesToIso(finalPayload);

        if (Object.keys(finalPayload).length === 0) {
          const duration = performance.now() - start;
          dispatch({ type: "SAVE_SUCCESS", duration });
          updateBaseline(payload);
          metrics.recordSave(duration, true);
          onSaved?.({ ok: true as const }, payload);
          // checkpoint on "no-op" payload still represents alignment with server
          if (undoEnabled && undoMgrRef.current) {
            undoMgrRef.current.markCheckpoint();
          }
          return { ok: true as const };
        }

        const result = await baseTransport(finalPayload, ctx);
        const duration = performance.now() - start;

        if (result.ok) {
          dispatch({ type: "SAVE_SUCCESS", duration });
          updateBaseline(payload);
          metrics.recordSave(duration, true);
          lastOpRef.current = null;
          undoAffectedFieldsRef.current.clear();
          if (undoEnabled && undoMgrRef.current) {
            undoMgrRef.current.markCheckpoint();
          }
          onSaved?.(result, payload);
        } else {
          dispatch({ type: "SAVE_ERROR", error: result.error, duration });
          metrics.recordSave(duration, false);
          onSaved?.(result, payload);
        }

        return result;
      } catch (e) {
        const duration = performance.now() - start;
        const err = e instanceof Error ? e : new Error(String(e));
        dispatch({ type: "SAVE_ERROR", error: err, duration });
        metrics.recordSave(duration, false);
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
    updateBaseline,
    undoEnabled,
  ]);

  const manager = useMemo(
    () =>
      new AutosaveManager(composedTransport, config.debounceMs || 600, logger),
    [composedTransport, config.debounceMs, logger]
  );

  /* ===================== Record user changes (idempotent) ===================== */
  useEffect(() => {
    if (!undoEnabled) {
      lastValuesRef.current = values;
      return;
    }

    // Skip recording while hydrating or applying history ops
    if (
      isHydratingRef.current ||
      suppressRecordRef.current === "undo" ||
      suppressRecordRef.current === "redo" ||
      suppressRecordRef.current === "hydrate"
    ) {
      suppressRecordRef.current = null;
      lastValuesRef.current = values;
      return;
    }
    noPendingGuardRef.current = false;

    const mgr = undoMgrRef.current!;
    const prev = lastValuesRef.current;
    const next = values;
    const patches = diffToPatches(prev, next, "");
    noPendingGuardRef.current = false;
    if (patches.length) {
      // De-dupe identical logical state (StrictMode)
      const nextSig = stableStringify(next as any);
      if (nextSig !== lastRecordedValuesSigRef.current) {
        mgr.clearFuture();
        mgr.record(patches);
        lastOpRef.current = "user";
        lastRecordedValuesSigRef.current = nextSig;
        noPendingGuardRef.current = false;
      }
    }
    lastValuesRef.current = next;
  }, [values, undoEnabled]);

  /* ================================ Debounced save ============================== */
  const debouncedSave = useCallback(
    (valuesArg: T, dirtyFieldsArg: any, forceAfterUndo = false) => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

      let basePayload: SavePayload;

      if (
        forceAfterUndo &&
        (lastOpRef.current === "undo" || lastOpRef.current === "redo")
      ) {
        basePayload = {};
        if (baselineRef.current) {
          for (const key of Object.keys(valuesArg)) {
            if (!deepEqual((valuesArg as any)[key], baselineRef.current[key])) {
              (basePayload as any)[key] = (valuesArg as any)[key];
            }
          }
        }
        logger.debug(
          "Building payload after undo/redo by comparing with baseline",
          {
            changedFields: Object.keys(basePayload),
          }
        );
      } else {
        const effectiveDirty = getEffectiveDirtyFields(dirtyFieldsArg);
        basePayload = selectPayload(valuesArg, effectiveDirty) as SavePayload;
      }

      pendingPayloadRef.current = basePayload;

      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const payloadToSave = { ...pendingPayloadRef.current };

          const okToSave =
            forceAfterUndo || Object.keys(payloadToSave).length > 0;
          if (!okToSave) {
            pendingPayloadRef.current = {};
            // If nothing to save and we're equal to baseline, drop pending immediately
            const snap = form.getValues();
            if (equalsBaseline(snap)) {
              historyPendingRef.current = false;
              noPendingGuardRef.current = true;
            }
            return;
          }

          if (Object.keys(payloadToSave).length === 0) {
            logger.debug("Skipping save - empty payload");
            pendingPayloadRef.current = {};
            const snap = form.getValues();
            if (equalsBaseline(snap)) {
              historyPendingRef.current = false;
              noPendingGuardRef.current = true;
            }
            return;
          }

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
              pendingPayloadRef.current = {};
              const snap = form.getValues();
              if (equalsBaseline(snap)) {
                historyPendingRef.current = false;
                noPendingGuardRef.current = true;
              }
              return;
            }
          }

          const sig = stableStringify(payloadToSave as any);
          if (sig === lastQueuedSigRef.current) {
            logger.debug("Skipping save - duplicate payload");
            pendingPayloadRef.current = {};
            const snap = form.getValues();
            if (equalsBaseline(snap)) {
              historyPendingRef.current = false;
              noPendingGuardRef.current = true;
            }
            return;
          }
          lastQueuedSigRef.current = sig;

          logger.debug("Queueing change after debounce", {
            payloadKeys: Object.keys(payloadToSave),
            isUndoRedo: forceAfterUndo,
            lastOp: lastOpRef.current,
          });

          manager.queueChange(payloadToSave);
          pendingPayloadRef.current = {};
          const result = await manager.flush();
          historyPendingRef.current = false;
          // UI no longer pending regardless of result for this history op
          historyPendingRef.current = false;
          const snapAfter = form.getValues();
          if (equalsBaseline(snapAfter)) {
            noPendingGuardRef.current = true; // ✅ NEW
          }
          if (result.ok && forceAfterUndo) {
            lastOpRef.current = null;
            undoAffectedFieldsRef.current.clear();
          }
        } catch {
          logger.error("Error in debounced save");
          pendingPayloadRef.current = {};
          historyPendingRef.current = false;
        }
      }, config.debounceMs || 600);
    },
    [
      selectPayload,
      validateBeforeSave,
      validationCache,
      validationStrategy,
      form,
      metrics,
      logger,
      manager,
      config.debounceMs,
      getEffectiveDirtyFields,
      equalsBaseline,
    ]
  );

  /* ============================== Main autosave effect ========================== */
  useEffect(() => {
    if (isHydratingRef.current) {
      logger.debug("Skipping save - hydrating from server");
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
      historyPendingRef.current = true;

      setTimeout(() => {
        const currentValues = form.getValues();
        const currentDirtyFields = form.formState.dirtyFields;
        debouncedSave(currentValues as T, currentDirtyFields, true);
      }, 10);
      return;
    }

    if (!isUndoRedo && hasUserChanges) {
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
    diffMap,
    logger,
    undoEnabled,
    ignoreHistoryOps,
    form,
  ]);

  // Clear caches when clean
  useEffect(() => {
    if (Object.keys(dirtyFields).length === 0 && !isDirty) {
      validationCache.clear();
      lastQueuedSigRef.current = "";
      pendingPayloadRef.current = {};
      undoAffectedFieldsRef.current.clear();
    }
  }, [dirtyFields, isDirty, validationCache]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      manager.abort();
    };
  }, [manager]);

  // Public API
  const undoAPI = useMemo(() => {
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
      undo: () => {
        undoAffectedFieldsRef.current.clear();
        suppressRecordRef.current = "undo";
        lastOpRef.current = "undo";

        if (!ignoreHistoryOps) historyPendingRef.current = true;

        const currentValues = form.getValues();
        const patches = diffToPatches(lastValuesRef.current, currentValues, "");
        for (const patch of patches) {
          undoAffectedFieldsRef.current.add(patch.name);
          if (patch.rootField)
            undoAffectedFieldsRef.current.add(patch.rootField);
        }

        mgr.undo();
        lastRecordedValuesSigRef.current = ""; // allow next real edit to record

        // If we're already back at baseline, clear pending immediately
        const afterVals = form.getValues();
        if (equalsBaseline(afterVals)) {
          historyPendingRef.current = false;
          noPendingGuardRef.current = true;
          lastRecordedValuesSigRef.current = stableStringify(afterVals as any);
        }

        if (!ignoreHistoryOps) {
          setTimeout(() => {
            const currentValuesAfter = form.getValues();
            const currentDirtyFields = form.formState.dirtyFields;
            debouncedSave(currentValuesAfter as T, currentDirtyFields, true);
          }, 100);
        }
      },
      redo: () => {
        undoAffectedFieldsRef.current.clear();
        suppressRecordRef.current = "redo";
        lastOpRef.current = "redo";

        if (!ignoreHistoryOps) historyPendingRef.current = true;

        mgr.redo();
        lastRecordedValuesSigRef.current = "";

        const afterVals = form.getValues();
        if (equalsBaseline(afterVals)) {
          historyPendingRef.current = false;
          lastRecordedValuesSigRef.current = stableStringify(afterVals as any);
        }

        if (!ignoreHistoryOps) {
          setTimeout(() => {
            const currentValuesAfter = form.getValues();
            const currentDirtyFields = form.formState.dirtyFields;
            debouncedSave(currentValuesAfter as T, currentDirtyFields, true);
          }, 100);
        }
      },
      undoLastSave: () => {
        suppressRecordRef.current = "undo";
        lastOpRef.current = "undo";
        if (!ignoreHistoryOps) historyPendingRef.current = true;
        mgr.undoToLastCheckpoint();
        if (!ignoreHistoryOps) {
          setTimeout(() => {
            const currentValuesAfter = form.getValues();
            const currentDirtyFields = form.formState.dirtyFields;
            debouncedSave(currentValuesAfter as T, currentDirtyFields, true);
          }, 100);
        }
      },
      canUndo: mgr.canUndo(),
      canRedo: mgr.canRedo(),
    };
  }, [undoEnabled, form, ignoreHistoryOps, debouncedSave, equalsBaseline]);

  const liveCanUndo = !!undoMgrRef.current?.canUndo();
  const liveCanRedo = !!undoMgrRef.current?.canRedo();

  const computedHasPending =
    !noPendingGuardRef.current && // ✅ NEW short-circuit
    (Object.keys(pendingPayloadRef.current).length > 0 ||
      !manager.isEmpty() ||
      (!ignoreHistoryOps && historyPendingRef.current) ||
      (() => {
        if (!baselineRef.current) return false; // avoid false positives
        const snap = form.getValues();
        return !equalsBaseline(snap);
      })());

  return {
    // Status
    isSaving: state.isSaving,
    lastError: state.lastError,
    metrics: state.metrics,

    // Pending
    hasPendingChanges: computedHasPending,

    // Actions
    flush: useCallback(async () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (Object.keys(pendingPayloadRef.current).length > 0) {
        manager.queueChange(pendingPayloadRef.current);
        pendingPayloadRef.current = {};
      }
      return manager.flush();
    }, [manager]),

    abort: useCallback(() => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      pendingPayloadRef.current = {};
      historyPendingRef.current = false;
      const snap = form.getValues();
      if (equalsBaseline(snap)) noPendingGuardRef.current = true;
      manager.abort();
      dispatch({ type: "ABORT" });
    }, [manager]),

    // Baseline (diffMap) helpers
    forceBaselineUpdate: useCallback(() => {
      const currentValues = form.getValues() as any;
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
      dispatch({ type: "INITIALIZE_BASELINE", baseline: currentValues });
      lastRecordedValuesSigRef.current = stableStringify(currentValues as any);
      logger.debug("Forced baseline update", currentValues);
    }, [form, logger]),

    getBaseline: useCallback(() => baselineRef.current, []),
    isBaselineInitialized: useCallback(
      () => isBaselineInitializedRef.current,
      []
    ),

    // Metrics / debug
    getMetrics: useCallback(() => metrics.getMetrics(), [metrics]),
    getCacheStats: useCallback(
      () => ({
        validationCacheSize: validationCache.size(),
        payloadCacheSize: payloadCache.size(),
      }),
      [validationCache, payloadCache]
    ),
    getPendingChanges: useCallback(() => {
      const reactPending = pendingPayloadRef.current;
      const managerPending = manager.getPendingChanges();
      return { ...reactPending, ...managerPending };
    }, [manager]),
    isEmpty: useCallback(() => {
      const reactPendingEmpty =
        Object.keys(pendingPayloadRef.current).length === 0;
      const managerEmpty = manager.isEmpty();
      return reactPendingEmpty && managerEmpty;
    }, [manager]),

    forceSave: useCallback(async () => {
      logger.debug("Force save requested");
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

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
        pendingPayloadRef.current = {};
        const res = await manager.flush();
        historyPendingRef.current = false;
        return res;
      }
      return { ok: true } as const;
    }, [logger, form, manager]),

    // Undo/redo
    undo: undoAPI.undo,
    redo: undoAPI.redo,
    undoLastSave: undoAPI.undoLastSave,
    canUndo: liveCanUndo,
    canRedo: liveCanRedo,

    // Hydrate safely from server
    hydrateFromServer: useCallback(
      (data: T) => {
        isHydratingRef.current = true;
        suppressRecordRef.current = "hydrate";

        form.reset(data as any, {
          keepDirty: false,
          keepTouched: false,
          keepValues: false,
        });

        baselineRef.current = { ...(data as any) };
        isBaselineInitializedRef.current = true;
        dispatch({ type: "INITIALIZE_BASELINE", baseline: data as any });

        if (undoMgrRef.current) undoMgrRef.current.clear();
        lastValuesRef.current = data;
        lastRecordedValuesSigRef.current = stableStringify(data as any);

        suppressRecordRef.current = null;
        Promise.resolve().then(() => {
          isHydratingRef.current = false;
        });
      },
      [form]
    ),
  } as const;
}
