/**
 * Deep Merge and Update Utilities
 * Utilities for merging and updating nested objects safely
 * Supports arrays, custom merge strategies, and immutable updates
 */

import { getByPath, setByPath, parsePath } from './fieldPath';

export interface DeepMergeOptions {
  /**
   * How to handle array merging
   * - 'replace': Replace entire array (default)
   * - 'concat': Concatenate arrays
   * - 'merge': Merge arrays by identity key
   */
  arrayMergeStrategy?: 'replace' | 'concat' | 'merge';

  /**
   * Identity key for array merging (when using 'merge' strategy)
   */
  arrayIdentityKey?: string;

  /**
   * If true, create a new object instead of mutating
   */
  immutable?: boolean;

  /**
   * Custom merge function for specific keys
   */
  customMergers?: Record<string, (target: any, source: any) => any>;

  /**
   * Maximum depth to merge (prevents infinite recursion)
   */
  maxDepth?: number;
}

/**
 * Deep merge two objects
 * Recursively merges nested objects and handles arrays according to strategy
 * 
 * @example
 * const target = { user: { name: 'John', age: 30 } };
 * const source = { user: { age: 31, email: 'john@example.com' } };
 * 
 * deepMerge(target, source);
 * // { user: { name: 'John', age: 31, email: 'john@example.com' } }
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
  options: DeepMergeOptions = {}
): T {
  const {
    arrayMergeStrategy = 'replace',
    arrayIdentityKey = 'id',
    immutable = true,
    customMergers = {},
    maxDepth = 50,
  } = options;

  return mergeRecursive(immutable ? cloneDeep(target) : target, source, 0);

  function mergeRecursive(tgt: any, src: any, depth: number): any {
    if (depth > maxDepth) {
      console.warn('Deep merge exceeded max depth, stopping recursion');
      return tgt;
    }

    if (!src || typeof src !== 'object') {
      return src;
    }

    if (!tgt || typeof tgt !== 'object') {
      return src;
    }

    // Handle arrays
    if (Array.isArray(src)) {
      if (!Array.isArray(tgt)) {
        return src;
      }

      switch (arrayMergeStrategy) {
        case 'concat':
          return [...tgt, ...src];

        case 'merge':
          return mergeArrays(tgt, src, arrayIdentityKey);

        case 'replace':
        default:
          return src;
      }
    }

    // Handle objects - always create new object for merging nested values properly
    const merged = { ...tgt };

    for (const [key, sourceValue] of Object.entries(src)) {
      // Use custom merger if provided
      if (customMergers[key]) {
        merged[key] = customMergers[key](tgt[key], sourceValue);
        continue;
      }

      const targetValue = tgt[key];

      // Handle arrays at this key
      if (Array.isArray(sourceValue)) {
        if (!Array.isArray(targetValue)) {
          merged[key] = sourceValue;
        } else {
          switch (arrayMergeStrategy) {
            case 'concat':
              merged[key] = [...targetValue, ...sourceValue];
              break;
            case 'merge':
              merged[key] = mergeArrays(targetValue, sourceValue, arrayIdentityKey);
              break;
            case 'replace':
            default:
              merged[key] = sourceValue;
          }
        }
      }
      // If both are objects (and not arrays), merge recursively
      else if (
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue) &&
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        merged[key] = mergeRecursive(targetValue, sourceValue, depth + 1);
      } else {
        merged[key] = sourceValue;
      }
    }

    return merged;
  }
}

/**
 * Update nested fields in an object immutably
 * Returns a new object with updates applied
 * 
 * @example
 * const obj = { user: { name: 'John', age: 30 } };
 * const updated = deepUpdate(obj, {
 *   'user.age': 31,
 *   'user.email': 'john@example.com'
 * });
 * // { user: { name: 'John', age: 31, email: 'john@example.com' } }
 */
export function deepUpdate<T extends Record<string, any>>(
  obj: T,
  updates: Record<string, any>
): T {
  const result = cloneDeep(obj);

  for (const [path, value] of Object.entries(updates)) {
    setByPath(result, path, value);
  }

  return result;
}

/**
 * Deep clone an object
 * Handles nested objects, arrays, dates, and other special types
 * 
 * @example
 * const obj = { user: { name: 'John', tags: ['a', 'b'] } };
 * const cloned = cloneDeep(obj);
 * cloned.user.name = 'Jane';
 * // obj.user.name is still 'John'
 */
