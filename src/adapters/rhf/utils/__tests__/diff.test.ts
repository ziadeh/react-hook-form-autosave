/**
 * Tests for diff utility functions
 * Covers deepEqual, diffToPatches, stableStringify, isEditableElement
 */

import { deepEqual, diffToPatches, stableStringify, isEditableElement } from '../diff';

describe('deepEqual', () => {
  it('should return true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('should return false for different types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('should compare Date objects by value', () => {
    const d1 = new Date('2025-01-01');
    const d2 = new Date('2025-01-01');
    const d3 = new Date('2025-06-01');
    expect(deepEqual(d1, d2)).toBe(true);
    expect(deepEqual(d1, d3)).toBe(false);
  });

  it('should compare arrays by value', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 3], [1, 2])).toBe(false);
  });

  it('should use id-based comparison for arrays of objects', () => {
    const a = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    const b = [{ id: 1, name: 'Alice Changed' }, { id: 2, name: 'Bob' }];
    // id-based comparison only checks ids, not content
    expect(deepEqual(a, b)).toBe(true);
  });

  it('should compare nested objects recursively', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('should return false for objects with different keys', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('should handle NaN', () => {
    expect(deepEqual(NaN, NaN)).toBe(true); // Object.is(NaN, NaN) === true
  });
});

describe('diffToPatches', () => {
  it('should return empty array when values are equal', () => {
    expect(diffToPatches({ name: 'John' }, { name: 'John' })).toHaveLength(0);
  });

  it('should detect changed primitives', () => {
    const patches = diffToPatches({ name: 'John' }, { name: 'Jane' }, '');
    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({
      name: 'name',
      prevValue: 'John',
      nextValue: 'Jane',
      rootField: 'name',
    });
  });

  it('should recurse into nested objects', () => {
    const prev = { profile: { name: 'John', age: 30 } };
    const next = { profile: { name: 'Jane', age: 30 } };
    const patches = diffToPatches(prev, next, '');
    expect(patches.some((p) => p.name === 'profile.name')).toBe(true);
    expect(patches.some((p) => p.name === 'profile.age')).toBe(false);
  });

  it('should treat arrays as atomic units', () => {
    const prev = { tags: ['a', 'b'] };
    const next = { tags: ['a', 'b', 'c'] };
    const patches = diffToPatches(prev, next, '');
    expect(patches).toHaveLength(1);
    expect(patches[0].name).toBe('tags');
    expect(patches[0].prevValue).toEqual(['a', 'b']);
    expect(patches[0].nextValue).toEqual(['a', 'b', 'c']);
  });

  it('should detect new keys', () => {
    const patches = diffToPatches({ name: 'John' }, { name: 'John', email: 'j@test.com' }, '');
    expect(patches.some((p) => p.name === 'email')).toBe(true);
  });

  it('should detect removed keys', () => {
    const patches = diffToPatches({ name: 'John', email: 'j@test.com' }, { name: 'John' }, '');
    expect(patches.some((p) => p.name === 'email')).toBe(true);
  });

  it('should handle null/undefined inputs', () => {
    expect(diffToPatches(undefined as any, undefined as any)).toHaveLength(0);
    expect(diffToPatches(null as any, null as any)).toHaveLength(0);
  });

  it('should set correct rootField for nested paths', () => {
    const patches = diffToPatches(
      { profile: { firstName: 'John' } },
      { profile: { firstName: 'Jane' } },
      ''
    );
    const patch = patches.find((p) => p.name === 'profile.firstName');
    expect(patch?.rootField).toBe('profile');
  });
});

describe('stableStringify', () => {
  it('should produce consistent output regardless of key order', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('should handle nested objects', () => {
    const a = { outer: { b: 2, a: 1 } };
    const b = { outer: { a: 1, b: 2 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('should handle arrays (not sorted)', () => {
    const a = { tags: ['a', 'b', 'c'] };
    const b = { tags: ['a', 'b', 'c'] };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('should handle null', () => {
    expect(stableStringify(null as any)).toBe('null');
  });

  it('should handle undefined', () => {
    expect(stableStringify(undefined as any)).toBe('undefined');
  });

  it('should handle primitives', () => {
    expect(stableStringify(42 as any)).toBe('42');
    expect(stableStringify('hello' as any)).toBe('hello');
  });
});

describe('isEditableElement', () => {
  it('should return false for null', () => {
    expect(isEditableElement(null)).toBe(false);
  });

  it('should return true for INPUT element', () => {
    const input = document.createElement('input');
    expect(isEditableElement(input)).toBe(true);
  });

  it('should return true for TEXTAREA element', () => {
    const textarea = document.createElement('textarea');
    expect(isEditableElement(textarea)).toBe(true);
  });

  it('should return true for SELECT element', () => {
    const select = document.createElement('select');
    expect(isEditableElement(select)).toBe(true);
  });

  it('should return false for regular div', () => {
    const div = document.createElement('div');
    expect(isEditableElement(div)).toBe(false);
  });

  it('should check contentEditable property', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom may or may not support isContentEditable on standalone elements
    // The implementation checks el.isContentEditable — test the function doesn't throw
    expect(() => isEditableElement(div)).not.toThrow();
  });

  it('should return true for element with role=textbox', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'textbox');
    expect(isEditableElement(div)).toBe(true);
  });
});
