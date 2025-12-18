/**
 * Tests for nested key mapping utilities
 * Covers path-based key transformations and restructuring
 */

import {
  mapNestedKeys,
  createNestedKeyMapper,
  reverseNestedKeyMap,
  flattenObject,
  unflattenObject,
  mergeNestedKeyMaps,
  validateNestedKeyMap,
  type NestedKeyMap,
} from '../nestedKeyMap';

describe('nested key mapping', () => {
  describe('mapNestedKeys', () => {
    it('should map simple nested paths', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result).toEqual({
        user: {
          first_name: 'John',
          last_name: 'Doe',
        },
      });
    });

    it('should handle transformations', () => {
      const payload = {
        user: {
          name: 'john',
          age: '30',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.name': ['user.fullName', (v: string) => v.toUpperCase()],
        'user.age': ['user.years', (v: string) => parseInt(v, 10)],
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result).toEqual({
        user: {
          fullName: 'JOHN',
          years: 30,
        },
      });
    });

    it('should handle flatten option', () => {
      const payload = {
        user: {
          profile: {
            email: 'john@example.com',
          },
        },
      };

      const keyMap: NestedKeyMap = {
        'user.profile.email': {
          to: 'contact_email',
          flatten: true,
        },
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result.contact_email).toBe('john@example.com');
    });

    it('should preserve unmapped fields by default', () => {
      const payload = {
        user: {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.name': 'user.fullName',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result).toEqual({
        user: {
          fullName: 'John',
          age: 30,
          email: 'john@example.com',
        },
      });
    });

    it('should only map specified fields when preserveUnmapped is false', () => {
      const payload = {
        user: {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.name': 'userName',
      };

      const result = mapNestedKeys(payload, keyMap, { preserveUnmapped: false });

      expect(result).toEqual({
        userName: 'John',
      });
    });

    it('should handle restructuring across different paths', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
        meta: {
          timestamp: 123456,
        },
      };

      const keyMap: NestedKeyMap = {
        'user.firstName': 'profile.name.first',
        'user.lastName': 'profile.name.last',
        'meta.timestamp': 'createdAt',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result).toEqual({
        profile: {
          name: {
            first: 'John',
            last: 'Doe',
          },
        },
        createdAt: 123456,
      });
    });

    it('should handle array values', () => {
      const payload = {
        user: {
          skills: ['JavaScript', 'TypeScript'],
        },
      };

      const keyMap: NestedKeyMap = {
        'user.skills': 'userSkills',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result.userSkills).toEqual(['JavaScript', 'TypeScript']);
    });

    it('should skip undefined values', () => {
      const payload = {
        user: {
          name: 'John',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.email': 'contact.email',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result).toEqual({
        user: {
          name: 'John',
        },
      });
    });

    it('should handle deep nesting', () => {
      const payload = {
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      };

      const keyMap: NestedKeyMap = {
        'a.b.c.d': 'x.y.z',
      };

      const result = mapNestedKeys(payload, keyMap);

      expect(result.x.y.z).toBe('value');
    });

    it('should handle custom flatten separator', () => {
      const payload = {
        user: {
          name: 'John',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.name': {
          to: 'user.name',
          flatten: true,
        },
      };

      const result = mapNestedKeys(payload, keyMap, { flattenSeparator: '-' });

      expect(result['user-name']).toBe('John');
    });
  });

  describe('createNestedKeyMapper', () => {
    it('should create reusable mapper function', () => {
      const keyMap: NestedKeyMap = {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      };

      const mapper = createNestedKeyMapper(keyMap);

      const result1 = mapper({
        user: { firstName: 'John', lastName: 'Doe' },
      });

      const result2 = mapper({
        user: { firstName: 'Jane', lastName: 'Smith' },
      });

      expect(result1.user.first_name).toBe('John');
      expect(result2.user.first_name).toBe('Jane');
    });

    it('should accept options', () => {
      const mapper = createNestedKeyMapper(
        { 'user.name': 'userName' },
        { preserveUnmapped: false }
      );

      const result = mapper({
        user: { name: 'John', age: 30 },
      });

      expect(result).toEqual({ userName: 'John' });
    });
  });

  describe('reverseNestedKeyMap', () => {
    it('should reverse simple mappings', () => {
      const keyMap: NestedKeyMap = {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      };

      const reversed = reverseNestedKeyMap(keyMap);

      expect(reversed).toEqual({
        'user.first_name': 'user.firstName',
        'user.last_name': 'user.lastName',
      });
    });

    it('should reverse tuple mappings', () => {
      const keyMap: NestedKeyMap = {
        'user.name': ['userName', (v: string) => v.toUpperCase()],
      };

      const reversed = reverseNestedKeyMap(keyMap);

      expect(reversed['userName']).toBe('user.name');
    });

    it('should reverse object mappings', () => {
      const keyMap: NestedKeyMap = {
        'user.email': {
          to: 'contact.email',
          flatten: true,
        },
      };

      const reversed = reverseNestedKeyMap(keyMap);

      expect(reversed['contact.email']).toBe('user.email');
    });

    it('should allow round-trip mapping', () => {
      const original = {
        user: { firstName: 'John', lastName: 'Doe' },
      };

      const formToApi: NestedKeyMap = {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      };

      const apiToForm = reverseNestedKeyMap(formToApi);

      const apiFormat = mapNestedKeys(original, formToApi);
      const backToForm = mapNestedKeys(apiFormat, apiToForm);

      expect(backToForm).toEqual(original);
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
        },
      };

      const flattened = flattenObject(obj);

      expect(flattened).toEqual({
        'user.name': 'John',
        'user.age': 30,
      });
    });

    it('should handle deep nesting', () => {
      const obj = {
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      };

      const flattened = flattenObject(obj);

      expect(flattened).toEqual({
        'a.b.c.d': 'value',
      });
    });

    it('should preserve arrays', () => {
      const obj = {
        user: {
          skills: ['JS', 'TS'],
        },
      };

      const flattened = flattenObject(obj);

      expect(flattened['user.skills']).toEqual(['JS', 'TS']);
    });

    it('should handle custom separator', () => {
      const obj = {
        user: {
          name: 'John',
        },
      };

      const flattened = flattenObject(obj, '-');

      expect(flattened).toEqual({
        'user-name': 'John',
      });
    });

    it('should handle empty objects', () => {
      expect(flattenObject({})).toEqual({});
    });

    it('should handle root level fields', () => {
      const obj = {
        name: 'John',
        age: 30,
      };

      const flattened = flattenObject(obj);

      expect(flattened).toEqual({
        name: 'John',
        age: 30,
      });
    });
  });

  describe('unflattenObject', () => {
    it('should unflatten dot notation keys', () => {
      const flat = {
        'user.name': 'John',
        'user.age': 30,
      };

      const unflattened = unflattenObject(flat);

      expect(unflattened).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
      });
    });

    it('should handle deep paths', () => {
      const flat = {
        'a.b.c.d': 'value',
      };

      const unflattened = unflattenObject(flat);

      expect(unflattened).toEqual({
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      });
    });

    it('should handle custom separator', () => {
      const flat = {
        'user-name': 'John',
        'user-age': 30,
      };

      const unflattened = unflattenObject(flat, '-');

      expect(unflattened).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
      });
    });

    it('should round-trip with flattenObject', () => {
      const original = {
        user: {
          profile: {
            name: 'John',
            email: 'john@example.com',
          },
          settings: {
            theme: 'dark',
          },
        },
      };

      const flattened = flattenObject(original);
      const unflattened = unflattenObject(flattened);

      expect(unflattened).toEqual(original);
    });
  });

  describe('mergeNestedKeyMaps', () => {
    it('should merge multiple key maps', () => {
      const map1: NestedKeyMap = {
        'user.firstName': 'user.first_name',
      };

      const map2: NestedKeyMap = {
        'user.lastName': 'user.last_name',
      };

      const merged = mergeNestedKeyMaps(map1, map2);

      expect(merged).toEqual({
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      });
    });

    it('should override earlier mappings with later ones', () => {
      const map1: NestedKeyMap = {
        'user.name': 'userName',
      };

      const map2: NestedKeyMap = {
        'user.name': 'fullName',
      };

      const merged = mergeNestedKeyMaps(map1, map2);

      expect(merged['user.name']).toBe('fullName');
    });

    it('should handle empty maps', () => {
      const map1: NestedKeyMap = {
        'user.name': 'userName',
      };

      const merged = mergeNestedKeyMaps({}, map1, {});

      expect(merged).toEqual(map1);
    });
  });

  describe('validateNestedKeyMap', () => {
    it('should return empty array for valid map', () => {
      const keyMap: NestedKeyMap = {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
      };

      const conflicts = validateNestedKeyMap(keyMap);

      expect(conflicts).toEqual([]);
    });

    it('should detect duplicate target paths', () => {
      const keyMap: NestedKeyMap = {
        'user.name': 'userName',
        'user.fullName': 'userName', // Conflict!
      };

      const conflicts = validateNestedKeyMap(keyMap);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0]).toContain('user.fullName -> userName');
      expect(conflicts[0]).toContain('conflicts with');
    });

    it('should detect multiple conflicts', () => {
      const keyMap: NestedKeyMap = {
        'a': 'x',
        'b': 'x', // Conflict 1
        'c': 'y',
        'd': 'y', // Conflict 2
      };

      const conflicts = validateNestedKeyMap(keyMap);

      expect(conflicts.length).toBe(2);
    });

    it('should validate tuple mappings', () => {
      const keyMap: NestedKeyMap = {
        'user.name': ['userName', (v) => v],
        'user.fullName': ['userName', (v) => v], // Conflict
      };

      const conflicts = validateNestedKeyMap(keyMap);

      expect(conflicts.length).toBe(1);
    });

    it('should validate object mappings', () => {
      const keyMap: NestedKeyMap = {
        'user.email': { to: 'email' },
        'contact.email': { to: 'email' }, // Conflict
      };

      const conflicts = validateNestedKeyMap(keyMap);

      expect(conflicts.length).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle real-world form to API mapping', () => {
      const formData = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        settings: {
          notifications: true,
          theme: 'dark',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.firstName': 'profile.first_name',
        'user.lastName': 'profile.last_name',
        'user.email': 'contact_email',
        'settings.notifications': 'preferences.notify',
        'settings.theme': ['preferences.ui_theme', (v) => v.toUpperCase()],
      };

      const apiData = mapNestedKeys(formData, keyMap, { preserveUnmapped: false });

      expect(apiData).toEqual({
        profile: {
          first_name: 'John',
          last_name: 'Doe',
        },
        contact_email: 'john@example.com',
        preferences: {
          notify: true,
          ui_theme: 'DARK',
        },
      });
    });

    it('should handle partial updates', () => {
      const formData = {
        user: {
          email: 'newemail@example.com',
        },
      };

      const keyMap: NestedKeyMap = {
        'user.firstName': 'profile.first_name',
        'user.lastName': 'profile.last_name',
        'user.email': 'contact_email',
      };

      const apiData = mapNestedKeys(formData, keyMap);

      expect(apiData).toEqual({
        contact_email: 'newemail@example.com',
      });
    });

    it('should support bi-directional mapping', () => {
      const formToApi: NestedKeyMap = {
        'user.firstName': 'first_name',
        'user.lastName': 'last_name',
      };

      const apiToForm = reverseNestedKeyMap(formToApi);

      const formData = { user: { firstName: 'John', lastName: 'Doe' } };
      const apiData = mapNestedKeys(formData, formToApi, { preserveUnmapped: false });
      const backToForm = mapNestedKeys(apiData, apiToForm, { preserveUnmapped: false });

      expect(backToForm).toEqual(formData);
    });
  });
});
