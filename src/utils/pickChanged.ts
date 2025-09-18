/**
 * Extracts only the "dirty" (changed) values from a form state.
 * Supports both flat and nested objects.
 */
export function pickChanged<T extends Record<string, any>>(
  values: T,
  dirty: any
): Partial<T> {
  const result: Partial<T> = {};

  Object.keys(dirty ?? {}).forEach((key) => {
    const dirtyValue = dirty[key];

    if (dirtyValue === true) {
      // Simple dirty field
      (result as any)[key] = values[key];
    } else if (typeof dirtyValue === "object" && dirtyValue !== null) {
      // Nested dirty fields
      const nestedResult = pickChanged(values[key] || {}, dirtyValue);
      if (Object.keys(nestedResult).length > 0) {
        (result as any)[key] = nestedResult;
      }
    }
  });

  return result;
}
