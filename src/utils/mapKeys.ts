export type KeyMap = Record<
  string,
  string | [apiKey: string, transform: (v: any) => any]
>;

export function mapKeys(
  payload: Record<string, any>,
  keyMap: KeyMap
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    const mapping = keyMap[key];

    if (!mapping) {
      result[key] = value;
      continue;
    }

    if (typeof mapping === "string") {
      result[mapping] = value;
    } else {
      const [apiKey, transform] = mapping;
      result[apiKey] = transform ? transform(value) : value;
    }
  }

  return result;
}

export function createKeyMapper(keyMap: KeyMap) {
  return (payload: Record<string, any>) => mapKeys(payload, keyMap);
}
