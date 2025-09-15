"use client";

import { useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import {
  useAutosaveEngine,
  type AutosaveOptions,
  type SavePayload,
  type SaveResult,
} from "../../core/useAutosaveEngine";
import { pickChanged } from "../../utils/pickChanged";
import { mapKeys, type KeyMap } from "../../utils/mapKeys";
import { makeDebug } from "../../utils/debug";

/** RHF subset (avoid tight coupling to Control’s internals to reduce version drift). */
type FormSubset<T extends FieldValues> = {
  /** Watching values drives autosave; beware that `watch()` returns a fresh object each render. */
  watch: UseFormReturn<T>["watch"];
  /** We only need these formState bits to decide when to save. */
  formState: Pick<
    UseFormReturn<T>["formState"],
    "isDirty" | "isValid" | "dirtyFields" | "isValidating"
  >;
  reset: UseFormReturn<T>["reset"];
  getValues: UseFormReturn<T>["getValues"];
  trigger: UseFormReturn<T>["trigger"];
};

/** Diff handlers for array-like relations (e.g., sectors/tags). */
export type DiffHandler = {
  /** Provide a stable id extractor so we can compute add/remove diffs. */
  idOf: (item: any) => string | number;
  /** Called once per “added” item. */
  onAdd: (item: any) => Promise<void> | void;
  /** Called once per “removed” item. */
  onRemove: (item: any) => Promise<void> | void;
};

export type RhfAutosaveOptions<T extends FieldValues> = Omit<
  AutosaveOptions,
  "onSaved" | "transport"
> & {
  /** RHF form subset. */
  form: FormSubset<T>;
  /** Base transport (API call) for non-diff fields. */
  transport: AutosaveOptions["transport"];
  /** Select the payload to send (default: only dirty fields via pickChanged). */
  selectPayload?: (values: T, dirtyFields: any) => Partial<T>;
  /** Decide if we should attempt a save at all. */
  shouldSave?: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
  }) => boolean;
  /** Callback after save attempt (success/failure). */
  onSaved?: AutosaveOptions["onSaved"];
  /** Remap form keys to API keys (with optional value transforms). */
  keyMap?: KeyMap;
  /** Optional custom transform of the final payload (after keyMap). */
  mapPayload?: (payload: Record<string, any>) => Record<string, any>;
  /**
   * Validation strategy before queueing:
   *  - "payload" (default): validate only the fields in the outgoing payload
   *  - "all": validate entire form
   *  - "none": skip validation
   */
  validateBeforeSave?: "none" | "payload" | "all";
  /**
   * For array fields that require add/remove endpoints:
   * supply idOf/onAdd/onRemove, and we’ll call those instead of PATCHing the array.
   */
  diffMap?: Record<string, DiffHandler>;
  /** Force-enable/disable debug logs. Default: on in dev, off in prod. */
  debug?: boolean;
};

