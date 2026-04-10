/**
 * mountAutosaveHarness — the opinionated test harness for the undo/redo
 * reliability milestone. Single entry point used by every Phases 2–7 matrix
 * test to drive `useRhfAutosave` deterministically.
 *
 * Responsibilities:
 *   - Mount the hook via `renderHook` with a default `createControllableTransport`
 *     or a caller-supplied transport (Phase 7).
 *   - Wrap every change/undo/redo/save/abort/hydrate call in `act()` so matrix
 *     tests never import `act` themselves.
 *   - Intercept `console.*` for the harness lifetime and capture library log
 *     lines (`[autosave:xxx]` prefix) into an in-memory `LogEntry[]` buffer;
 *     `failureDiagnostics.ts` dumps them to stderr on failure — zero opt-in.
 *   - Expose timing helpers that cooperate with Jest fake timers.
 *   - Expose history inspection without touching `Patch` internals (D-15/D-16).
 *
 * Dev-only: lives under `tests/helpers/`, never bundled. Public surface is
 * locked by CONTEXT.md D-06 — any shape change is a test-only contract break.
 */

import {
  act,
  renderHook,
  type RenderHookResult,
} from "@testing-library/react";
import {
  useForm,
  type FieldValues,
  type UseFormReturn,
  type Path,
  type PathValue,
} from "react-hook-form";

import { useRhfAutosave } from "../../src/adapters/rhf/useRhfAutosave";
import type { AutosaveReturn, Patch } from "../../src/adapters/rhf/utils/types";
import type { Transport } from "../../src/core/types";

import {
  createControllableTransport,
  type ControllableTransport,
} from "./controllableTransport";
import {
  registerHarnessInstance,
  type HarnessInstance,
} from "./failureDiagnostics";
import type { LogEntry } from "./logCapture";

// Re-export the canonical schema factories so matrix tests can do:
//   import { mountAutosaveHarness, scalarSchema } from "@test-helpers/autosaveHarness";
export {
  scalarSchema,
  nestedSchema,
  primitiveArraySchema,
  fieldArraySchema,
  type ScalarSchemaValues,
  type NestedSchemaValues,
  type PrimitiveArraySchemaValues,
  type FieldArraySchemaValues,
} from "./schemas";

/* ============================= Public Types ============================= */

export interface HarnessOptions<T extends FieldValues> {
  defaultValues: T;
  transport?: Transport;
  config?: { debounceMs?: number; debug?: boolean };
  undo?: { enabled?: boolean; hotkeys?: boolean; ignoreHistoryOps?: boolean };
  validateBeforeSave?: "none" | "payload" | "all";
  /**
   * Enable `useRhfAutosave`'s built-in auto-hydration detection. Defaults to
   * `false` in the harness because the auto-hydration effect in
   * `useAutosaveEffects` clears undo/redo history whenever the form becomes
   * clean — which happens every time an `undo()` returns the form to its
   * baseline values. Matrix tests that need to exercise hydration drive it
   * explicitly via `harness.hydrate(values)` (CONTEXT.md D-06). Tests that
   * specifically want to cover the auto-hydration path (HYD-01..04) can
   * opt in by passing `autoHydrate: true`.
   */
  autoHydrate?: boolean;
}

/**
 * Structural snapshot of the harness's undo/redo stacks.
 *
 * NOTE: `past[i]` and `future[i]` entries are length-carrier placeholders,
 * not real `Patch[]` values — the underlying `InternalUndoManager` does not
 * publicly expose its internal stacks. Tests assert on `past.length` and
 * `future.length` (which are derived from walking `canUndo`/`canRedo`) and
 * on `baseline` identity. Per CONTEXT.md D-16, tests that need patch-level
 * internals must use `expectValueAt` instead.
 */
export interface HarnessHistorySnapshot {
  past: readonly (readonly Patch[])[];
  future: readonly (readonly Patch[])[];
  baseline: unknown;
}

type HarnessRenderValue<T extends FieldValues> = {
  form: UseFormReturn<T>;
  autosave: AutosaveReturn;
};

export interface AutosaveHarness<T extends FieldValues> {
  // Change helpers
  change(path: string, value: unknown): void;
  addItem(path: string, value: unknown): void;
  removeItem(path: string, index: number): void;
  reorderItem(path: string, from: number, to: number): void;

  // History controls
  undo(): void;
  redo(): void;

  // Save lifecycle
  save(): Promise<void>;
  abort(): void;
  retry(): Promise<void>;

  // Hydration
  hydrate(values: T): Promise<void>;

  // Timing
  waitForIdle(): Promise<void>;
  flushDebounce(): Promise<void>;
  waitForSave(): Promise<void>;

  // History inspection
  getHistory(): HarnessHistorySnapshot;
  expectValueAt(step: number): unknown;

  // Diagnostics
  getLogs(): readonly LogEntry[];

  // Escape hatches
  form: UseFormReturn<T>;
  autosave: AutosaveReturn;
  transport: ControllableTransport | { transport: Transport; raw: true };
  result: RenderHookResult<HarnessRenderValue<T>, unknown>;

