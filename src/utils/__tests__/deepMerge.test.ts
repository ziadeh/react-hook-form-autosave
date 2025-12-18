/**
 * Tests for deep merge and update utilities
 * Covers deep merging, cloning, diffing, and updating
 */

import {
  deepMerge,
  deepUpdate,
  cloneDeep,
  mergeAtPath,
  isDeepEqual,
  getDiff,
  applyDiff,
  type DeepMergeOptions,
} from '../deepMerge';

describe('deep merge utilities', () => {
  describe('deepMerge', () => {
    it('should merge flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const source = {
        user: {
          age: 31,
          email: 'john@example.com',
        },
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({
        user: {
          name: 'John',
          age: 31,
          email: 'john@example.com',
        },
      });
    });

    it('should not mutate target by default', () => {
      const target = { user: { name: 'John' } };
      const source = { user: { age: 30 } };

      const result = deepMerge(target, source);

      expect(target.user).toEqual({ name: 'John' });
      expect(result.user).toEqual({ name: 'John', age: 30 });
    });

    it('should merge deeply nested objects', () => {
      const target = {
        a: {
          b: {
            c: {
              d: 1,
            },
          },
        },
      };
      const source = {
        a: {
          b: {
            c: {
              e: 2,
            },
          },
        },
      };

      const result = deepMerge(target, source);

      expect(result.a.b.c).toEqual({ d: 1, e: 2 });
    });

    describe('array merge strategies', () => {
      it('should replace arrays by default', () => {
        const target = { items: [1, 2, 3] };
        const source = { items: [4, 5] };

        const result = deepMerge(target, source);

        expect(result.items).toEqual([4, 5]);
      });

      it('should concat arrays when specified', () => {
        const target = { items: [1, 2, 3] };
        const source = { items: [4, 5] };

        const result = deepMerge(target, source, { arrayMergeStrategy: 'concat' });

        expect(result.items).toEqual([1, 2, 3, 4, 5]);
      });

      it('should merge arrays by identity key', () => {
        const target = {
          users: [
            { id: 1, name: 'Alice', age: 25 },
            { id: 2, name: 'Bob', age: 30 },
          ],
        };
        const source = {
          users: [
            { id: 1, age: 26 }, // Update Alice's age
            { id: 3, name: 'Charlie', age: 35 }, // Add Charlie
          ],
        };

        const result = deepMerge(target, source, { arrayMergeStrategy: 'merge' });

        expect(result.users).toEqual([
          { id: 1, name: 'Alice', age: 26 },
          { id: 2, name: 'Bob', age: 30 },
          { id: 3, name: 'Charlie', age: 35 },
        ]);
      });

      it('should use custom identity key for array merge', () => {
        const target = {
          items: [
            { _id: 'a', value: 1 },
            { _id: 'b', value: 2 },
          ],
        };
        const source = {
          items: [{ _id: 'a', value: 10 }],
        };

        const result = deepMerge(target, source, {
          arrayMergeStrategy: 'merge',
          arrayIdentityKey: '_id',
        });

        expect(result.items).toEqual([
          { _id: 'a', value: 10 },
          { _id: 'b', value: 2 },
        ]);
      });
    });

    describe('custom mergers', () => {
      it('should use custom merger for specific keys', () => {
        const target = { count: 5 };
        const source = { count: 3 };

        const result = deepMerge(target, source, {
          customMergers: {
            count: (t, s) => t + s, // Add instead of replace
          },
        });

        expect(result.count).toBe(8);
      });

      it('should apply custom mergers to nested keys', () => {
        const target = {
          user: {
            tags: ['a', 'b'],
          },
        };
        const source = {
          user: {
            tags: ['c'],
          },
        };

        const result = deepMerge(target, source, {
          customMergers: {
            tags: (t, s) => [...t, ...s],
          },
        });

        expect(result.user.tags).toEqual(['a', 'b', 'c']);
      });
    });

    describe('immutability', () => {
      it('should be immutable by default', () => {
        const target = { a: 1 };
        const source = { b: 2 };

        const result = deepMerge(target, source);

        expect(result).not.toBe(target);
        expect(target).toEqual({ a: 1 });
      });

      it('should skip deep clone when immutable is false', () => {
        const nested = { value: 'original' };
        const target = { a: 1, nested };
        const source = { b: 2 };

        const result = deepMerge(target, source, { immutable: false });

        // The result has merged data
        expect(result).toEqual({ a: 1, b: 2, nested: { value: 'original' } });
        // Nested objects should be same reference when immutable=false
        expect(result.nested).toBe(nested);
      });
    });

    describe('edge cases', () => {
      it('should handle null values', () => {
        const target = { a: null };
        const source = { a: { b: 1 } };

        const result = deepMerge(target, source);

        expect(result).toEqual({ a: { b: 1 } });
      });

      it('should handle undefined values', () => {
        const target = { a: 1 };
        const source = { a: undefined };

        const result = deepMerge(target, source);

        expect(result.a).toBeUndefined();
      });

      it('should handle max depth limit', () => {
        const createDeepObject = (depth: number): any => {
          if (depth === 0) return { value: 'deep' };
          return { nested: createDeepObject(depth - 1) };
        };

        const target = createDeepObject(10);
        const source = createDeepObject(10);

        // Should not throw or hang
        expect(() => deepMerge(target, source, { maxDepth: 5 })).not.toThrow();
      });

      it('should handle source as non-object', () => {
        const target = { a: 1 };
        const source = null;

        const result = deepMerge(target, source as any);

        // When source is null/non-object, it returns the source
        expect(result).toBeNull();
      });

      it('should handle target as non-object at nested level', () => {
        const target = { a: 'string' };
        const source = { a: { b: 1 } };

        const result = deepMerge(target, source);

        expect(result).toEqual({ a: { b: 1 } });
      });

      it('should handle array in target but object in source', () => {
        const target = { items: [1, 2, 3] };
        const source = { items: { a: 1 } };

        const result = deepMerge(target, source);

        expect(result.items).toEqual({ a: 1 });
      });

      it('should handle object in target but array in source', () => {
        const target = { items: { a: 1 } };
        const source = { items: [1, 2, 3] };

        const result = deepMerge(target, source);

        expect(result.items).toEqual([1, 2, 3]);
      });
    });
  });

  describe('deepUpdate', () => {
    it('should update nested fields', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
        },
      };

      const result = deepUpdate(obj, {
        'user.age': 31,
        'user.email': 'john@example.com',
      });

      expect(result).toEqual({
        user: {
          name: 'John',
          age: 31,
          email: 'john@example.com',
        },
      });
    });

    it('should not mutate original object', () => {
      const obj = { user: { name: 'John' } };
      const result = deepUpdate(obj, { 'user.age': 30 });

      expect(obj.user).toEqual({ name: 'John' });
      expect(result.user).toEqual({ name: 'John', age: 30 });
    });

    it('should create nested structure if needed', () => {
      const obj = {};

      const result = deepUpdate(obj, {
        'user.profile.name': 'John',
      });

      expect(result).toEqual({
        user: {
          profile: {
            name: 'John',
          },
        },
      });
    });

    it('should handle multiple updates', () => {
      const obj = { a: 1 };

      const result: any = deepUpdate(obj, {
        'b.c': 2,
        'd.e.f': 3,
        'g': 4,
      });

      expect(result.b.c).toBe(2);
      expect(result.d.e.f).toBe(3);
      expect(result.g).toBe(4);
    });
  });

  describe('cloneDeep', () => {
    it('should clone nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          tags: ['a', 'b'],
        },
      };

      const cloned = cloneDeep(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.user).not.toBe(obj.user);
      expect(cloned.user.tags).not.toBe(obj.user.tags);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = cloneDeep(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone dates', () => {
      const obj = { date: new Date('2024-01-01') };
      const cloned = cloneDeep(obj);

      expect(cloned.date).toEqual(obj.date);
      expect(cloned.date).not.toBe(obj.date);
      expect(cloned.date.getTime()).toBe(obj.date.getTime());
    });

    it('should clone regex', () => {
      const obj = { pattern: /test/gi };
      const cloned = cloneDeep(obj);

      expect(cloned.pattern).toEqual(obj.pattern);
      expect(cloned.pattern).not.toBe(obj.pattern);
      expect(cloned.pattern.source).toBe('test');
      expect(cloned.pattern.flags).toBe('gi');
    });

    it('should handle primitives', () => {
      expect(cloneDeep(null)).toBeNull();
      expect(cloneDeep(undefined)).toBeUndefined();
      expect(cloneDeep(42)).toBe(42);
      expect(cloneDeep('string')).toBe('string');
      expect(cloneDeep(true)).toBe(true);
    });
  });

  describe('mergeAtPath', () => {
    it('should merge object at specific path', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
        },
        settings: {
          theme: 'dark',
        },
      };

      const result = mergeAtPath(obj, 'user', { email: 'john@example.com' });

      expect(result).toEqual({
        user: {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
        },
      });
    });

    it('should not mutate original', () => {
      const obj = { user: { name: 'John' } };
      const result = mergeAtPath(obj, 'user', { age: 30 });

      expect(obj.user).toEqual({ name: 'John' });
      expect(result.user).toEqual({ name: 'John', age: 30 });
    });

    it('should handle non-object values at path', () => {
      const obj = { value: 'string' };
      const result = mergeAtPath(obj, 'value', { a: 1 });

      expect(result.value).toEqual({ a: 1 });
    });
  });

  describe('isDeepEqual', () => {
    it('should compare primitive values', () => {
      expect(isDeepEqual(1, 1)).toBe(true);
      expect(isDeepEqual('a', 'a')).toBe(true);
      expect(isDeepEqual(true, true)).toBe(true);
      expect(isDeepEqual(null, null)).toBe(true);
      expect(isDeepEqual(undefined, undefined)).toBe(true);
    });

    it('should compare objects', () => {
      expect(isDeepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(isDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(isDeepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should compare nested objects', () => {
      const obj1 = { user: { name: 'John', age: 30 } };
      const obj2 = { user: { name: 'John', age: 30 } };
      const obj3 = { user: { name: 'John', age: 31 } };

      expect(isDeepEqual(obj1, obj2)).toBe(true);
      expect(isDeepEqual(obj1, obj3)).toBe(false);
    });

    it('should compare arrays', () => {
      expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(isDeepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should compare arrays of objects', () => {
      const arr1 = [{ id: 1, name: 'Alice' }];
      const arr2 = [{ id: 1, name: 'Alice' }];
      const arr3 = [{ id: 1, name: 'Bob' }];

      expect(isDeepEqual(arr1, arr2)).toBe(true);
      expect(isDeepEqual(arr1, arr3)).toBe(false);
    });

    it('should compare dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');

      expect(isDeepEqual(date1, date2)).toBe(true);
      expect(isDeepEqual(date1, date3)).toBe(false);
    });

    it('should handle null vs undefined', () => {
      expect(isDeepEqual(null, undefined)).toBe(false);
      expect(isDeepEqual(null, null)).toBe(true);
      expect(isDeepEqual(undefined, undefined)).toBe(true);
    });

    it('should handle different types', () => {
      expect(isDeepEqual('1', 1)).toBe(false);
      expect(isDeepEqual([], {})).toBe(false);
      expect(isDeepEqual(true, 'true')).toBe(false);
    });
  });

  describe('getDiff', () => {
    it('should detect changed fields', () => {
      const oldObj = { name: 'John', age: 30 };
      const newObj = { name: 'John', age: 31 };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        age: { old: 30, new: 31 },
      });
    });

    it('should detect nested changes', () => {
      const oldObj = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const newObj = {
        user: {
          name: 'John',
          age: 31,
        },
      };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        'user.age': { old: 30, new: 31 },
      });
    });

    it('should detect added fields', () => {
      const oldObj = { name: 'John' };
      const newObj = { name: 'John', age: 30 };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        age: { old: undefined, new: 30 },
      });
    });

    it('should detect removed fields', () => {
      const oldObj = { name: 'John', age: 30 };
      const newObj = { name: 'John' };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        age: { old: 30, new: undefined },
      });
    });

    it('should detect array changes', () => {
      const oldObj = { items: [1, 2, 3] };
      const newObj = { items: [1, 2, 4] };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        items: { old: [1, 2, 3], new: [1, 2, 4] },
      });
    });

    it('should return empty object when no changes', () => {
      const obj = { user: { name: 'John', age: 30 } };

      const diff = getDiff(obj, obj);

      expect(diff).toEqual({});
    });

    it('should handle deeply nested changes', () => {
      const oldObj = {
        a: {
          b: {
            c: {
              value: 1,
            },
          },
        },
      };
      const newObj = {
        a: {
          b: {
            c: {
              value: 2,
            },
          },
        },
      };

      const diff = getDiff(oldObj, newObj);

      expect(diff).toEqual({
        'a.b.c.value': { old: 1, new: 2 },
      });
    });
  });

  describe('applyDiff', () => {
    it('should apply simple diff', () => {
      const obj = { name: 'John', age: 30 };
      const diff = {
        age: { old: 30, new: 31 },
      };

      const result = applyDiff(obj, diff);

      expect(result).toEqual({ name: 'John', age: 31 });
    });

    it('should apply nested diff', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const diff = {
        'user.age': { old: 30, new: 31 },
        'user.email': { old: undefined, new: 'john@example.com' },
      };

      const result = applyDiff(obj, diff);

      expect(result).toEqual({
        user: {
          name: 'John',
          age: 31,
          email: 'john@example.com',
        },
      });
    });

    it('should not mutate original', () => {
      const obj = { a: 1 };
      const diff = { a: { old: 1, new: 2 } };

      const result = applyDiff(obj, diff);

      expect(obj.a).toBe(1);
      expect(result.a).toBe(2);
    });

    it('should round-trip with getDiff', () => {
      const oldObj = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const newObj = {
        user: {
          name: 'John',
          age: 31,
          email: 'john@example.com',
        },
      };

      const diff = getDiff(oldObj, newObj);
      const applied = applyDiff(oldObj, diff);

      expect(isDeepEqual(applied, newObj)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex form update scenario', () => {
      const formData = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          profile: {
            bio: 'Developer',
            skills: ['JavaScript', 'TypeScript'],
          },
        },
        settings: {
          notifications: {
            email: true,
            sms: false,
          },
        },
      };

      const updates = {
        'user.firstName': 'Jane',
        'user.profile.skills': ['JavaScript', 'TypeScript', 'React'],
        'settings.notifications.sms': true,
      };

      const result = deepUpdate(formData, updates);

      expect(result.user.firstName).toBe('Jane');
      expect(result.user.profile.skills).toEqual(['JavaScript', 'TypeScript', 'React']);
      expect(result.settings.notifications.sms).toBe(true);
      expect(result.user.lastName).toBe('Doe'); // Preserved
    });

    it('should merge partial updates correctly', () => {
      const serverData = {
        user: {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          lastSeen: new Date('2024-01-01'),
        },
      };

      const clientUpdates = {
        user: {
          name: 'John Doe',
        },
      };

      const result = deepMerge(serverData, clientUpdates);

      expect(result.user.name).toBe('John Doe');
      expect(result.user.email).toBe('john@example.com'); // Preserved
      expect(result.user.lastSeen).toEqual(serverData.user.lastSeen);
    });

    it('should detect and apply complex changes', () => {
      const before = {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: true },
        ],
        settings: {
          theme: 'dark',
          language: 'en',
        },
      };

      const after = {
        users: [
          { id: 1, name: 'Alice Smith', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
        settings: {
          theme: 'light',
          language: 'en',
        },
      };

      const diff = getDiff(before, after);
      const applied = applyDiff(before, diff);

      expect(isDeepEqual(applied, after)).toBe(true);
    });
  });
});
