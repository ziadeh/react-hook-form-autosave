import type { FieldValues } from "react-hook-form";
import type { SaveResult, Transport, SavePayload } from "../core/types";
import type { FormSubset } from "../strategies/validation/types";

/* -----------------------------
 * Mock Transport
 * ----------------------------- */
export function createMockTransport(
  responses: SaveResult[] = [{ ok: true }]
): Transport & { getCalls: () => SavePayload[] } {
  const calls: SavePayload[] = [];
  let callCount = 0;

  const transport: Transport = async (payload) => {
    calls.push(payload);
    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount++;
    return response;
  };

  return Object.assign(transport, {
    getCalls: () => [...calls],
  });
}

/* -----------------------------
 * Mock FormSubset<T>
 * - getValues(name?) supported
 * - setValue(...) stubbed
 * - register(...) stubbed
 * ----------------------------- */
export function createMockForm<T extends FieldValues>(
  overrides: Partial<FormSubset<T>> = {}
): FormSubset<T> {
  // Minimal register stub compatible with RHF
  const registerStub = ((name: any) => {
    // You can enhance this if a test needs specific behavior
    return {
      name,
      onChange: jest.fn(),
      onBlur: jest.fn(),
      ref: jest.fn(),
    } as any;
  }) as FormSubset<T>["register"];

  // getValues that supports both 0-arg and 1-arg forms
  const getValuesStub = ((name?: any) => {
    // If a single path is requested, return undefined by default
    if (typeof name === "string") return undefined as any;
    // No args -> return the whole values object
    return {} as T;
  }) as FormSubset<T>["getValues"];

  // setValue stub – records calls, no side effects by default
  const setValueStub = jest.fn((_: any, __: any, ___?: any) => {
    // no-op
  }) as unknown as FormSubset<T>["setValue"];

  // watch stub – simplest: return whole values when called without args
  const watchStub = jest.fn(
    (_: any) => ({} as T)
  ) as unknown as FormSubset<T>["watch"];

  const triggerStub = jest.fn(() =>
    Promise.resolve(true)
  ) as unknown as FormSubset<T>["trigger"];

  return {
    watch: watchStub,
    formState: {
      isDirty: false,
      isValid: true,
      dirtyFields: {},
      isValidating: false,
    },
    // Some suites use reset/trigger; keep them available (even if not in FormSubset)
    reset: jest.fn(),
    trigger: triggerStub,

    // Updated/added to satisfy new FormSubset<T> needs
    getValues: getValuesStub,
    setValue: setValueStub,
    register: registerStub,

    // Allow tests to override any of the above
    ...overrides,
  } as FormSubset<T>;
}

/* -----------------------------
 * Mock timer utilities
 * ----------------------------- */
export class MockTimer {
  private timers = new Map<number, { callback: () => void; delay: number }>();
  private nextId = 1;

  setTimeout = (callback: () => void, delay: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { callback, delay });
    return id;
  };

  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };

  tick = (ms: number): void => {
    for (const [id, timer] of this.timers.entries()) {
      if (timer.delay <= ms) {
        timer.callback();
        this.timers.delete(id);
      } else {
        timer.delay -= ms;
      }
    }
  };

  flush = (): void => {
    const callbacks = Array.from(this.timers.values()).map((t) => t.callback);
    this.timers.clear();
    callbacks.forEach((cb) => cb());
  };

  hasPendingTimers = (): boolean => {
    return this.timers.size > 0;
  };
}

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForCondition(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 10
): Promise<void> {
  const start = Date.now();

  while (!condition() && Date.now() - start < timeoutMs) {
    await waitFor(intervalMs);
  }

  if (!condition()) {
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }
}
