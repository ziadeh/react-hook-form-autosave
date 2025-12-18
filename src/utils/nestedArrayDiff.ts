/**
 * Nested Array Diffing Utilities
 * Utilities for tracking and computing changes in arrays of objects
 * Supports detecting additions, removals, modifications, and reordering
 */

import { getByPath, getAllPaths, parsePath, joinPath } from './fieldPath';

export interface ArrayDiffOptions {
  /**
   * Key field to use for identifying items (default: 'id')
   */
  identityKey?: string;

  /**
   * If true, track field-level changes within items
   * If false, treat modified items as entirely changed
   */
  trackFieldChanges?: boolean;

  /**
   * If true, detect and report reordering
   */
  trackOrder?: boolean;

  /**
   * Custom equality function for comparing values
   */
  equalityFn?: (a: any, b: any) => boolean;
}

export interface ArrayDiffResult<T = any> {
  /**
   * Items that were added
   */
  added: T[];

  /**
   * Items that were removed
   */
  removed: T[];

  /**
   * Items that were modified (with before/after state)
   */
  modified: Array<{
    before: T;
    after: T;
    changes?: Record<string, { before: any; after: any }>;
  }>;

  /**
   * Items that were reordered (only if trackOrder is true)
   */
  reordered?: Array<{
    item: T;
    oldIndex: number;
    newIndex: number;
  }>;

  /**
   * True if there are any changes
   */
  hasChanges: boolean;
}

/**
 * Compute the difference between two arrays of objects
 * Identifies additions, removals, modifications, and optionally reordering
 * 
 * @example
 * const oldArray = [
 *   { id: 1, name: 'Alice', age: 25 },
 *   { id: 2, name: 'Bob', age: 30 }
 * ];
 * const newArray = [
 *   { id: 1, name: 'Alice', age: 26 }, // Modified
 *   { id: 3, name: 'Charlie', age: 35 } // Added
 * ];
 * 
 * const diff = diffArrays(oldArray, newArray);
 * // {
 * //   added: [{ id: 3, name: 'Charlie', age: 35 }],
 * //   removed: [{ id: 2, name: 'Bob', age: 30 }],
 * //   modified: [{
 * //     before: { id: 1, name: 'Alice', age: 25 },
 * //     after: { id: 1, name: 'Alice', age: 26 },
 * //     changes: { age: { before: 25, after: 26 } }
 * //   }]
 * // }
 */
export function diffArrays<T extends Record<string, any>>(
  oldArray: T[],
  newArray: T[],
  options: ArrayDiffOptions = {}
): ArrayDiffResult<T> {
  const {
    identityKey = 'id',
    trackFieldChanges = true,
    trackOrder = false,
    equalityFn = defaultEquality,
  } = options;

  const added: T[] = [];
  const removed: T[] = [];
  const modified: ArrayDiffResult<T>['modified'] = [];
  const reordered: ArrayDiffResult<T>['reordered'] = trackOrder ? [] : undefined;

  // Create maps for O(1) lookup
  const oldMap = new Map<any, { item: T; index: number }>();
  const newMap = new Map<any, { item: T; index: number }>();

  oldArray.forEach((item, index) => {
    const key = item[identityKey];
    oldMap.set(key, { item, index });
  });

  newArray.forEach((item, index) => {
    const key = item[identityKey];
    newMap.set(key, { item, index });
  });

  // Find added and modified items
  for (const [key, { item: newItem, index: newIndex }] of newMap.entries()) {
    const oldEntry = oldMap.get(key);

    if (!oldEntry) {
      // Item was added
      added.push(newItem);
    } else {
      const oldItem = oldEntry.item;
      const oldIndex = oldEntry.index;

      // Check if modified
      if (!deepEqual(oldItem, newItem, equalityFn)) {
        const modEntry: ArrayDiffResult<T>['modified'][0] = {
          before: oldItem,
          after: newItem,
        };

        if (trackFieldChanges) {
          modEntry.changes = detectFieldChanges(oldItem, newItem, equalityFn);
        }

        modified.push(modEntry);
      }

      // Check if reordered
      if (trackOrder && oldIndex !== newIndex) {
        reordered!.push({
          item: newItem,
          oldIndex,
          newIndex,
        });
      }
    }
  }

  // Find removed items
  for (const [key, { item: oldItem }] of oldMap.entries()) {
    if (!newMap.has(key)) {
      removed.push(oldItem);
    }
  }

  return {
    added,
    removed,
    modified,
    reordered,
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
  };
}

/**
 * Apply an array diff to get the new array
 * Useful for applying changes from a diff result
 * 
 * @example
 * const oldArray = [{ id: 1, name: 'Alice' }];
 * const diff = { added: [{ id: 2, name: 'Bob' }], removed: [], modified: [] };
 * const newArray = applyArrayDiff(oldArray, diff);
 * // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
 */