/** Stable (shallow) stringify to dedupe queued snapshots. */
function stableStringify(obj: Record<string, any>): string {
  const keys = Object.keys(obj).sort();
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

/**
 * Autosave hook for React Hook Form.
 *
 * - Debounced queueing via `useAutosaveEngine`
 * - Optional validation prior to queueing
 * - Key remapping + optional payload transformer
 * - Diff-aware handling for array relations (add/remove per item)
 *
 * ⚠️ Note: Using `form.watch()` as a dependency means the effect can run often,
 * because `watch()` returns a new object each render. This is intentional here,
 * but if you observe overly-frequent runs, consider driving from `formState`
 * and calling `form.getValues()` inside the effect instead.
 */
export function useRhfAutosave<T extends FieldValues>(
  opts: RhfAutosaveOptions<T>
) {
  const {
    form,
    transport: baseTransport,
    debounceMs,
    selectPayload = (values, dirty) =>
      pickChanged(values as any, dirty) as Partial<T>,
    shouldSave = ({ isDirty }) => !!isDirty,
    onSaved,
    keyMap,
    mapPayload,
    validateBeforeSave = "payload",
    diffMap,
    debug,
  } = opts;

  const dbg = makeDebug("rhf", debug);

  // ===== Effect inputs =====
  // Watch all values; this is convenient but can be chatty (see note in the JSDoc).
  const values = form.watch();
  const { isDirty, isValid, dirtyFields, isValidating } = form.formState;

  // ===== Diff-aware baseline management =====
  // Baseline holds the last-accepted snapshot used for computing add/remove diffs.
  const baselineRef = useRef<Record<string, any> | null>(null);
  const isBaselineInitializedRef = useRef<boolean>(false);

  // Initialize baseline ONLY when the form is clean (e.g., after initial load/reset).
  useEffect(() => {
    if (!diffMap) return;

    if (!isDirty && !isBaselineInitializedRef.current) {
      const currentValues = form.getValues() as any;
      dbg("Initializing baseline from clean form state:", currentValues);
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
    }
  }, [isDirty, diffMap, form, dbg]);

  // Allow re-initialization after a full reset (no dirty fields).
  useEffect(() => {
    if (!isDirty && Object.keys(dirtyFields).length === 0) {
      isBaselineInitializedRef.current = false;
    }
  }, [isDirty, dirtyFields]);

  // ===== Diff-aware composed transport =====
  // Wrap base transport to:
  //  - compute add/remove for diffMap fields
  //  - call onAdd/onRemove per item
  //  - strip those fields from the PATCH payload
  const composedTransport: AutosaveOptions["transport"] = async (
    payload
  ): Promise<SaveResult> => {
    const diffKeys = Object.keys(diffMap ?? {});
    const payloadCopy: Record<string, any> = { ...(payload || {}) };

    // Ensure we have a baseline for diff calculations
    if (!baselineRef.current) {
      dbg.warn("Baseline not initialized, using current form values");
      const currentValues = form.getValues() as any;
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
    }

    const ops: Array<() => Promise<void>> = [];

    for (const key of diffKeys) {
      if (!(key in payloadCopy)) continue;

      const handler = diffMap![key];
      const prev = baselineRef.current?.[key] || [];
      const curr = payloadCopy[key] || [];
      const idOf = handler.idOf;

      const prevArray = Array.isArray(prev) ? prev : [];
      const currArray = Array.isArray(curr) ? curr : [];

      dbg("Diff calculation:", key, {
        baseline: prevArray.map(idOf),
        current: currArray.map(idOf),
      });

      const prevIds = new Set(prevArray.map(idOf));
      const currIds = new Set(currArray.map(idOf));

      const added = currArray.filter((x) => !prevIds.has(idOf(x)));
      const removed = prevArray.filter((x) => !currIds.has(idOf(x)));

      dbg("Diff result:", key, {
        added: added.map(idOf),
        removed: removed.map(idOf),
      });

      for (const item of added) {
        ops.push(async () => {
          dbg("onAdd:", key, idOf(item));
          await handler.onAdd(item);
        });
      }
      for (const item of removed) {
        ops.push(async () => {
          dbg("onRemove:", key, idOf(item));
          await handler.onRemove(item);
        });
      }

      // Don't PATCH diff-managed fields; handled via their dedicated endpoints.
      delete payloadCopy[key];
    }

    // Execute diff ops first
    try {
      for (const run of ops) await run();
    } catch (e: any) {
      dbg.error("Diff ops failed:", e);
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    // Send remaining payload via base transport
    let baseRes: SaveResult = { ok: true };
    if (Object.keys(payloadCopy).length > 0) {
      try {
        baseRes = await baseTransport(payloadCopy);
      } catch (e: any) {
        dbg.error("Base transport failed:", e);
        return {
          ok: false,
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
    }

    // On success, accept the *current* payload into baseline so next diff is accurate.
    if (baseRes.ok) {
      const newBaseline = { ...(baselineRef.current || {}) };
      Object.keys(payload as any).forEach((key) => {
        if ((payload as any)[key] !== undefined) {
          newBaseline[key] = (payload as any)[key];
        }
      });
      baselineRef.current = newBaseline;
      dbg("Baseline updated after success:", newBaseline);
    }

    return baseRes;
  };

  // Queue-mode engine (debounced + single in-flight).
  const engine = useAutosaveEngine({
    transport: composedTransport,
    debounceMs,
    onSaved,
  });

  // ===== Queueing effect =====
  // Dedupe identical payloads and cache validation results by payload signature.
  const lastQueuedSigRef = useRef<string>("");
  const validationCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    // Avoid triggering while RHF is mid-validation.
    if (isValidating) return;

    // If using diffMap, wait for baseline to initialize once (post-reset/load).
    if (diffMap && !isBaselineInitializedRef.current) {
      dbg("Skipping save — baseline not initialized yet");
      return;
    }

    (async () => {
      // Caller decides whether we should attempt a save at all.
      if (!shouldSave({ values, isValid, isDirty })) return;

      // 1) Build base payload from current values + dirty field map.
      const base = selectPayload(values, dirtyFields) as SavePayload;
      if (Object.keys(base).length === 0) return;

      // 2) Apply key remapping + optional custom transform.
      const mapped = keyMap
        ? (mapKeys(base as any, keyMap) as SavePayload)
        : base;
      const finalPayload = mapPayload
        ? (mapPayload(mapped as any) as SavePayload)
        : mapped;

      // Signature used for de-dupe and validation caching.
      const sig = stableStringify(finalPayload as any);

      // 3) Validate before queueing (optional).
      if (validateBeforeSave !== "none") {
        const cached = validationCacheRef.current.get(sig);
        let ok = cached ?? false;

        if (cached === undefined) {
          ok =
            validateBeforeSave === "all"
              ? await form.trigger(undefined, { shouldFocus: false })
              : await form.trigger(Object.keys(finalPayload) as any, {
                  shouldFocus: false,
                });

          validationCacheRef.current.set(sig, ok);

          // Keep the cache a reasonable size.
          if (validationCacheRef.current.size > 50) {
            const entries = Array.from(
              validationCacheRef.current.entries()
            ).slice(-25);
            validationCacheRef.current = new Map(entries);
          }
        }

        if (!ok) return;
      }

      // 4) Prevent queueing the exact same payload twice in a row.
      if (sig === lastQueuedSigRef.current) return;
      lastQueuedSigRef.current = sig;

      // 5) Queue to engine (debounced).
      dbg("Queueing change:", finalPayload);
      engine.queueChange(finalPayload);
    })();
  }, [
    // Effect intentionally depends on the watched values (see note above).
    values,
    isDirty,
    isValid,
    isValidating,
    dirtyFields,
    engine,
    selectPayload,
    shouldSave,
    keyMap,
    mapPayload,
    validateBeforeSave,
    form,
    diffMap,
    dbg,
  ]);

  // Clear the validation de-dupe cache when form becomes fully clean (after reset).
  useEffect(() => {
    if (Object.keys(dirtyFields).length === 0) {
      validationCacheRef.current.clear();
      lastQueuedSigRef.current = "";
    }
  }, [dirtyFields]);

  return {
    isSaving: engine.isSaving,
    lastError: engine.lastError,
    flush: engine.flush,
    abort: engine.abort,
    /** Force the diff baseline to the current form values (call after form.reset on load). */
    forceBaselineUpdate: () => {
      const currentValues = form.getValues() as any;
      baselineRef.current = { ...currentValues };
      isBaselineInitializedRef.current = true;
      dbg("Baseline force-updated:", currentValues);
    },
    /** Inspect the current baseline (debug). */
    getBaseline: () => baselineRef.current,
    /** Has the baseline been initialized yet? */
    isBaselineInitialized: () => isBaselineInitializedRef.current,
  };
}
