/**
 * Unit tests for createControllableTransport — the dev-only imperative
 * transport primitive used by the autosave harness (Plan 03) and every
 * matrix test in Phases 2-7.
 *
 * These tests prove the primitive works **in isolation**, independent of
 * the harness. If Plan 04's smoke test or a later matrix test goes red,
 * Phase 1 can triage by running this file first: if these pass, the
 * transport is correct and the bug lives elsewhere.
 *
 * Intentionally uses the `@test-helpers/*` alias (proves the alias from
 * Plan 01 works) and does NOT use fake timers — every assertion is
 * microtask-deterministic.
 */

import {
  createControllableTransport,
  type ControllableTransport,
} from "@test-helpers/controllableTransport";
import type { Transport } from "../../../src/core/types";

describe("createControllableTransport", () => {
  it("transport(payload) returns an unresolved promise until resolve() is called", async () => {
    const controllable: ControllableTransport = createControllableTransport();

    const p = controllable.transport({ name: "Alice" });

    expect(controllable.pending).toBe(true);
    expect(controllable.callCount).toBe(1);

    // Microtask sentinel: if `p` were already settled, Promise.race would pick
    // whichever microtask won; since `p` is genuinely pending, `SENTINEL` wins.
    const raced = await Promise.race([p, Promise.resolve("SENTINEL" as const)]);
    expect(raced).toBe("SENTINEL");

    controllable.resolve({ ok: true });

    const result = await p;
    expect(result).toEqual({ ok: true });
    expect(controllable.pending).toBe(false);
  });

  it("reject(error) resolves with { ok: false, error } — does NOT throw", async () => {
    const controllable = createControllableTransport();

    const p = controllable.transport({ name: "Bob" });
    const boom = new Error("boom");
    controllable.reject(boom);

    const result = await p;
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe(boom);
      expect(result.error.message).toBe("boom");
    }
    expect(controllable.pending).toBe(false);
    // Reject is NOT abort — abortedCalls stays empty.
    expect(controllable.abortedCalls.length).toBe(0);
  });

  it("abort() resolves with { ok: false, error: Error('aborted') } and records the payload in abortedCalls", async () => {
    const controllable = createControllableTransport();

    const payload = { x: 1 };
    const p = controllable.transport(payload);
    controllable.abort();

    const result = await p;
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.message).toBe("aborted");
    }
    expect(controllable.abortedCalls.length).toBe(1);
    expect(controllable.abortedCalls[0]).toEqual({ x: 1 });
    expect(controllable.pending).toBe(false);
  });

  it("next() resolves immediately when a call is already pending", async () => {
    const controllable = createControllableTransport();

    // Start the call first — do NOT await; the transport promise stays pending.
    void controllable.transport({ name: "Bob" });

    const seen = await controllable.next();
    expect(seen).toEqual({ name: "Bob" });
    expect(controllable.pending).toBe(true);
  });

  it("next() awaits when no call is pending yet", async () => {
    const controllable = createControllableTransport();

    // Start awaiting BEFORE any transport() call.
    const pending = controllable.next();

    // Kick off the transport call on the next microtask.
    void Promise.resolve().then(() => {
      void controllable.transport({ name: "Carol" });
    });

    const seen = await pending;
    expect(seen).toEqual({ name: "Carol" });
  });

  it("sequential calls work — resolve one, then resolve the next", async () => {
    const controllable = createControllableTransport();

    const pA = controllable.transport({ id: 1 });
    controllable.resolve({ ok: true });
    const rA = await pA;
    expect(rA).toEqual({ ok: true });

    const pB = controllable.transport({ id: 2 });
    controllable.resolve({ ok: true, version: "v2" });
    const rB = await pB;
    expect(rB).toEqual({ ok: true, version: "v2" });

    expect(controllable.callCount).toBe(2);
    expect(controllable.getCalls()).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("resolve/reject/abort are no-ops when no call is pending", () => {
    const controllable = createControllableTransport();

    expect(() => controllable.resolve({ ok: true })).not.toThrow();
    expect(() => controllable.reject(new Error("x"))).not.toThrow();
    expect(() => controllable.abort()).not.toThrow();

    expect(controllable.pending).toBe(false);
    expect(controllable.callCount).toBe(0);
    expect(controllable.abortedCalls.length).toBe(0);
  });

  it("getCalls() returns a snapshot (mutating the returned array does not affect internal state)", async () => {
    const controllable = createControllableTransport();

    const p1 = controllable.transport({ step: 1 });
    controllable.resolve({ ok: true });
    await p1;

    const snapshot = controllable.getCalls();
    try {
      (snapshot as unknown as SavePayloadMutable[]).push({ fake: true });
    } catch {
      // Frozen arrays throw on push — that's fine; either behavior proves isolation.
    }

    const p2 = controllable.transport({ step: 2 });
    controllable.resolve({ ok: true });
    await p2;

    // getCalls() must reflect exactly the 2 real calls, not 3 — proves the
    // returned array is a defensive copy, not a live reference.
    expect(controllable.getCalls()).toEqual([{ step: 1 }, { step: 2 }]);
    expect(controllable.callCount).toBe(2);
  });

  it("transport is type-compatible with Transport from src/core/types", () => {
    const controllable = createControllableTransport();
    // Compile-time assertion: if this assignment type-checks, the primitive
    // is a drop-in for any `Transport` the hook or test expects.
    const t: Transport = controllable.transport;
    expect(typeof t).toBe("function");
  });
});

// Helper type local to the snapshot-isolation test — we deliberately cast
// the readonly array to a mutable shape to try to mutate it.
type SavePayloadMutable = Record<string, unknown>;