export function applyArrayDiff<T extends Record<string, any>>(
  array: T[],
  diff: ArrayDiffResult<T>,
  identityKey: string = 'id'
): T[] {
  let result = [...array];

  // Remove items
  result = result.filter((item) => {
    return !diff.removed.some((removed) => item[identityKey] === removed[identityKey]);
  });

  // Apply modifications
  result = result.map((item) => {
    const mod = diff.modified.find((m) => m.before[identityKey] === item[identityKey]);
    return mod ? mod.after : item;
  });

  // Add new items
  result = [...result, ...diff.added];

  return result;
}

/**
 * Detect changes in nested array fields within objects
 * Compares arrays at specified paths and returns diffs
 * 
 * @example
 * const oldObj = {
 *   users: [
 *     { id: 1, name: 'Alice' },
 *     { id: 2, name: 'Bob' }
 *   ]
 * };
 * const newObj = {
 *   users: [
 *     { id: 1, name: 'Alice' },
 *     { id: 3, name: 'Charlie' }
 *   ]
 * };
 * 
 * const diffs = detectNestedArrayChanges(oldObj, newObj, ['users']);
 * // { 'users': { added: [{ id: 3, ...}], removed: [{ id: 2, ... }], ... } }
 */
export function detectNestedArrayChanges(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  arrayPaths: string[],
  options?: ArrayDiffOptions
): Record<string, ArrayDiffResult> {
  const results: Record<string, ArrayDiffResult> = {};

  for (const path of arrayPaths) {
    const oldArray = getByPath(oldObj, path);
    const newArray = getByPath(newObj, path);

    // Skip if either is not an array
    if (!Array.isArray(oldArray) || !Array.isArray(newArray)) {
      continue;
    }

    const diff = diffArrays(oldArray, newArray, options);
    if (diff.hasChanges) {
      results[path] = diff;
    }
  }

  return results;
}

/**
 * Find all array fields in an object
 * Returns paths to all array fields
 * 
 * @example
 * const obj = {
 *   users: [{ id: 1 }],
 *   settings: { items: [1, 2, 3] }
 * };
 * findArrayFields(obj);
 * // ['users', 'settings.items']
 */
export function findArrayFields(obj: Record<string, any>): string[] {
  const arrayPaths: string[] = [];
  const allPaths = getAllPaths(obj);

  for (const path of allPaths) {
    const value = getByPath(obj, path);
    if (Array.isArray(value)) {
      arrayPaths.push(path);
    }
  }

  return arrayPaths;
}

/**
 * Create a summary of array changes suitable for logging or display
 * 
 * @example
 * const diff = diffArrays(oldArray, newArray);
 * const summary = summarizeArrayDiff(diff);
 * // "+1 added, -1 removed, 2 modified"
 */
export function summarizeArrayDiff<T>(diff: ArrayDiffResult<T>): string {
  const parts: string[] = [];

  if (diff.added.length > 0) {
    parts.push(`+${diff.added.length} added`);
  }
  if (diff.removed.length > 0) {
    parts.push(`-${diff.removed.length} removed`);
  }
  if (diff.modified.length > 0) {
    parts.push(`${diff.modified.length} modified`);
  }
  if (diff.reordered && diff.reordered.length > 0) {
    parts.push(`${diff.reordered.length} reordered`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no changes';
}

/**
 * Merge multiple array diffs together
 * Useful when combining diffs from different sources
 */
export function mergeArrayDiffs<T extends Record<string, any>>(
  ...diffs: ArrayDiffResult<T>[]
): ArrayDiffResult<T> {
  const merged: ArrayDiffResult<T> = {
    added: [],
    removed: [],
    modified: [],
    hasChanges: false,
  };

  for (const diff of diffs) {
    merged.added.push(...diff.added);
    merged.removed.push(...diff.removed);
    merged.modified.push(...diff.modified);

    if (diff.reordered) {
      if (!merged.reordered) merged.reordered = [];
      merged.reordered.push(...diff.reordered);
    }
  }

  merged.hasChanges =
    merged.added.length > 0 || merged.removed.length > 0 || merged.modified.length > 0;

  return merged;
}

// Helper functions

function defaultEquality(a: any, b: any): boolean {
  return a === b;
}

function deepEqual(
  obj1: any,
  obj2: any,
  equalityFn: (a: any, b: any) => boolean
): boolean {
  if (equalityFn(obj1, obj2)) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key], equalityFn)) return false;
  }

  return true;
}

function detectFieldChanges(
  oldItem: Record<string, any>,
  newItem: Record<string, any>,
  equalityFn: (a: any, b: any) => boolean
): Record<string, { before: any; after: any }> {
  const changes: Record<string, { before: any; after: any }> = {};

  // Check all keys in both objects
  const allKeys = new Set([...Object.keys(oldItem), ...Object.keys(newItem)]);

  for (const key of allKeys) {
    const oldValue = oldItem[key];
    const newValue = newItem[key];

    if (!deepEqual(oldValue, newValue, equalityFn)) {
      changes[key] = { before: oldValue, after: newValue };
    }
  }

  return changes;
}
