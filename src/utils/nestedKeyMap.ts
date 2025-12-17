/**
 * Nested Key Mapping Utilities
 * Extension of mapKeys to support nested field paths
 * Allows transforming nested form fields to match API structure
 */

import { parsePath, setByPath, getByPath, getAllPaths, joinPath } from './fieldPath';

export type NestedKeyMap = Record<
  string,
  | string // Simple rename: "user.firstName" -> "user.first_name"
  | [string, (v: any) => any] // Rename + transform
  | {
      // Advanced mapping
      to: string; // Target path
      transform?: (v: any) => any; // Optional transform
      flatten?: boolean; // Flatten nested structure
    }
>;

export interface NestedMapKeysOptions {
  /**
   * If true, unmapped fields are preserved
   * If false, only mapped fields are included
   */
  preserveUnmapped?: boolean;

  /**
   * If true, automatically flatten single-value nested objects
   * e.g., { user: { name: "John" } } -> { user_name: "John" }
   */
  autoFlatten?: boolean;

  /**
   * Separator to use when flattening nested keys
   * Default: "_"
   */
  flattenSeparator?: string;
}

/**
 * Map nested keys in a payload according to a nested key map
 * Supports path-based transformations and restructuring
 * 
 * @example
 * const payload = {
 *   user: {
 *     firstName: "John",
 *     lastName: "Doe",
 *     profile: {
 *       email: "john@example.com"
 *     }
 *   }
 * };
 * 
 * const keyMap = {
 *   "user.firstName": "user.first_name",
 *   "user.profile.email": {
 *     to: "contact_email",
 *     flatten: true
 *   }
 * };
 * 
 * mapNestedKeys(payload, keyMap);
 * // Result:
 * // {
 * //   user: {
 * //     first_name: "John",
 * //     lastName: "Doe"
 * //   },
 * //   contact_email: "john@example.com"
 * // }
 */
export function mapNestedKeys(
  payload: Record<string, any>,
  keyMap: NestedKeyMap,
  options: NestedMapKeysOptions = {}
): Record<string, any> {
  const {
    preserveUnmapped = true,
    autoFlatten = false,
    flattenSeparator = '_',
  } = options;

  const result: Record<string, any> = preserveUnmapped ? { ...payload } : {};
  const processedPaths = new Set<string>();

  // Process each mapping
  for (const [sourcePath, mapping] of Object.entries(keyMap)) {
    const value = getByPath(payload, sourcePath);
    if (value === undefined) continue;

    processedPaths.add(sourcePath);

    let targetPath: string;
    let transform: ((v: any) => any) | undefined;
    let shouldFlatten = autoFlatten;

    // Parse mapping configuration
    if (typeof mapping === 'string') {
      targetPath = mapping;
    } else if (Array.isArray(mapping)) {
      [targetPath, transform] = mapping;
    } else {
      targetPath = mapping.to;
      transform = mapping.transform;
      shouldFlatten = mapping.flatten ?? autoFlatten;
    }

    // Apply transformation if provided
    const transformedValue = transform ? transform(value) : value;

    // Handle flattening
    if (shouldFlatten) {
      // Flatten the path itself (convert dots to separator)
      const flatKey = targetPath.replace(/\./g, flattenSeparator);
      result[flatKey] = transformedValue;
    } else {
      // Set the value at the target path
      setByPath(result, targetPath, transformedValue);
    }

    // Remove from original location if preserving unmapped
    if (preserveUnmapped) {
      removeNestedPath(result, sourcePath);
    }
  }

  return result;
}

/**
 * Create a reusable mapper function for nested keys
 * 
 * @example
 * const mapper = createNestedKeyMapper({
 *   "user.firstName": "user.first_name",
 *   "user.lastName": "user.last_name"
 * });
 * 
 * const result = mapper(formData);
 */
export function createNestedKeyMapper(
  keyMap: NestedKeyMap,
  options?: NestedMapKeysOptions
) {
  return (payload: Record<string, any>) => mapNestedKeys(payload, keyMap, options);
}

