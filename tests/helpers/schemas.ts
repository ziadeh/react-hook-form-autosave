/**
 * Canonical schema factories for the undo/redo matrix test harness.
 *
 * Per CONTEXT.md D-14 these shapes are shared across Phases 2–3 so parallel
 * matrix phases stay consistent. Each factory returns a freshly-allocated,
 * reference-distinct object on every call (including a new `Date` for
 * `scalarSchema`) so tests can mutate values without bleeding into each other.
 *
 * Dev-only: this file lives under `tests/helpers/` and never ships in `dist/`.
 */

export interface ScalarSchemaValues {
  text: string;
  num: number;
  bool: boolean;
  radio: string;
  select: string;
  date: Date;
}

export function scalarSchema(): ScalarSchemaValues {
  return {
    text: "initial text",
    num: 42,
    bool: false,
    radio: "option-a",
    select: "value-1",
    date: new Date("2026-01-01T00:00:00.000Z"),
  };
}

export interface NestedSchemaValues {
  user: { profile: { name: string; age: number } };
}

export function nestedSchema(): NestedSchemaValues {
  return { user: { profile: { name: "Ada Lovelace", age: 36 } } };
}

export interface PrimitiveArraySchemaValues {
  tags: string[];
}

export function primitiveArraySchema(): PrimitiveArraySchemaValues {
  return { tags: ["alpha", "beta", "gamma"] };
}

export interface FieldArraySchemaValues {
  items: Array<{ id: string; name: string }>;
}

export function fieldArraySchema(): FieldArraySchemaValues {
  return {
    items: [
      { id: "1", name: "first" },
      { id: "2", name: "second" },
    ],
  };
}
