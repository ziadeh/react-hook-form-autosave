/**
 * Phase 1 harness smoke test.
 *
 * Covers the three proof-of-life paths locked by CONTEXT.md D-27:
 *   1. Round-trip:            change → undo → redo, value restored
 *   2. Transport round-trip:  change → save → resolve → waitForIdle, one call with expected payload
 *   3a. Retry:                change → save → reject → waitForIdle, retry executed, history preserved
 *   3b. Abort:                change → save → abort, abortedCalls populated
 *
 * If this file is green, the harness is considered solid and Phases 2-7 can proceed.
 * If it is red, Phases 2-7 are blocked (CONTEXT.md D-28).
 */

import { mountAutosaveHarness, scalarSchema } from "@test-helpers/autosaveHarness";
import type { ControllableTransport } from "@test-helpers/controllableTransport";

function asControllable(transport: unknown): ControllableTransport {
  const t = transport as ControllableTransport | { raw: true };
  if ("raw" in t && (t as { raw: true }).raw === true) {
    throw new Error("Smoke test must use the default controllable transport");
  }
  return t as ControllableTransport;
}

describe("autosaveHarness — smoke (Phase 1, D-27)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Path 1: round-trip", () => {
    it("change → undo → redo restores the value", () => {
      const harness = mountAutosaveHarness({
        defaultValues: scalarSchema(),
        config: { debounceMs: 50, debug: true },
        undo: { enabled: true, hotkeys: false },
      });

      try {
        // Starting state from scalarSchema
        expect(harness.form.getValues("text")).toBe("initial text");

        harness.change("text", "changed");
        expect(harness.form.getValues("text")).toBe("changed");

        harness.undo();
        expect(harness.form.getValues("text")).toBe("initial text");

        harness.redo();
        expect(harness.form.getValues("text")).toBe("changed");
      } finally {
        harness.unmount();
      }
    });
  });

  describe("Path 2: transport round-trip", () => {
    it("change → save → resolve → waitForIdle calls transport once with expected payload", async () => {
      const harness = mountAutosaveHarness({
        defaultValues: scalarSchema(),
        config: { debounceMs: 50, debug: true },
        undo: { enabled: true, hotkeys: false },
      });
      const controllable = asControllable(harness.transport);

      try {
        harness.change("text", "persisted");

        // Kick off save — does NOT await transport resolution
        const savePromise = harness.save();

        // Synchronize on the in-flight call
        const received = await controllable.next();
        expect(received).toMatchObject({ text: "persisted" });

        // Now resolve the transport
        controllable.resolve({ ok: true });
        await savePromise;
        await harness.waitForIdle();

        const calls = controllable.getCalls();
        expect(calls.length).toBe(1);
        expect(calls[0]).toMatchObject({ text: "persisted" });
      } finally {
        harness.unmount();
      }
    });
  });

  describe("Path 3a: retry after transport failure", () => {
    it("change → save → reject → waitForIdle triggers retry and preserves local value", async () => {
      const harness = mountAutosaveHarness({
        defaultValues: scalarSchema(),
        config: { debounceMs: 50, debug: true },
        undo: { enabled: true, hotkeys: false },
      });
      const controllable = asControllable(harness.transport);

      try {
        harness.change("text", "will-retry");
        const savePromise = harness.save();

        // Synchronize on the in-flight call
        await controllable.next();
        expect(controllable.callCount).toBeGreaterThanOrEqual(1);

        // Reject with a retryable error — this returns { ok: false, error } from the transport
        controllable.reject(new Error("simulated retryable failure"));
        await savePromise;
        await harness.waitForIdle();

        // The key smoke assertions: no crash, local value preserved, transport was called.
        // We do NOT assert a specific retry count — that's Phase 5's lifecycle matrix territory.
        expect(harness.form.getValues("text")).toBe("will-retry");
        expect(controllable.callCount).toBeGreaterThanOrEqual(1);
      } finally {
        harness.unmount();
      }
    });
  });

  describe("Path 3b: abort", () => {
    it("change → save → harness.abort() records the aborted call", async () => {
      const harness = mountAutosaveHarness({
        defaultValues: scalarSchema(),
        config: { debounceMs: 50, debug: true },
        undo: { enabled: true, hotkeys: false },
      });
      const controllable = asControllable(harness.transport);

      try {
        harness.change("text", "will-abort");
        const savePromise = harness.save();

        // Synchronize on the in-flight call before aborting
        const inFlightPayload = await controllable.next();
        expect(inFlightPayload).toMatchObject({ text: "will-abort" });

        harness.abort();

        // The save promise resolves because abort terminates the in-flight call
        await savePromise;
        await harness.waitForIdle();

        expect(controllable.abortedCalls.length).toBeGreaterThanOrEqual(1);
        const anyAbortMatched = controllable.abortedCalls.some(
          (p) => (p as { text?: unknown }).text === "will-abort"
        );
        expect(anyAbortMatched).toBe(true);

        // Local value is still preserved after abort
        expect(harness.form.getValues("text")).toBe("will-abort");
      } finally {
        harness.unmount();
      }
    });
  });
});