/**
 * Reverse a nested key map (swap source and target paths)
 * Useful for mapping API responses back to form structure
 * 
 * @example
 * const formToApi = {
 *   "user.firstName": "user.first_name"
 * };
 * const apiToForm = reverseNestedKeyMap(formToApi);
 * // { "user.first_name": "user.firstName" }
 */
export function reverseNestedKeyMap(keyMap: NestedKeyMap): NestedKeyMap {
  const reversed: NestedKeyMap = {};

  for (const [sourcePath, mapping] of Object.entries(keyMap)) {
    if (typeof mapping === 'string') {
      reversed[mapping] = sourcePath;
    } else if (Array.isArray(mapping)) {
      const [targetPath, transform] = mapping;
      // Note: Cannot reverse transform functions
      reversed[targetPath] = sourcePath;
    } else {
      reversed[mapping.to] = sourcePath;
    }
  }

  return reversed;
}

/**
 * Flatten a nested object to dot notation keys
 * 
 * @example
 * flattenObject({ user: { name: "John", age: 30 } })
 * // { "user.name": "John", "user.age": 30 }
 */
export function flattenObject(
  obj: Record<string, any>,
  separator: string = '.',
  prefix: string = ''
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, separator, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten an object with dot notation keys to nested structure
 * 
 * @example
 * unflattenObject({ "user.name": "John", "user.age": 30 })
 * // { user: { name: "John", age: 30 } }
 */
export function unflattenObject(
  obj: Record<string, any>,
  separator: string = '.'
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = key.split(separator);
    setByPath(result, path, value);
  }

  return result;
}

/**
 * Merge nested key maps together
 * Later maps override earlier ones
 * 
 * @example
 * const base = { "user.name": "user.full_name" };
 * const override = { "user.email": "contact.email" };
 * mergeNestedKeyMaps(base, override);
 * // { "user.name": "user.full_name", "user.email": "contact.email" }
 */
export function mergeNestedKeyMaps(...keyMaps: NestedKeyMap[]): NestedKeyMap {
  return Object.assign({}, ...keyMaps);
}

/**
 * Validate that a nested key map doesn't have conflicting mappings
 * Returns array of conflicts or empty array if valid
 * 
 * @example
 * const keyMap = {
 *   "user.name": "userName",
 *   "user": "userName" // Conflict!
 * };
 * validateNestedKeyMap(keyMap);
 * // ["user -> userName conflicts with user.name -> userName"]
 */
export function validateNestedKeyMap(keyMap: NestedKeyMap): string[] {
  const conflicts: string[] = [];
  const targetPaths = new Map<string, string>();

  for (const [sourcePath, mapping] of Object.entries(keyMap)) {
    let targetPath: string;

    if (typeof mapping === 'string') {
      targetPath = mapping;
    } else if (Array.isArray(mapping)) {
      targetPath = mapping[0];
    } else {
      targetPath = mapping.to;
    }

    // Check for duplicate target paths
    const existing = targetPaths.get(targetPath);
    if (existing) {
      conflicts.push(
        `${sourcePath} -> ${targetPath} conflicts with ${existing} -> ${targetPath}`
      );
    }

    targetPaths.set(targetPath, sourcePath);
  }

  return conflicts;
}

/**
 * Helper to remove a nested path from an object
 * Used internally to clean up when renaming fields
 */
function removeNestedPath(obj: any, path: string): void {
  const segments = parsePath(path);
  if (segments.length === 0) return;

  let current = obj;
  const parents: any[] = [obj];

  // Navigate to the parent
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (current[segment] === undefined) return;
    current = current[segment];
    parents.push(current);
  }

  // Delete the final segment
  const lastSegment = segments[segments.length - 1];
  delete current[lastSegment];

  // Clean up empty parent objects
  for (let i = segments.length - 2; i >= 0; i--) {
    const parent = parents[i];
    const segment = segments[i];
    const child = parent[segment];

    if (
      child &&
      typeof child === 'object' &&
      !Array.isArray(child) &&
      Object.keys(child).length === 0
    ) {
      delete parent[segment];
    } else {
      break; // Stop if parent is not empty
    }
  }
}
