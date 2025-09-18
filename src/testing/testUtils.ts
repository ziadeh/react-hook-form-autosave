import type { FieldValues } from "react-hook-form";
import type { SaveResult, Transport, SavePayload } from "../core/types";
import type { FormSubset } from "../strategies/validation/types";

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

export function createMockForm<T extends FieldValues>(
  overrides: Partial<FormSubset<T>> = {}
): FormSubset<T> {
  return {
    watch: jest.fn(() => ({} as T)),
    formState: {
      isDirty: false,
      isValid: true,
      dirtyFields: {},
      isValidating: false,
    },
    reset: jest.fn(),
    getValues: jest.fn(() => ({} as T)),
    trigger: jest.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

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
