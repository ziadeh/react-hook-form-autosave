/**
 * Phase 2: Scalar Field Type Matrix
 *
 * Parameterised undo/redo round-trip test for every scalar field type.
 * Each case: change -> undo (assert original) -> redo (assert changed).
 *
 * Requirements: MATRIX-02 (text), MATRIX-03 (number), MATRIX-04 (boolean),
 * MATRIX-05 (radio), MATRIX-06 (select), MATRIX-07 (date).
 *
 * Failing tests are NOT skipped -- they become Phase 8 input.
 */

import { mountAutosaveHarness, scalarSchema } from "@test-helpers/autosaveHarness";

/**
 * Assertion helper that handles Date type preservation.
 * For Date values, asserts both value equality (via toEqual) and type
 * preservation (via toBeInstanceOf). If a Date degrades to a string
 * after undo/redo, the toBeInstanceOf check surfaces that as a real bug.
 */
function assertValue(actual: unknown, expected: unknown, label: string): void {
  if (expected instanceof Date) {
    // Value equality via timestamp
    expect(actual).toEqual(expected);
    // Type preservation -- if this fails, Date degraded to string (Phase 8 bug)
    expect(actual).toBeInstanceOf(Date);
  } else {
    expect(actual).toBe(expected);
  }
}

const SCALAR_CASES = [
  { field: "text",   initial: "initial text"                        as unknown, changed: "updated text"                         as unknown },
  { field: "num",    initial: 42                                    as unknown, changed: 99                                     as unknown },
  { field: "bool",   initial: false                                 as unknown, changed: true                                   as unknown },
  { field: "radio",  initial: "option-a"                            as unknown, changed: "option-b"                             as unknown },
  { field: "select", initial: "value-1"                             as unknown, changed: "value-2"                              as unknown },
  { field: "date",   initial: new Date("2026-01-01T00:00:00.000Z") as unknown, changed: new Date("2026-06-15T00:00:00.000Z")  as unknown },
] as const;

describe("Scalar field type matrix", () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  describe.each(SCALAR_CASES)("$field field", ({ field, initial, changed }) => {
    it("change -> undo restores original, redo restores changed", () => {
      const harness = mountAutosaveHarness({
        defaultValues: scalarSchema(),
        config: { debounceMs: 50, debug: true },
        undo: { enabled: true, hotkeys: false },
      });

      try {
        // Verify starting value matches schema default
        assertValue(harness.form.getValues(field), initial, "initial");

        // Change the field
        harness.change(field, changed);
        assertValue(harness.form.getValues(field), changed, "after change");

        // Undo -- should revert to original
        harness.undo();
        assertValue(harness.form.getValues(field), initial, "after undo");

        // Redo -- should restore the changed value
        harness.redo();
        assertValue(harness.form.getValues(field), changed, "after redo");
      } finally {
        harness.unmount();
      }
    });
  });
});
