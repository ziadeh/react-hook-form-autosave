/**
 * Controllable Transport — dev-only test primitive.
 *
 * Unlike `createMockTransport` in `src/testing/testUtils.ts`, which is *scripted*
 * (responses handed up-front, auto-popped per call), this primitive is *imperative*:
 * the test kicks off `harness.save()`, then decides moment-by-moment whether to
 * `resolve()`, `reject()`, or `abort()` the in-flight call. This is the only way
 * matrix tests can deterministically script "transport is in-flight right now;
 * undo() is called before deciding what happens next" scenarios (SAVE-01..06).
 *
 * This file is **dev-only**. It lives under `tests/helpers/` — never bundled,
 * never shipped, never imported from `src/`. Per CONTEXT.md D-10, `src/testing/`
 * is not touched, extended, wrapped, or deprecated. Two transports coexist:
 * the published scripted mock and this controllable primitive.
 *
 * Contract: the exported `transport` function is a drop-in `Transport` from
 * `src/core/types.ts`. Failures are returned as `{ ok: false, error }` SaveResults,
 * NOT thrown — the retry loop in `src/core/autosave.ts` expects discriminated
 * unions, not rejected promises.
 */

import type {
  Transport,
  SavePayload,
  SaveResult,
  SaveContext,
} from "../../src/core/types";

export interface ControllableCall {
  payload: SavePayload;
  context: SaveContext | undefined;
  aborted: boolean;
}

export interface ControllableTransport {
  /** The Transport function itself — pass this to useRhfAutosave's `transport` option. */
  transport: Transport;

  /**
   * Awaits the next incoming save call. Resolves to the payload that was passed
   * to the transport. If a call is already pending and unresolved, this resolves
   * immediately with that payload. If no call has arrived yet, this resolves
   * when one does.
   */
  next(): Promise<SavePayload>;

  /** Resolve the currently pending call with a SaveResult. No-op if no call is pending. */
  resolve(result: SaveResult): void;

  /**
   * Reject the currently pending call by resolving it with `{ ok: false, error }`.
   * Does NOT throw — the retry loop in `src/core/autosave.ts` expects a
   * `SaveResult`-shaped failure, not a rejected promise.
   */
  reject(error: Error): void;

  /**
   * Abort the currently pending call. Marks it as aborted (pushed into
   * `abortedCalls`), resolves the transport promise with
   * `{ ok: false, error: new Error("aborted") }`.
   */
  abort(): void;

  /** True when a transport call is in flight and awaiting resolve/reject/abort. */
  readonly pending: boolean;

  /** Total number of calls the transport has received (resolved + rejected + pending). */
  readonly callCount: number;

  /** Snapshot of every payload the transport has received, in order. */
  getCalls(): readonly SavePayload[];

  /** Snapshot of every payload that was aborted via `abort()`. */
  readonly abortedCalls: readonly SavePayload[];
}

/**
 * Create a new controllable transport. Every call creates an isolated state —
 * no shared module-level state, safe to call once per test.
 */
export function createControllableTransport(): ControllableTransport {
  type Deferred = {
    payload: SavePayload;
    context: SaveContext | undefined;
    resolve: (result: SaveResult) => void;
  };

  const calls: SavePayload[] = [];
  const aborted: SavePayload[] = [];
  let current: Deferred | null = null;
  let nextWaiter: ((payload: SavePayload) => void) | null = null;

  const transport: Transport = (payload, context) => {
    calls.push(payload);
    return new Promise<SaveResult>((resolvePromise) => {
      current = { payload, context, resolve: resolvePromise };
      // Wake up any pending next() caller
      if (nextWaiter) {
        const waiter = nextWaiter;
        nextWaiter = null;
        waiter(payload);
      }
    });
  };

  const api: ControllableTransport = {
    transport,

    next(): Promise<SavePayload> {
      // If a call is already pending, resolve with its payload immediately.
      if (current !== null) {
        return Promise.resolve(current.payload);
      }
      // Otherwise, await the next incoming transport() call.
      return new Promise<SavePayload>((resolveNext) => {
        nextWaiter = resolveNext;
      });
    },

    resolve(result: SaveResult): void {
      if (current === null) return;
      // Null out BEFORE dispatching so the resolver callback can synchronously
      // trigger another transport() without hitting an inconsistent state.
      const deferred = current;
      current = null;
      deferred.resolve(result);
    },

    reject(error: Error): void {
      if (current === null) return;
      const deferred = current;
      current = null;
      // Return a SaveResult-shaped failure, NOT Promise.reject — the retry loop
      // expects discriminated unions, not thrown exceptions.
      deferred.resolve({ ok: false, error });
    },

    abort(): void {
      if (current === null) return;
      const deferred = current;
      current = null;
      aborted.push(deferred.payload);
      deferred.resolve({ ok: false, error: new Error("aborted") });
    },

    get pending(): boolean {
      return current !== null;
    },

    get callCount(): number {
      return calls.length;
    },

    getCalls(): readonly SavePayload[] {
      // Return a shallow copy so callers cannot mutate internal state.
      return calls.slice();
    },

    get abortedCalls(): readonly SavePayload[] {
      // Return a shallow copy so callers cannot mutate internal state.
      return aborted.slice();
    },
  };

  return api;
}
