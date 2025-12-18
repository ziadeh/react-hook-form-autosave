/**
 * Tests for pendingChanges helper functions
 * Covers isPending and reconcilePendingField functionality
 */

import { isPending, reconcilePendingField } from '../pendingChanges';
import type { UndoRedoOptions, PendingChanges } from '../../types/types';

describe('pendingChanges', () => {
  describe('isPending', () => {
    it('should return true when value differs from initial', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('name', 'Jane', opts);

      expect(result).toBe(true);
    });

    it('should return false when value equals initial', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('name', 'John', opts);

      expect(result).toBe(false);
    });

    it('should use deepEqual for comparison', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { user: { id: 1, name: 'John' } } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      const result = isPending('user', { id: 1, name: 'John' }, opts);

      expect(result).toBe(false);
    });

    it('should detect deep object changes', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { user: { id: 1, name: 'John' } } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      const result = isPending('user', { id: 1, name: 'Jane' }, opts);

      expect(result).toBe(true);
    });

    it('should handle null values', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { value: null } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('value', null, opts);

      expect(result).toBe(false);
    });

    it('should handle undefined values', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { value: undefined } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('value', undefined, opts);

      expect(result).toBe(false);
    });

    it('should detect change from null to value', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { value: null } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('value', 'something', opts);

      expect(result).toBe(true);
    });

    it('should handle nested paths with custom get function', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { user: { profile: { name: 'John' } } } },
        get: (obj: any, path: any) => {
          const parts = path.split('.');
          return parts.reduce((acc: any, part: any) => acc?.[part], obj);
        },
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      const result = isPending('user.profile.name', 'Jane', opts);

      expect(result).toBe(true);
    });

    it('should handle arrays', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { tags: ['react', 'typescript'] } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      const result = isPending('tags', ['react', 'typescript'], opts);

      expect(result).toBe(false);
    });

    it('should detect array changes', () => {
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { tags: ['react', 'typescript'] } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      const result = isPending('tags', ['react', 'javascript'], opts);

      expect(result).toBe(true);
    });
  });

  describe('reconcilePendingField', () => {
    it('should add field to pending when value differs from initial', () => {
      const pending = new Set<string>() as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('name', 'Jane', pending, opts);

      expect(pending.has('name')).toBe(true);
    });

    it('should remove field from pending when value matches initial', () => {
      const pending = new Set<string>(['name']) as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('name', 'John', pending, opts);

      expect(pending.has('name')).toBe(false);
    });

    it('should handle multiple field reconciliations', () => {
      const pending = new Set<string>() as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John', age: 30, city: 'NYC' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('name', 'Jane', pending, opts);
      reconcilePendingField('age', 30, pending, opts);
      reconcilePendingField('city', 'LA', pending, opts);

      expect(pending.has('name')).toBe(true);
      expect(pending.has('age')).toBe(false);
      expect(pending.has('city')).toBe(true);
    });

    it('should not add field if already in pending and still pending', () => {
      const pending = new Set<string>(['name']) as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('name', 'Jane', pending, opts);

      expect(pending.has('name')).toBe(true);
      expect(pending.size).toBe(1);
    });

    it('should handle complex objects', () => {
      const pending = new Set<string>() as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { user: { id: 1, name: 'John' } } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      reconcilePendingField('user', { id: 1, name: 'Jane' }, pending, opts);

      expect(pending.has('user')).toBe(true);
    });

    it('should remove complex object from pending when restored', () => {
      const pending = new Set<string>(['user']) as PendingChanges;
      const initialUser = { id: 1, name: 'John' };
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { user: initialUser } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
      } as any;

      reconcilePendingField('user', { id: 1, name: 'John' }, pending, opts);

      expect(pending.has('user')).toBe(false);
    });

    it('should handle empty pending set', () => {
      const pending = new Set<string>() as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { name: 'John' } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('name', 'John', pending, opts);

      expect(pending.size).toBe(0);
    });

    it('should handle null values', () => {
      const pending = new Set<string>() as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { value: null } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('value', 'something', pending, opts);

      expect(pending.has('value')).toBe(true);
    });

    it('should handle transition back to null', () => {
      const pending = new Set<string>(['value']) as PendingChanges;
      const opts: UndoRedoOptions = {
        initialValuesRef: { current: { value: null } },
        get: (obj: any, path: any) => obj[path],
        deepEqual: (a: any, b: any) => a === b,
      } as any;

      reconcilePendingField('value', null, pending, opts);

      expect(pending.has('value')).toBe(false);
    });
  });
});
