import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The payload you send to your transport (API) function.
 * Typically a subset of changed form values.
 */
export type SavePayload = Record<string, unknown>;

/**
 * Result contract your transport must return.
 * - ok: true  → success (optional version string for optimistic UI)
 * - ok: false → failure with an Error
 */
export type SaveResult =
  | { ok: true; version?: string }
  | { ok: false; error: Error };

/**
 * Your save function (API call).
 * You may optionally support an AbortSignal (e.g. to cancel fetch).
 */
export type Transport = (
  payload: SavePayload,
  ctx?: { signal?: AbortSignal }
) => Promise<SaveResult>;

/**
 * Options for the autosave engine:
 * - transport: the async save function
 * - debounceMs: delay before sending (coalesces bursts of edits)
 * - onSaved: callback after each save attempt (success/failure)
 */
export type AutosaveOptions = {
  transport: Transport;
  debounceMs?: number; // default 600
  onSaved?: (res: SaveResult, payload: SavePayload) => void;
};

/** Local engine state exposed to consumers. */
type State = { isSaving: boolean; lastError: Error | null };

/**
 * A tiny, framework-agnostic autosave engine hook.
 *
 * It batches incoming changes (via `queueChange`) and, after a debounce,
 * sends a single request. While a request is in flight, new changes are
 * coalesced and scheduled to run once more when the current request finishes.
 *
 * Key properties:
 * - Debounced sends (prevents spamming the server)
 * - Single in-flight request (no overlapping saves)
 * - “Run again after finish” logic if more edits came during the save
 * - Re-queues failed payloads so they retry on the next tick
 */
export function useAutosaveEngine(opts: AutosaveOptions) {
  const { transport, debounceMs = 600, onSaved } = opts;

  // Public state
  const [state, setState] = useState<State>({
    isSaving: false,
    lastError: null,
  });

  // Accumulates deltas since the last scheduled/actual send.
  const pendingRef = useRef<SavePayload>({});

  // Debounce timer for the next send.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True while a save request is in progress.
  const inflightRef = useRef(false);

  // If true, run one more save after the current request completes.
  const rerunRef = useRef(false);

  // Prevent state updates after unmount.
  const mountedRef = useRef(true);

  // Cleanup on unmount: cancel timers and stop state updates.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * (Re)schedule a debounced flush.
   * Any new `queueChange` calls will keep pushing this out to coalesce edits.
   */
  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), debounceMs);
  }, [debounceMs]);

  /**
   * Queue a change (merge into the pending payload) and debounce a send.
   * Subsequent calls merge into the same object, so later field edits override earlier ones.
   */
  const queueChange = useCallback(
    (delta: SavePayload) => {
      pendingRef.current = { ...pendingRef.current, ...delta };
      schedule();
    },
    [schedule]
  );

  /**
   * Immediately attempt to send the pending payload (if any).
   * Respect the single in-flight request rule. If a request is running,
   * mark `rerunRef` so we run *once more* after it completes.
   */
  const flush = useCallback(async () => {
    // Nothing to send → bail
    if (!pendingRef.current || Object.keys(pendingRef.current).length === 0)
      return;

    // A request is already in flight → request a rerun and bail
    if (inflightRef.current) {
      rerunRef.current = true;
      return;
    }

    // Take a snapshot and clear pending.
    // Edits that arrive during the request will be merged into a fresh pendingRef.
    const payload = pendingRef.current;
    pendingRef.current = {};

    inflightRef.current = true;
    setState((s) => ({ ...s, isSaving: true, lastError: null }));

    try {
      // NOTE: you can add an AbortController here if you decide to support cancellation.
      const res = await transport(payload);
      if (!mountedRef.current) return;

      setState((s) => ({
        ...s,
        isSaving: false,
        lastError: res.ok ? null : (res as any).error || null,
      }));

      onSaved?.(res, payload);
    } catch (e: any) {
      // Network/transport failure → expose error and re-queue the payload to try later
      if (!mountedRef.current) return;

      setState((s) => ({ ...s, isSaving: false, lastError: e }));

      // Merge failed snapshot back with any newer edits.
      pendingRef.current = { ...payload, ...pendingRef.current };
    } finally {
      inflightRef.current = false;

      // If more changes landed while we were saving, schedule one more send (debounced).
      if (rerunRef.current) {
        rerunRef.current = false;
        schedule();
      }
    }
  }, [transport, onSaved, schedule]);

  /**
   * Cancel any scheduled/debounced send and clear the pending payload.
   * This does not abort an in-flight request (engine is queue-mode, not cancel-mode).
   * If you need true cancellation, extend `transport` to accept AbortSignal
   * and track a controller here.
   */
  const abort = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = {};
    rerunRef.current = false;
  }, []);

  return {
    queueChange, // merge and debounce
    flush, // try to send now (still respects in-flight rule)
    abort, // drop pending work and timers
    isSaving: state.isSaving,
    lastError: state.lastError,
  };
}
