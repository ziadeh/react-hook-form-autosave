/**
 * A mapping between form field keys and API keys.
 *
 * Each entry can be either:
 * - a `string`: simply rename the key in the payload.
 * - a `[apiKey, transform]` tuple:
 *    - `apiKey`: the name of the key to send to the API.
 *    - `transform`: a function to transform the value before sending.
 *
 * Example:
 * {
 *   jurisdiction_id: ["geo_entity_id", Number],   // rename & cast
 *   regulatory_type: "reg_type_id",               // rename only
 *   title: "title"                                // (no-op mapping, explicit for clarity)
 * }
 */
export type KeyMap = Record<
  string,
  string | [apiKey: string, transform: (v: any) => any]
>;

/**
 * Shallow key remapper with optional value transforms.
 *
 * Iterates over the input payload and applies `keyMap` rules:
 * - If no rule exists for a key, copy as-is.
 * - If the rule is a string, rename the key.
 * - If the rule is a tuple, rename the key and transform the value.
 *
 * @param payload - Original form values (or a subset of changed values).
 * @param keyMap  - Mapping rules for renaming / transforming keys.
 *
 * @returns A new object with remapped keys and optionally transformed values.
 *
 * ✅ Example:
 * mapKeys(
 *   { jurisdiction_id: "5", title: "Law A" },
 *   { jurisdiction_id: ["geo_entity_id", Number], title: "title" }
 * )
 * // → { geo_entity_id: 5, title: "Law A" }
 */
export function mapKeys(
  payload: Record<string, any>,
  keyMap: KeyMap
): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [k, v] of Object.entries(payload)) {
    const rule = keyMap[k];

    if (!rule) {
      // No mapping rule → keep original key/value
      out[k] = v;
      continue;
    }

    if (Array.isArray(rule)) {
      // Tuple form → apply rename + optional transform
      const [apiKey, transform] = rule;
      out[apiKey] = transform ? transform(v) : v;
    } else {
      // String form → rename only
      out[rule] = v;
    }
  }

  return out;
}