  unmount(): void;
}

/* ============================= Internals ============================= */

let instanceCounter = 0;

/**
 * Mount an opinionated `useRhfAutosave` harness. See the file-level comment
 * for the full contract; see CONTEXT.md D-05/D-06 for the decision record.
 */
export function mountAutosaveHarness<T extends FieldValues>(
  opts: HarnessOptions<T>
): AutosaveHarness<T> {
  const id = `h${++instanceCounter}`;
  const debounceMs = opts.config?.debounceMs ?? 50;
  const debug = opts.config?.debug ?? true;

  // -------- 1. Transport wiring --------
  const controllable: ControllableTransport | null =
    opts.transport === undefined ? createControllableTransport() : null;
  const transportFn: Transport = controllable
    ? controllable.transport
    : (opts.transport as Transport);

  // -------- 2. Console interceptor for log capture --------
  const capturedLogs: LogEntry[] = [];
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  // Library logs follow `[autosave:ns]` (string), message, meta|error, [meta].
  // See src/utils/logger.ts ConsoleLogger for the wire format. `error()` packs
  // error at args[2] and meta at args[3]; other levels pack meta at args[2].
  const makeInterceptor = (
    level: LogEntry["level"],
    originalFn: (...args: unknown[]) => void
  ) => {
    return (...args: unknown[]): void => {
      const first = typeof args[0] === "string" ? args[0] : "";
      const match = /^\[autosave:([^\]]+)\]$/.exec(first);
      if (match) {
        const message =
          typeof args[1] === "string" ? args[1] : String(args[1] ?? "");
        const third = args[2];
        const fourth = args[3];
        if (third instanceof Error) {
          capturedLogs.push({
            level,
            namespace: match[1],
            message,
            meta: fourth,
            error: third,
            timestamp: Date.now(),
          });
        } else {
          capturedLogs.push({
            level,
            namespace: match[1],
            message,
            meta: third,
            timestamp: Date.now(),
          });
        }
      }
      // Forward to original so Jest reporters can still see noisy logs.
      originalFn.apply(console, args);
    };
  };

  console.debug = makeInterceptor(
    "debug",
    originalConsole.debug as (...args: unknown[]) => void
  ) as typeof console.debug;
  console.info = makeInterceptor(
    "info",
    originalConsole.info as (...args: unknown[]) => void
  ) as typeof console.info;
  console.warn = makeInterceptor(
    "warn",
    originalConsole.warn as (...args: unknown[]) => void
  ) as typeof console.warn;
  console.error = makeInterceptor(
    "error",
    originalConsole.error as (...args: unknown[]) => void
  ) as typeof console.error;

  // -------- 3. Mount the hook --------
  // Default autoHydrate to false: the hydration-detection effect in
  // useAutosaveEffects treats any transition to a clean form with changed
  // values as a hydration, which clears redo history the moment an undo()
  // returns to baseline. Matrix tests drive hydration explicitly via
  // harness.hydrate(). Tests that need the auto-hydration path opt in.
  const autoHydrate = opts.autoHydrate ?? false;
  const renderResult: RenderHookResult<HarnessRenderValue<T>, unknown> =
    renderHook<HarnessRenderValue<T>, unknown>(() => {
      const form = useForm<T>({ defaultValues: opts.defaultValues as never });
      const autosave = useRhfAutosave<T>({
        form,
        transport: transportFn,
        config: { debounceMs, debug },
        validateBeforeSave: opts.validateBeforeSave ?? "none",
        autoHydrate,
        undo: {
          enabled: opts.undo?.enabled ?? true,
          hotkeys: opts.undo?.hotkeys ?? false,
          ignoreHistoryOps: opts.undo?.ignoreHistoryOps ?? false,
        },
      });
      return { form, autosave };
    });

  // -------- 4. Register for failure diagnostics --------
  const instance: HarnessInstance = {
    id,
    getLogs: () => capturedLogs.slice(),
  };
  registerHarnessInstance(instance);

  // -------- 5. Helper closures over the hook result --------

  const getForm = (): UseFormReturn<T> => renderResult.result.current.form;
  const getAutosave = (): AutosaveReturn =>
    renderResult.result.current.autosave;

  const readArrayAt = (path: string): unknown[] => {
    const current = getForm().getValues(path as Path<T>);
    if (!Array.isArray(current)) {
      throw new Error(
        `harness: expected array at path "${path}", got ${typeof current}`
      );
    }
    return current.slice();
  };

  const setArrayAt = (path: string, next: unknown[]): void => {
    getForm().setValue(path as Path<T>, next as PathValue<T, Path<T>>, {
      shouldDirty: true,
    });
  };

  const change = (path: string, value: unknown): void => {
    act(() => {
      getForm().setValue(path as Path<T>, value as PathValue<T, Path<T>>, {
        shouldDirty: true,
      });
    });
  };

  const addItem = (path: string, value: unknown): void => {
    act(() => {
      const next = readArrayAt(path);
      next.push(value);
      setArrayAt(path, next);
    });
  };

  const removeItem = (path: string, index: number): void => {
    act(() => {
      const next = readArrayAt(path);
      next.splice(index, 1);
      setArrayAt(path, next);
    });
  };

  const reorderItem = (path: string, from: number, to: number): void => {
    act(() => {
      const next = readArrayAt(path);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setArrayAt(path, next);
    });
  };

  const undo = (): void => {
    act(() => {
      getAutosave().undo?.();
    });
  };

  const redo = (): void => {
    act(() => {
      getAutosave().redo?.();
    });
  };

  // save() returns a promise that stays pending until the test drives the
  // controllable transport. `forceSave()` awaits `manager.flush()` which
  // awaits the transport. Canonical caller pattern:
  //   const p = harness.save();
  //   await controllable.next();
  //   controllable.resolve({ ok: true });
  //   await p;
  // Awaiting p before resolving the controllable deadlocks — load-bearing.
  const save = (): Promise<void> => {
    return act(async () => {
      await getAutosave().forceSave();
    });
  };

  const abortCall = (): void => {
    act(() => {
      getAutosave().abort();
    });
    if (controllable) {
      controllable.abort();
    }
  };

  const retry = async (): Promise<void> => {
    if (controllable === null) {
      throw new Error(
        "harness.retry() only supported when using the default controllable transport"
      );
    }
    const err = new Error("retry requested") as Error & { retryable?: boolean };
    err.retryable = true;
    controllable.reject(err);
    await waitForIdle();
  };

  const hydrate = async (values: T): Promise<void> => {
    await act(async () => {
      getAutosave().hydrateFromServer(values);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const waitForIdle = async (): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(debounceMs + 100);
      await Promise.resolve();
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
  };

  const flushDebounce = async (): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(debounceMs);
      await Promise.resolve();
    });
  };

  const waitForSave = async (): Promise<void> => {
    if (controllable !== null) {
      // Poll up to 20 microtask turns waiting for the pending call to clear.
      for (let i = 0; i < 20; i++) {
        if (!controllable.pending) return;
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
      // Still pending: fall through to a timer advance to kick any internal
      // debounce-to-save transition forward.
      await act(async () => {
        jest.advanceTimersByTime(debounceMs);
        await Promise.resolve();
      });
      return;
    }
    await act(async () => {
      jest.advanceTimersByTime(debounceMs);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  // getHistory(): best-effort structural snapshot. `past.length`/`future.length`
  // are reconstructed by walking canUndo/canRedo and restoring position.
  // Entry slots are empty-patch placeholders — value assertions go through
  // expectValueAt (D-15/D-16).
  const getHistory = (): HarnessHistorySnapshot => {
    let pastCount = 0;
    let futureCount = 0;
    act(() => {
      const autosave = getAutosave();
      // Walk redo first so we start from the canonical "furthest forward"
      // position, count the future depth, then come back.
      while (getAutosave().canRedo) {
        autosave.redo?.();
        futureCount++;
      }
      for (let i = 0; i < futureCount; i++) {
        autosave.undo?.();
      }
      // Now walk undo to count the past depth, then redo back.
      while (getAutosave().canUndo) {
        autosave.undo?.();
        pastCount++;
      }
      for (let i = 0; i < pastCount; i++) {
        autosave.redo?.();
      }
    });
    return {
      past: Array.from({ length: pastCount }, () => [] as readonly Patch[]),
      future: Array.from({ length: futureCount }, () => [] as readonly Patch[]),
      baseline: getAutosave().getBaseline(),
    };
  };

  // expectValueAt(step): walk step positions (redo if >0, undo if <0), clone
  // form values, navigate back, return clone.
  const expectValueAt = (step: number): unknown => {
    let cloned: unknown;
    act(() => {
      const autosave = getAutosave();
      const direction = step > 0 ? "redo" : "undo";
      const count = Math.abs(step);
      for (let i = 0; i < count; i++) {
        if (direction === "redo") autosave.redo?.();
        else autosave.undo?.();
      }
      cloned = JSON.parse(JSON.stringify(getForm().getValues() ?? null));
      // Navigate back to the original position via the inverse op.
      for (let i = 0; i < count; i++) {
        if (direction === "redo") autosave.undo?.();
        else autosave.redo?.();
      }
    });
    return cloned;
  };

  const getLogs = (): readonly LogEntry[] => capturedLogs.slice();

  const unmount = (): void => {
    act(() => {
      renderResult.unmount();
    });
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };

  // -------- 6. Assemble the harness object --------
  const harness: AutosaveHarness<T> = {
    change,
    addItem,
    removeItem,
    reorderItem,

    undo,
    redo,

    save,
    abort: abortCall,
    retry,

    hydrate,

    waitForIdle,
    flushDebounce,
    waitForSave,

    getHistory,
    expectValueAt,

    getLogs,

    get form() {
      return getForm();
    },
    get autosave() {
      return getAutosave();
    },
    transport: controllable ?? { transport: transportFn, raw: true },
    result: renderResult,

    unmount,
  };

  return harness;
}
