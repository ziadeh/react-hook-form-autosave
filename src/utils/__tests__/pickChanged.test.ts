/**
 * Tests for pickChanged utility
 * Covers extraction of dirty/changed values from form state
 */

import { pickChanged } from '../pickChanged';

describe('pickChanged', () => {
  describe('flat objects', () => {
    it('should pick changed fields marked as true', () => {
      const values = { name: 'John', age: 30, city: 'NYC' };
      const dirty = { name: true, age: true };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        name: 'John',
        age: 30,
      });
    });

    it('should return empty object when no fields are dirty', () => {
      const values = { name: 'John', age: 30 };
      const dirty = {};

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle single dirty field', () => {
      const values = { name: 'John', age: 30, city: 'NYC' };
      const dirty = { name: true };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        name: 'John',
      });
    });

    it('should handle all fields dirty', () => {
      const values = { name: 'John', age: 30, city: 'NYC' };
      const dirty = { name: true, age: true, city: true };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        name: 'John',
        age: 30,
        city: 'NYC',
      });
    });

    it('should handle undefined dirty', () => {
      const values = { name: 'John', age: 30 };
      const dirty = undefined;

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle null dirty', () => {
      const values = { name: 'John', age: 30 };
      const dirty = null;

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });
  });

  describe('nested objects', () => {
    it('should pick nested dirty fields', () => {
      const values = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
        },
      };
      const dirty = {
        user: {
          name: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {
          name: 'John',
        },
      });
    });

    it('should handle multiple nested levels', () => {
      const values = {
        user: {
          profile: {
            name: 'John',
            bio: 'Developer',
          },
          settings: {
            theme: 'dark',
          },
        },
      };
      const dirty = {
        user: {
          profile: {
            name: true,
          },
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {
          profile: {
            name: 'John',
          },
        },
      });
    });

    it('should handle multiple dirty fields in nested objects', () => {
      const values = {
        user: {
          name: 'John',
          email: 'john@example.com',
          age: 30,
        },
      };
      const dirty = {
        user: {
          name: true,
          email: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      });
    });

    it('should not include nested object if no fields are dirty', () => {
      const values = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
        },
      };
      const dirty = {
        user: {},
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle missing nested values', () => {
      const values = {
        user: undefined,
      };
      const dirty = {
        user: {
          name: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {},
      });
    });

    it('should handle null nested values', () => {
      const values = {
        user: null,
      };
      const dirty = {
        user: {
          name: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {},
      });
    });
  });

  describe('mixed flat and nested', () => {
    it('should handle combination of flat and nested dirty fields', () => {
      const values = {
        name: 'John',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'NYC',
          zip: '10001',
        },
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      };
      const dirty = {
        name: true,
        address: {
          city: true,
          zip: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        name: 'John',
        address: {
          city: 'NYC',
          zip: '10001',
        },
      });
    });

    it('should handle deeply nested structures', () => {
      const values = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };
      const dirty = {
        level1: {
          level2: {
            level3: {
              value: true,
            },
          },
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      });
    });
  });

  describe('arrays', () => {
    it('should handle array values when field is dirty', () => {
      const values = {
        tags: ['react', 'typescript', 'jest'],
        count: 5,
      };
      const dirty = {
        tags: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        tags: ['react', 'typescript', 'jest'],
      });
    });

    it('should handle nested array fields', () => {
      const values = {
        user: {
          hobbies: ['reading', 'coding'],
        },
      };
      const dirty = {
        user: {
          hobbies: true,
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        user: {
          hobbies: ['reading', 'coding'],
        },
      });
    });
  });

  describe('special values', () => {
    it('should handle boolean values', () => {
      const values = {
        isActive: true,
        isAdmin: false,
      };
      const dirty = {
        isActive: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        isActive: true,
      });
    });

    it('should handle numeric zero', () => {
      const values = {
        count: 0,
        total: 100,
      };
      const dirty = {
        count: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        count: 0,
      });
    });

    it('should handle empty string', () => {
      const values = {
        name: '',
        description: 'text',
      };
      const dirty = {
        name: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        name: '',
      });
    });

    it('should handle null values', () => {
      const values = {
        optional: null,
        required: 'value',
      };
      const dirty = {
        optional: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        optional: null,
      });
    });

    it('should handle undefined values', () => {
      const values = {
        missing: undefined,
        present: 'value',
      };
      const dirty = {
        missing: true,
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        missing: undefined,
      });
    });
  });

  describe('edge cases', () => {
    it('should not mutate original values', () => {
      const values = { name: 'John', age: 30 };
      const originalValues = { ...values };
      const dirty = { name: true };

      pickChanged(values, dirty);

      expect(values).toEqual(originalValues);
    });

    it('should not mutate dirty object', () => {
      const values = { name: 'John', age: 30 };
      const dirty = { name: true };
      const originalDirty = { ...dirty };

      pickChanged(values, dirty);

      expect(dirty).toEqual(originalDirty);
    });

    it('should handle dirty values that are false', () => {
      const values = { name: 'John', age: 30 };
      const dirty = { name: false };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle dirty values that are numbers', () => {
      const values = { name: 'John', age: 30 };
      const dirty = { name: 1 };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle dirty values that are strings', () => {
      const values = { name: 'John', age: 30 };
      const dirty = { name: 'yes' };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle empty nested objects in dirty', () => {
      const values = {
        user: {
          name: 'John',
        },
      };
      const dirty = {
        user: {},
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({});
    });

    it('should handle complex real-world form scenario', () => {
      const values = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        profile: {
          bio: 'Developer',
          avatar: 'avatar.jpg',
          social: {
            twitter: '@john',
            github: 'johndoe',
          },
        },
        settings: {
          notifications: {
            email: true,
            sms: false,
          },
          privacy: {
            public: true,
          },
        },
      };

      const dirty = {
        firstName: true,
        profile: {
          bio: true,
          social: {
            twitter: true,
          },
        },
        settings: {
          notifications: {
            email: true,
          },
        },
      };

      const result = pickChanged(values, dirty);

      expect(result).toEqual({
        firstName: 'John',
        profile: {
          bio: 'Developer',
          social: {
            twitter: '@john',
          },
        },
        settings: {
          notifications: {
            email: true,
          },
        },
      });
    });
  });
});
