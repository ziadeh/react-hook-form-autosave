/**
 * Tests for nested array diffing utilities
 * Covers array change detection and diffing
 */

import {
  diffArrays,
  applyArrayDiff,
  detectNestedArrayChanges,
  findArrayFields,
  summarizeArrayDiff,
  mergeArrayDiffs,
  type ArrayDiffResult,
  type ArrayDiffOptions,
} from '../nestedArrayDiff';

describe('nested array diffing', () => {
  describe('diffArrays', () => {
    describe('additions', () => {
      it('should detect added items', () => {
        const oldArray = [{ id: 1, name: 'Alice' }];
        const newArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.added).toEqual([{ id: 2, name: 'Bob' }]);
        expect(diff.removed).toEqual([]);
        expect(diff.modified).toEqual([]);
        expect(diff.hasChanges).toBe(true);
      });

      it('should detect multiple additions', () => {
        const oldArray = [{ id: 1, name: 'Alice' }];
        const newArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.added.length).toBe(2);
        expect(diff.added).toContainEqual({ id: 2, name: 'Bob' });
        expect(diff.added).toContainEqual({ id: 3, name: 'Charlie' });
      });
    });

    describe('removals', () => {
      it('should detect removed items', () => {
        const oldArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];
        const newArray = [{ id: 1, name: 'Alice' }];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.removed).toEqual([{ id: 2, name: 'Bob' }]);
        expect(diff.added).toEqual([]);
        expect(diff.modified).toEqual([]);
        expect(diff.hasChanges).toBe(true);
      });

      it('should detect multiple removals', () => {
        const oldArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ];
        const newArray = [{ id: 2, name: 'Bob' }];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.removed.length).toBe(2);
      });
    });

    describe('modifications', () => {
      it('should detect modified items', () => {
        const oldArray = [{ id: 1, name: 'Alice', age: 25 }];
        const newArray = [{ id: 1, name: 'Alice', age: 26 }];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.modified.length).toBe(1);
        expect(diff.modified[0].before).toEqual({ id: 1, name: 'Alice', age: 25 });
        expect(diff.modified[0].after).toEqual({ id: 1, name: 'Alice', age: 26 });
        expect(diff.hasChanges).toBe(true);
      });

      it('should track field-level changes', () => {
        const oldArray = [{ id: 1, name: 'Alice', age: 25, city: 'NYC' }];
        const newArray = [{ id: 1, name: 'Alice', age: 26, city: 'LA' }];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.modified[0].changes).toEqual({
          age: { before: 25, after: 26 },
          city: { before: 'NYC', after: 'LA' },
        });
      });

      it('should not track field changes when disabled', () => {
        const oldArray = [{ id: 1, name: 'Alice', age: 25 }];
        const newArray = [{ id: 1, name: 'Alice', age: 26 }];

        const diff = diffArrays(oldArray, newArray, { trackFieldChanges: false });

        expect(diff.modified[0].changes).toBeUndefined();
      });
    });

    describe('reordering', () => {
      it('should not track reordering by default', () => {
        const oldArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];
        const newArray = [
          { id: 2, name: 'Bob' },
          { id: 1, name: 'Alice' },
        ];

        const diff = diffArrays(oldArray, newArray);

        expect(diff.reordered).toBeUndefined();
      });

      it('should detect reordering when enabled', () => {
        const oldArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];
        const newArray = [
          { id: 2, name: 'Bob' },
          { id: 1, name: 'Alice' },
        ];

        const diff = diffArrays(oldArray, newArray, { trackOrder: true });

        expect(diff.reordered).toBeDefined();
        expect(diff.reordered!.length).toBe(2);
        expect(diff.reordered).toContainEqual({
          item: { id: 1, name: 'Alice' },
          oldIndex: 0,
          newIndex: 1,
        });
        expect(diff.reordered).toContainEqual({
          item: { id: 2, name: 'Bob' },
          oldIndex: 1,
          newIndex: 0,
        });
      });
    });

    describe('custom identity key', () => {
      it('should use custom identity key', () => {
        const oldArray = [{ _id: 'a', name: 'Alice' }];
        const newArray = [
          { _id: 'a', name: 'Alice' },
          { _id: 'b', name: 'Bob' },
        ];

        const diff = diffArrays(oldArray, newArray, { identityKey: '_id' });

        expect(diff.added).toEqual([{ _id: 'b', name: 'Bob' }]);
      });

      it('should handle uuid keys', () => {
        const oldArray = [{ uuid: 'abc-123', value: 1 }];
        const newArray = [
          { uuid: 'abc-123', value: 2 },
          { uuid: 'def-456', value: 3 },
        ];

        const diff = diffArrays(oldArray, newArray, { identityKey: 'uuid' });

        expect(diff.added.length).toBe(1);
        expect(diff.modified.length).toBe(1);
      });
    });

    describe('custom equality function', () => {
      it('should use custom equality function', () => {
        const oldArray = [{ id: 1, value: '10' }];
        const newArray = [{ id: 1, value: '10.0' }];

        // With strict equality, this is a change
        const strictDiff = diffArrays(oldArray, newArray);
        expect(strictDiff.modified.length).toBe(1);

        // With custom equality that compares numeric values, no change
        const looseDiff = diffArrays(oldArray, newArray, {
          equalityFn: (a, b) => parseFloat(a) === parseFloat(b),
        });
        expect(looseDiff.modified.length).toBe(0);
      });
    });

    describe('no changes', () => {
      it('should detect when arrays are identical', () => {
        const array = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];

        const diff = diffArrays(array, array);

        expect(diff.added).toEqual([]);
        expect(diff.removed).toEqual([]);
        expect(diff.modified).toEqual([]);
        expect(diff.hasChanges).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty arrays', () => {
        const diff = diffArrays([], []);

        expect(diff.hasChanges).toBe(false);
      });

      it('should handle adding to empty array', () => {
        const diff = diffArrays([], [{ id: 1, name: 'Alice' }]);

        expect(diff.added).toEqual([{ id: 1, name: 'Alice' }]);
        expect(diff.hasChanges).toBe(true);
      });

      it('should handle clearing array', () => {
        const diff = diffArrays([{ id: 1, name: 'Alice' }], []);

        expect(diff.removed).toEqual([{ id: 1, name: 'Alice' }]);
        expect(diff.hasChanges).toBe(true);
      });

      it('should handle items without identity key', () => {
        const oldArray = [{ name: 'Alice' }];
        const newArray = [{ name: 'Bob' }];

        const diff = diffArrays(oldArray, newArray);

        // Without id, items are matched by undefined key
        expect(diff.hasChanges).toBe(true);
      });
    });
  });

  describe('applyArrayDiff', () => {
    it('should apply additions', () => {
      const array = [{ id: 1, name: 'Alice' }];
      const diff: ArrayDiffResult = {
        added: [{ id: 2, name: 'Bob' }],
        removed: [],
        modified: [],
        hasChanges: true,
      };

      const result = applyArrayDiff(array, diff);

      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('should apply removals', () => {
      const array = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const diff: ArrayDiffResult = {
        added: [],
        removed: [{ id: 2, name: 'Bob' }],
        modified: [],
        hasChanges: true,
      };

      const result = applyArrayDiff(array, diff);

      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('should apply modifications', () => {
      const array = [{ id: 1, name: 'Alice', age: 25 }];
      const diff: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [
          {
            before: { id: 1, name: 'Alice', age: 25 },
            after: { id: 1, name: 'Alice', age: 26 },
          },
        ],
        hasChanges: true,
      };

      const result = applyArrayDiff(array, diff);

      expect(result).toEqual([{ id: 1, name: 'Alice', age: 26 }]);
    });

    it('should apply combined changes', () => {
      const array = [
        { id: 1, name: 'Alice', age: 25 },
        { id: 2, name: 'Bob', age: 30 },
      ];
      const diff: ArrayDiffResult = {
        added: [{ id: 3, name: 'Charlie', age: 35 }],
        removed: [{ id: 2, name: 'Bob', age: 30 }],
        modified: [
          {
            before: { id: 1, name: 'Alice', age: 25 },
            after: { id: 1, name: 'Alice', age: 26 },
          },
        ],
        hasChanges: true,
      };

      const result = applyArrayDiff(array, diff);

      expect(result).toEqual([
        { id: 1, name: 'Alice', age: 26 },
        { id: 3, name: 'Charlie', age: 35 },
      ]);
    });
  });

  describe('detectNestedArrayChanges', () => {
    it('should detect changes in nested arrays', () => {
      const oldObj = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };
      const newObj = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 3, name: 'Charlie' },
        ],
      };

      const diffs = detectNestedArrayChanges(oldObj, newObj, ['users']);

      expect(diffs['users']).toBeDefined();
      expect(diffs['users'].added).toEqual([{ id: 3, name: 'Charlie' }]);
      expect(diffs['users'].removed).toEqual([{ id: 2, name: 'Bob' }]);
    });

    it('should detect changes in multiple arrays', () => {
      const oldObj = {
        users: [{ id: 1, name: 'Alice' }],
        tags: [{ id: 1, label: 'tag1' }],
      };
      const newObj = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        tags: [{ id: 2, label: 'tag2' }],
      };

      const diffs = detectNestedArrayChanges(oldObj, newObj, ['users', 'tags']);

      expect(Object.keys(diffs)).toContain('users');
      expect(Object.keys(diffs)).toContain('tags');
      expect(diffs['users'].added.length).toBe(1);
      expect(diffs['tags'].added.length).toBe(1);
      expect(diffs['tags'].removed.length).toBe(1);
    });

    it('should detect changes in deeply nested arrays', () => {
      const oldObj = {
        data: {
          items: [{ id: 1, value: 'a' }],
        },
      };
      const newObj = {
        data: {
          items: [{ id: 1, value: 'b' }],
        },
      };

      const diffs = detectNestedArrayChanges(oldObj, newObj, ['data.items']);

      expect(diffs['data.items']).toBeDefined();
      expect(diffs['data.items'].modified.length).toBe(1);
    });

    it('should skip non-array fields', () => {
      const oldObj = { name: 'test' };
      const newObj = { name: 'test2' };

      const diffs = detectNestedArrayChanges(oldObj, newObj, ['name']);

      expect(Object.keys(diffs).length).toBe(0);
    });

    it('should only return paths with changes', () => {
      const oldObj = {
        users: [{ id: 1, name: 'Alice' }],
        tags: [{ id: 1, label: 'tag1' }],
      };
      const newObj = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        tags: [{ id: 1, label: 'tag1' }], // No changes
      };

      const diffs = detectNestedArrayChanges(oldObj, newObj, ['users', 'tags']);

      expect(Object.keys(diffs)).toEqual(['users']);
      expect(diffs['tags']).toBeUndefined();
    });
  });

  describe('findArrayFields', () => {
    it('should find all array fields', () => {
      const obj = {
        users: [{ id: 1 }],
        tags: ['a', 'b'],
        settings: {
          items: [1, 2, 3],
        },
      };

      const arrayFields = findArrayFields(obj);

      expect(arrayFields).toContain('users');
      expect(arrayFields).toContain('tags');
      expect(arrayFields).toContain('settings.items');
    });

    it('should handle nested objects without arrays', () => {
      const obj = {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
          },
        },
      };

      const arrayFields = findArrayFields(obj);

      expect(arrayFields).toEqual([]);
    });

    it('should handle empty objects', () => {
      const arrayFields = findArrayFields({});

      expect(arrayFields).toEqual([]);
    });

    it('should find deeply nested arrays', () => {
      const obj = {
        a: {
          b: {
            c: {
              items: [1, 2, 3],
            },
          },
        },
      };

      const arrayFields = findArrayFields(obj);

      expect(arrayFields).toContain('a.b.c.items');
    });
  });

  describe('summarizeArrayDiff', () => {
    it('should summarize additions', () => {
      const diff: ArrayDiffResult = {
        added: [{}, {}],
        removed: [],
        modified: [],
        hasChanges: true,
      };

      expect(summarizeArrayDiff(diff)).toBe('+2 added');
    });

    it('should summarize removals', () => {
      const diff: ArrayDiffResult = {
        added: [],
        removed: [{}],
        modified: [],
        hasChanges: true,
      };

      expect(summarizeArrayDiff(diff)).toBe('-1 removed');
    });

    it('should summarize modifications', () => {
      const diff: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [{ before: {}, after: {} }],
        hasChanges: true,
      };

      expect(summarizeArrayDiff(diff)).toBe('1 modified');
    });

    it('should summarize combined changes', () => {
      const diff: ArrayDiffResult = {
        added: [{}, {}],
        removed: [{}],
        modified: [{ before: {}, after: {} }, { before: {}, after: {} }],
        hasChanges: true,
      };

      expect(summarizeArrayDiff(diff)).toBe('+2 added, -1 removed, 2 modified');
    });

    it('should summarize no changes', () => {
      const diff: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [],
        hasChanges: false,
      };

      expect(summarizeArrayDiff(diff)).toBe('no changes');
    });

    it('should include reordering', () => {
      const diff: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [],
        reordered: [{}, {}] as any,
        hasChanges: false,
      };

      expect(summarizeArrayDiff(diff)).toBe('2 reordered');
    });
  });

  describe('mergeArrayDiffs', () => {
    it('should merge multiple diffs', () => {
      const diff1: ArrayDiffResult = {
        added: [{ id: 1 }],
        removed: [],
        modified: [],
        hasChanges: true,
      };
      const diff2: ArrayDiffResult = {
        added: [{ id: 2 }],
        removed: [{ id: 3 }],
        modified: [],
        hasChanges: true,
      };

      const merged = mergeArrayDiffs(diff1, diff2);

      expect(merged.added).toEqual([{ id: 1 }, { id: 2 }]);
      expect(merged.removed).toEqual([{ id: 3 }]);
      expect(merged.hasChanges).toBe(true);
    });

    it('should merge modifications', () => {
      const diff1: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [{ before: { id: 1 }, after: { id: 1, v: 2 } }],
        hasChanges: true,
      };
      const diff2: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [{ before: { id: 2 }, after: { id: 2, v: 3 } }],
        hasChanges: true,
      };

      const merged = mergeArrayDiffs(diff1, diff2);

      expect(merged.modified.length).toBe(2);
    });

    it('should handle empty diffs', () => {
      const diff: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [],
        hasChanges: false,
      };

      const merged = mergeArrayDiffs(diff, diff);

      expect(merged.hasChanges).toBe(false);
    });

    it('should merge reordered arrays', () => {
      const diff1: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [],
        reordered: [{ item: {}, oldIndex: 0, newIndex: 1 }],
        hasChanges: false,
      };
      const diff2: ArrayDiffResult = {
        added: [],
        removed: [],
        modified: [],
        reordered: [{ item: {}, oldIndex: 2, newIndex: 3 }],
        hasChanges: false,
      };

      const merged = mergeArrayDiffs(diff1, diff2);

      expect(merged.reordered).toBeDefined();
      expect(merged.reordered!.length).toBe(2);
    });
  });

  describe('complex scenarios', () => {
    it('should handle real-world user management scenario', () => {
      const oldUsers = [
        { id: 1, name: 'Alice', role: 'admin', active: true },
        { id: 2, name: 'Bob', role: 'user', active: true },
        { id: 3, name: 'Charlie', role: 'user', active: false },
      ];

      const newUsers = [
        { id: 1, name: 'Alice', role: 'admin', active: true }, // Unchanged
        { id: 2, name: 'Robert', role: 'user', active: true }, // Modified name
        { id: 4, name: 'David', role: 'user', active: true }, // Added
        // Charlie (id: 3) removed
      ];

      const diff = diffArrays(oldUsers, newUsers);

      expect(diff.added.length).toBe(1);
      expect(diff.added[0].id).toBe(4);
      expect(diff.removed.length).toBe(1);
      expect(diff.removed[0].id).toBe(3);
      expect(diff.modified.length).toBe(1);
      expect(diff.modified[0].after.name).toBe('Robert');
      expect(diff.modified[0].changes).toEqual({
        name: { before: 'Bob', after: 'Robert' },
      });
    });

    it('should handle nested object updates within array items', () => {
      const oldArray = [
        {
          id: 1,
          user: {
            profile: {
              name: 'John',
              age: 30,
            },
          },
        },
      ];
      const newArray = [
        {
          id: 1,
          user: {
            profile: {
              name: 'John',
              age: 31,
            },
          },
        },
      ];

      const diff = diffArrays(oldArray, newArray);

      expect(diff.modified.length).toBe(1);
      expect(diff.modified[0].changes).toBeDefined();
    });

    it('should auto-detect array fields and compute all diffs', () => {
      const oldObj = {
        users: [{ id: 1, name: 'Alice' }],
        settings: {
          tags: [{ id: 1, label: 'tag1' }],
        },
      };
      const newObj = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        settings: {
          tags: [{ id: 2, label: 'tag2' }],
        },
      };

      const arrayPaths = findArrayFields(oldObj);
      const diffs = detectNestedArrayChanges(oldObj, newObj, arrayPaths);

      expect(Object.keys(diffs).length).toBe(2);
      expect(diffs['users'].added.length).toBe(1);
      expect(diffs['settings.tags'].hasChanges).toBe(true);
    });
  });
});
