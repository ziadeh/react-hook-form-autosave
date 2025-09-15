/**
 * Extracts only the "dirty" (changed) values from a form state.
 *
 * ⚡ Works with React Hook Form's `dirtyFields`, but only supports flat objects.
 *    - In React Hook Form, `dirtyFields` can be:
 *        - `true` / `false` → field dirty state (flat fields)
 *        - nested objects   → when you have nested field structures (not handled here yet)
 *
 * @param values - The current form values (e.g. from `form.getValues()`).
 * @param dirty  - The `formState.dirtyFields` object from React Hook Form.
 *
 * @returns A new object containing only the keys that are marked dirty.
 *
 * ✅ Example (flat):
 * values = { name: "Alice", bio: "Hello" }
 * dirty  = { name: true, bio: false }
 * result = { name: "Alice" }
 *
 * ❌ Example (nested - not supported yet):
 * values = { user: { name: "Alice" } }
 * dirty  = { user: { name: true } }
 * This function will ignore nested structure and not return correctly.
 */
export function pickChanged<T extends Record<string, any>>(
  values: T,
  dirty: any
): Partial<T> {
  const out: Partial<T> = {};

  // Iterate over each field tracked in `dirty`
  Object.keys(dirty ?? {}).forEach((k) => {
    // If the field is marked as dirty (true), copy its value from `values`
    if (dirty[k]) {
      (out as any)[k] = values[k];
    }
  });

  return out;
}
