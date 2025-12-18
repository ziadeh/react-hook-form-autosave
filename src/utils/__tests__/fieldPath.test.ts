/**
 * Tests for fieldPath utilities
 * Covers path parsing, manipulation, and traversal
 */

import {
  parsePath,
  joinPath,
  getByPath,
  setByPath,
  deleteByPath,
  hasPath,
  getParentPath,
  getFieldName,
  isParentPath,
  isChildPath,
  getAllPaths,
  normalizePath,
  cloneAlongPath,
  type PathSegment,
} from '../fieldPath';

describe('fieldPath utilities', () => {
  describe('parsePath', () => {
    it('should parse simple dot notation', () => {
      expect(parsePath('user.name')).toEqual(['user', 'name']);
      expect(parsePath('user.profile.email')).toEqual(['user', 'profile', 'email']);
    });

    it('should parse bracket notation with numbers', () => {
      expect(parsePath('users[0]')).toEqual(['users', 0]);
      expect(parsePath('items[0][1]')).toEqual(['items', 0, 1]);
    });

    it('should parse mixed notation', () => {
      expect(parsePath('users[0].name')).toEqual(['users', 0, 'name']);
      expect(parsePath('data.items[2].value')).toEqual(['data', 'items', 2, 'value']);
    });

    it('should handle single segment', () => {
      expect(parsePath('name')).toEqual(['name']);
    });

    it('should handle empty string', () => {
      expect(parsePath('')).toEqual([]);
    });

    it('should handle complex paths', () => {
      expect(parsePath('a.b[0].c[1].d')).toEqual(['a', 'b', 0, 'c', 1, 'd']);
    });

    it('should handle consecutive brackets', () => {
      expect(parsePath('matrix[0][1][2]')).toEqual(['matrix', 0, 1, 2]);
    });

    it('should handle trailing dots', () => {
      expect(parsePath('user.name.')).toEqual(['user', 'name']);
    });
  });

  describe('joinPath', () => {
    it('should join simple segments', () => {
      expect(joinPath(['user', 'name'])).toBe('user.name');
      expect(joinPath(['a', 'b', 'c'])).toBe('a.b.c');
    });

    it('should join with array indices', () => {
      expect(joinPath(['users', 0])).toBe('users[0]');
      expect(joinPath(['items', 0, 'value'])).toBe('items[0].value');
    });

    it('should handle mixed segments', () => {
      expect(joinPath(['data', 'items', 2, 'name'])).toBe('data.items[2].name');
    });

    it('should handle empty array', () => {
      expect(joinPath([])).toBe('');
    });

    it('should handle single segment', () => {
      expect(joinPath(['name'])).toBe('name');
    });

    it('should round-trip with parsePath', () => {
      const paths = [
        'user.name',
        'users[0].name',
        'data.items[0].values[1]',
        'a.b.c.d.e',
      ];

      paths.forEach((path) => {
        expect(joinPath(parsePath(path))).toBe(path);
      });
    });
  });

  describe('getByPath', () => {
    const testObj = {
      user: {
        name: 'John',
        profile: {
          email: 'john@example.com',
          age: 30,
        },
      },
      users: [
        { name: 'Alice', id: 1 },
        { name: 'Bob', id: 2 },
      ],
      settings: {
        items: [
          { value: 'a' },
          { value: 'b' },
        ],
      },
    };

    it('should get simple nested values', () => {
      expect(getByPath(testObj, 'user.name')).toBe('John');
      expect(getByPath(testObj, 'user.profile.email')).toBe('john@example.com');
    });

    it('should get array elements', () => {
      expect(getByPath(testObj, 'users[0].name')).toBe('Alice');
      expect(getByPath(testObj, 'users[1].id')).toBe(2);
    });

    it('should get nested array values', () => {
      expect(getByPath(testObj, 'settings.items[0].value')).toBe('a');
      expect(getByPath(testObj, 'settings.items[1].value')).toBe('b');
    });

    it('should return undefined for non-existent paths', () => {
      expect(getByPath(testObj, 'user.missing')).toBeUndefined();
      expect(getByPath(testObj, 'users[10]')).toBeUndefined();
    });

    it('should handle null/undefined objects', () => {
      expect(getByPath(null, 'user.name')).toBeUndefined();
      expect(getByPath(undefined, 'user.name')).toBeUndefined();
    });

    it('should accept path segments array', () => {
      expect(getByPath(testObj, ['user', 'name'])).toBe('John');
      expect(getByPath(testObj, ['users', 0, 'name'])).toBe('Alice');
    });

    it('should handle root level access', () => {
      expect(getByPath({ name: 'test' }, 'name')).toBe('test');
    });
  });

  describe('setByPath', () => {
    it('should set simple nested values', () => {
      const obj: any = {};
      setByPath(obj, 'user.name', 'John');
      expect(obj).toEqual({ user: { name: 'John' } });
    });

    it('should set deeply nested values', () => {
      const obj: any = {};
      setByPath(obj, 'user.profile.email', 'john@example.com');
      expect(obj).toEqual({
        user: {
          profile: {
            email: 'john@example.com',
          },
        },
      });
    });

    it('should create arrays when needed', () => {
      const obj: any = {};
      setByPath(obj, 'users[0].name', 'Alice');
      expect(obj).toEqual({
        users: [{ name: 'Alice' }],
      });
    });

    it('should handle mixed array and object paths', () => {
      const obj: any = {};
      setByPath(obj, 'data.items[0].value', 'test');
      expect(obj).toEqual({
        data: {
          items: [{ value: 'test' }],
        },
      });
    });

    it('should overwrite existing values', () => {
      const obj = { user: { name: 'John' } };
      setByPath(obj, 'user.name', 'Jane');
      expect(obj.user.name).toBe('Jane');
    });

    it('should handle root level setting', () => {
      const obj: any = {};
      setByPath(obj, 'name', 'test');
      expect(obj.name).toBe('test');
    });

    it('should accept path segments array', () => {
      const obj: any = {};
      setByPath(obj, ['user', 'name'], 'John');
      expect(obj.user.name).toBe('John');
    });

    it('should handle setting in existing partial structures', () => {
      const obj = { user: {} };
      setByPath(obj, 'user.name', 'John');
      expect(obj).toEqual({ user: { name: 'John' } });
    });
  });

  describe('deleteByPath', () => {
    it('should delete simple nested values', () => {
      const obj = { user: { name: 'John', age: 30 } };
      expect(deleteByPath(obj, 'user.age')).toBe(true);
      expect(obj).toEqual({ user: { name: 'John' } });
    });

    it('should delete array elements', () => {
      const obj = { users: ['Alice', 'Bob', 'Charlie'] };
      expect(deleteByPath(obj, 'users[1]')).toBe(true);
      expect(obj.users[1]).toBeUndefined();
      expect(obj.users.length).toBe(3); // Array length unchanged
    });

    it('should return false for non-existent paths', () => {
      const obj = { user: { name: 'John' } };
      expect(deleteByPath(obj, 'user.missing')).toBe(false);
      expect(deleteByPath(obj, 'missing.path')).toBe(false);
    });

    it('should handle nested deletions', () => {
      const obj = {
        user: {
          profile: {
            email: 'john@example.com',
            age: 30,
          },
        },
      };
      expect(deleteByPath(obj, 'user.profile.age')).toBe(true);
      expect(obj.user.profile).toEqual({ email: 'john@example.com' });
    });

    it('should handle null/undefined objects', () => {
      expect(deleteByPath(null, 'user.name')).toBe(false);
      expect(deleteByPath(undefined, 'user.name')).toBe(false);
    });
  });

  describe('hasPath', () => {
    const testObj = {
      user: {
        name: 'John',
        age: null,
        active: undefined,
      },
      users: [{ id: 1 }],
    };

    it('should return true for existing paths', () => {
      expect(hasPath(testObj, 'user.name')).toBe(true);
      expect(hasPath(testObj, 'users[0].id')).toBe(true);
    });

    it('should return false for non-existent paths', () => {
      expect(hasPath(testObj, 'user.missing')).toBe(false);
      expect(hasPath(testObj, 'users[1]')).toBe(false);
    });

    it('should return true for null values', () => {
      expect(hasPath(testObj, 'user.age')).toBe(true);
    });

    it('should return true for undefined values', () => {
      expect(hasPath(testObj, 'user.active')).toBe(true);
    });

    it('should handle null/undefined objects', () => {
      expect(hasPath(null, 'user.name')).toBe(false);
      expect(hasPath(undefined, 'user.name')).toBe(false);
    });
  });

  describe('getParentPath', () => {
    it('should return parent path', () => {
      expect(getParentPath('user.profile.name')).toBe('user.profile');
      expect(getParentPath('user.name')).toBe('user');
    });

    it('should handle array notation', () => {
      expect(getParentPath('users[0].name')).toBe('users[0]');
      expect(getParentPath('items[0]')).toBe('items');
    });

    it('should return empty string for root level', () => {
      expect(getParentPath('name')).toBe('');
    });

    it('should handle complex paths', () => {
      expect(getParentPath('a.b[0].c[1].d')).toBe('a.b[0].c[1]');
    });
  });

  describe('getFieldName', () => {
    it('should return last segment', () => {
      expect(getFieldName('user.profile.name')).toBe('name');
      expect(getFieldName('user.name')).toBe('name');
    });

    it('should return index for array paths', () => {
      expect(getFieldName('users[0]')).toBe(0);
      expect(getFieldName('items[0].value')).toBe('value');
    });

    it('should handle single segment', () => {
      expect(getFieldName('name')).toBe('name');
    });

    it('should handle empty string', () => {
      expect(getFieldName('')).toBe('');
    });
  });

  describe('isParentPath', () => {
    it('should identify parent paths', () => {
      expect(isParentPath('user', 'user.name')).toBe(true);
      expect(isParentPath('user.profile', 'user.profile.email')).toBe(true);
    });

    it('should handle array paths', () => {
      expect(isParentPath('users', 'users[0].name')).toBe(true);
      expect(isParentPath('users[0]', 'users[0].name')).toBe(true);
    });

    it('should return false for non-parent paths', () => {
      expect(isParentPath('user.name', 'user.email')).toBe(false);
      expect(isParentPath('user', 'profile.name')).toBe(false);
    });

    it('should return false for equal paths', () => {
      expect(isParentPath('user.name', 'user.name')).toBe(false);
    });

    it('should return true for empty parent path', () => {
      expect(isParentPath('', 'user.name')).toBe(true);
    });
  });

  describe('isChildPath', () => {
    it('should identify child paths', () => {
      expect(isChildPath('user.name', 'user')).toBe(true);
      expect(isChildPath('user.profile.email', 'user.profile')).toBe(true);
    });

    it('should be inverse of isParentPath', () => {
      expect(isChildPath('user.name', 'user')).toBe(isParentPath('user', 'user.name'));
      expect(isChildPath('user.email', 'user.name')).toBe(
        isParentPath('user.name', 'user.email')
      );
    });
  });

  describe('getAllPaths', () => {
    it('should get all paths in simple object', () => {
      const obj = {
        name: 'John',
        age: 30,
      };
      const paths = getAllPaths(obj);
      expect(paths).toContain('name');
      expect(paths).toContain('age');
    });

    it('should get all paths in nested object', () => {
      const obj = {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
          },
        },
      };
      const paths = getAllPaths(obj);
      expect(paths).toContain('user');
      expect(paths).toContain('user.name');
      expect(paths).toContain('user.profile');
      expect(paths).toContain('user.profile.email');
    });

    it('should handle arrays', () => {
      const obj = {
        users: ['Alice', 'Bob'],
      };
      const paths = getAllPaths(obj);
      expect(paths).toContain('users');
      expect(paths).toContain('users[0]');
      expect(paths).toContain('users[1]');
    });

    it('should handle arrays of objects', () => {
      const obj = {
        users: [
          { name: 'Alice', id: 1 },
          { name: 'Bob', id: 2 },
        ],
      };
      const paths = getAllPaths(obj);
      expect(paths).toContain('users');
      expect(paths).toContain('users[0]');
      expect(paths).toContain('users[0].name');
      expect(paths).toContain('users[0].id');
      expect(paths).toContain('users[1]');
      expect(paths).toContain('users[1].name');
    });

    it('should exclude arrays when includeArrays is false', () => {
      const obj = {
        users: ['Alice', 'Bob'],
      };
      const paths = getAllPaths(obj, '', false);
      expect(paths).not.toContain('users');
      expect(paths).toContain('users[0]');
      expect(paths).toContain('users[1]');
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths', () => {
      expect(normalizePath('user.name')).toBe('user.name');
      expect(normalizePath('users[0].name')).toBe('users[0].name');
    });

    it('should handle already normalized paths', () => {
      expect(normalizePath('a.b.c')).toBe('a.b.c');
    });
  });

  describe('cloneAlongPath', () => {
    it('should clone objects along path', () => {
      const obj = {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
          },
        },
        other: { data: 'unchanged' },
      };

      const cloned = cloneAlongPath(obj, 'user.name');
      cloned.user.name = 'Jane';

      expect(obj.user.name).toBe('John');
      expect(cloned.user.name).toBe('Jane');
      expect(cloned.other).toBe(obj.other); // Shallow copy
    });

    it('should handle array cloning', () => {
      const obj = {
        users: [{ name: 'John' }, { name: 'Jane' }],
      };

      const cloned = cloneAlongPath(obj, 'users[0].name');
      cloned.users[0].name = 'Bob';

      expect(obj.users[0].name).toBe('John');
      expect(cloned.users[0].name).toBe('Bob');
    });

    it('should return same value for primitives', () => {
      expect(cloneAlongPath('string', 'path')).toBe('string');
      expect(cloneAlongPath(123, 'path')).toBe(123);
      expect(cloneAlongPath(null, 'path')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle paths with special characters in brackets', () => {
      const obj = { items: { 'special-key': 'value' } };
      expect(getByPath(obj, 'items.special-key')).toBe('value');
    });

    it('should handle empty objects', () => {
      expect(getAllPaths({})).toEqual([]);
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      // Should not infinite loop
      expect(() => getByPath(obj, 'self.name')).not.toThrow();
      expect(getByPath(obj, 'self.name')).toBe('test');
    });
  });
});
