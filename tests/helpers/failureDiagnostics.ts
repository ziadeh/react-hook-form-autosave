/**
 * Failure diagnostics for the autosave test harness.
 *
 * Per CONTEXT.md D-25/D-26: matrix tests must automatically dump captured
 * harness logs to stderr when a test fails, with zero per-test opt-in.
 *
 * Mechanism: a once-per-file `afterEach` hook reads
 * `expect.getState().suppressedErrors` (stable Jest public API since v27;
 * still exposed in Jest 30 which this project uses) and, if non-empty,
 * iterates every registered harness instance and prints its captured log
 * buffer. The registry is cleared after every test so state never leaks
 * between tests.
 *
 * The module is defensive: if `expect.getState()` is not available (e.g. the
 * file is imported outside Jest), installation silently no-ops.
 *
 * Dev-only: lives under `tests/helpers/`, never bundled.
 */

import type { LogEntry } from "./logCapture";

export interface HarnessInstance {
  id: string;
  getLogs(): readonly LogEntry[];
}

// Module-level state. Jest runs each test file in its own module registry by
// default, so this state is automatically scoped to the current test file.
const registered = new Set<HarnessInstance>();
let installed = false;

/**
 * Register a harness instance for failure diagnostics. Lazily installs a single
 * `afterEach` hook on first call — subsequent calls only add to the registry.
 *
 * The installed `afterEach` hook reads `expect.getState().suppressedErrors`:
 * if non-empty, the current test had a failed expectation, and the hook
 * dumps every registered harness's captured logs to `console.error`.
 */
export function registerHarnessInstance(instance: HarnessInstance): void {
  installFailureDiagnostics();
  registered.add(instance);
}

/**
 * Explicitly install the `afterEach` hook. Safe to call repeatedly — installs
 * only once. Exposed so tests can assert the hook has been installed without
 * mounting a full harness.
 */
export function installFailureDiagnostics(): void {
  if (installed) return;
  if (typeof afterEach !== "function") {
    // Not running under Jest — no-op. (Keeps `installed` false so a later
    // call from inside a Jest context can still install.)
    return;
  }
  installed = true;
  afterEach(() => {
    try {
      // Jest 27+: `expect.getState()` is stable public API; `suppressedErrors`
      // is populated by failing asserts that were caught and re-thrown by the
      // matcher system. Jest 30 (this project's current version) continues
      // to expose it. Reference: https://jestjs.io/docs/expect#expectgetstate
      const globalExpect = (globalThis as { expect?: unknown }).expect;
      const getState =
        globalExpect &&
        typeof (globalExpect as { getState?: unknown }).getState === "function"
          ? (globalExpect as { getState: () => unknown }).getState
          : null;

      const state = getState
        ? (getState() as {
            suppressedErrors?: unknown[];
            currentTestName?: string;
          })
        : null;

      const failed =
        state !== null &&
        Array.isArray(state.suppressedErrors) &&
        state.suppressedErrors.length > 0;

      if (failed) {
        const testName = state?.currentTestName ?? "(unknown test)";
        for (const inst of registered) {
          const logs = inst.getLogs();
          // eslint-disable-next-line no-console
          console.error(
            `\n=== harness[${inst.id}] captured ${logs.length} log entries during failed test: ${testName} ===`
          );
          for (const entry of logs) {
            const prefix = `[${entry.level}][${entry.namespace}]`;
            const meta =
              entry.meta !== undefined ? ` ${JSON.stringify(entry.meta)}` : "";
            const err = entry.error ? ` ERROR: ${entry.error.message}` : "";
            // eslint-disable-next-line no-console
            console.error(`${prefix} ${entry.message}${meta}${err}`);
          }
          // eslint-disable-next-line no-console
          console.error(`=== end harness[${inst.id}] logs ===\n`);
        }
      }
    } finally {
      // Always clear the registry after each test so state doesn't leak
      // between tests. Tests that mount multiple harnesses get a clean slate
      // for the next test regardless of pass/fail.
      registered.clear();
    }
  });
}

/** Test-only helper: reset the module's internal state. */
export function __resetFailureDiagnostics(): void {
  registered.clear();
  installed = false;
}