export function cloneDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => cloneDeep(item)) as T;
  }

  const cloned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = cloneDeep(value);
  }

  return cloned as T;
}

/**
 * Merge two arrays by identity key
 * Items in source array update items in target array with same key
 * Items only in target are kept, items only in source are added
 */
function mergeArrays<T extends Record<string, any>>(
  target: T[],
  source: T[],
  identityKey: string
): T[] {
  // Create a map of source items
  const sourceMap = new Map<any, T>();
  source.forEach((item) => {
    const key = item?.[identityKey];
    if (key !== undefined) {
      sourceMap.set(key, item);
    }
  });

  // Merge or keep target items
  const result = target.map((item) => {
    const key = item?.[identityKey];
    if (key !== undefined && sourceMap.has(key)) {
      const sourceItem = sourceMap.get(key)!;
      sourceMap.delete(key); // Mark as processed
      return { ...item, ...sourceItem };
    }
    return item;
  });

  // Add remaining source items that weren't in target
  sourceMap.forEach((item) => {
    result.push(item);
  });

  return result;
}

/**
 * Safely merge objects at a specific path
 * Only merges the object at the given path, keeping everything else intact
 * 
 * @example
 * const obj = {
 *   user: { name: 'John', age: 30 },
 *   settings: { theme: 'dark' }
 * };
 * 
 * mergeAtPath(obj, 'user', { email: 'john@example.com' });
 * // {
 * //   user: { name: 'John', age: 30, email: 'john@example.com' },
 * //   settings: { theme: 'dark' }
 * // }
 */
export function mergeAtPath<T extends Record<string, any>>(
  obj: T,
  path: string,
  updates: any,
  options?: DeepMergeOptions
): T {
  const result = cloneDeep(obj);
  const current = getByPath(result, path);

  if (!current || typeof current !== 'object') {
    // If current value is not an object, just set the new value
    setByPath(result, path, updates);
    return result;
  }

  const merged = deepMerge(current, updates, { ...options, immutable: false });
  setByPath(result, path, merged);

  return result;
}

/**
 * Check if two values are deeply equal
 * Handles nested objects, arrays, dates, etc.
 * 
 * @example
 * isDeepEqual({ a: { b: 1 } }, { a: { b: 1 } }) // true
 * isDeepEqual({ a: [1, 2] }, { a: [1, 2] }) // true
 */
export function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a !== 'object') {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isDeepEqual(item, b[index]));
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => isDeepEqual(a[key], b[key]));
}

/**
 * Get the difference between two objects as a set of paths and values
 * Returns only the fields that changed
 * 
 * @example
 * const old = { user: { name: 'John', age: 30 } };
 * const new = { user: { name: 'John', age: 31 } };
 * 
 * getDiff(old, new);
 * // { 'user.age': { old: 30, new: 31 } }
 */
export function getDiff(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  prefix: string = ''
): Record<string, { old: any; new: any }> {
  const diffs: Record<string, { old: any; new: any }> = {};

  // Get all keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);

  for (const key of allKeys) {
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (!isDeepEqual(oldValue, newValue)) {
      // Check if both are objects (and not arrays) to recurse
      if (
        oldValue &&
        newValue &&
        typeof oldValue === 'object' &&
        typeof newValue === 'object' &&
        !Array.isArray(oldValue) &&
        !Array.isArray(newValue)
      ) {
        Object.assign(diffs, getDiff(oldValue, newValue, currentPath));
      } else {
        diffs[currentPath] = { old: oldValue, new: newValue };
      }
    }
  }

  return diffs;
}

/**
 * Apply a set of path-based updates to an object
 * Similar to deepUpdate but takes old/new value pairs
 * 
 * @example
 * const obj = { user: { name: 'John', age: 30 } };
 * const diff = { 'user.age': { old: 30, new: 31 } };
 * 
 * applyDiff(obj, diff);
 * // { user: { name: 'John', age: 31 } }
 */
export function applyDiff<T extends Record<string, any>>(
  obj: T,
  diff: Record<string, { old: any; new: any }>
): T {
  const result = cloneDeep(obj);

  for (const [path, { new: newValue }] of Object.entries(diff)) {
    setByPath(result, path, newValue);
  }

  return result;
}
