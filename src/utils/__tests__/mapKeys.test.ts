/**
 * Tests for mapKeys utility
 * Covers key mapping and transformation functionality
 */

import { mapKeys, createKeyMapper, type KeyMap } from '../mapKeys';

describe('mapKeys', () => {
  describe('basic key mapping', () => {
    it('should map simple string keys', () => {
      const payload = { firstName: 'John', lastName: 'Doe' };
      const keyMap: KeyMap = {
        firstName: 'first_name',
        lastName: 'last_name',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
      });
    });

    it('should preserve unmapped keys', () => {
      const payload = { name: 'John', age: 30, city: 'NYC' };
      const keyMap: KeyMap = {
        name: 'full_name',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        full_name: 'John',
        age: 30,
        city: 'NYC',
      });
    });

    it('should handle empty payload', () => {
      const payload = {};
      const keyMap: KeyMap = {
        name: 'full_name',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({});
    });

    it('should handle empty keyMap', () => {
      const payload = { name: 'John', age: 30 };
      const keyMap: KeyMap = {};

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        name: 'John',
        age: 30,
      });
    });
  });

  describe('key mapping with transformations', () => {
    it('should apply transformation function', () => {
      const payload = { name: 'john', age: 30 };
      const keyMap: KeyMap = {
        name: ['full_name', (v: string) => v.toUpperCase()],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        full_name: 'JOHN',
        age: 30,
      });
    });

    it('should handle multiple transformations', () => {
      const payload = {
        price: '100',
        quantity: '5',
        name: 'Product',
      };
      const keyMap: KeyMap = {
        price: ['cost', (v: string) => parseFloat(v)],
        quantity: ['qty', (v: string) => parseInt(v, 10)],
        name: 'product_name',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        cost: 100,
        qty: 5,
        product_name: 'Product',
      });
    });

    it('should handle null values in transformation', () => {
      const payload = { name: null };
      const keyMap: KeyMap = {
        name: ['full_name', (v: any) => v || 'Unknown'],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        full_name: 'Unknown',
      });
    });

    it('should handle undefined values in transformation', () => {
      const payload = { name: undefined };
      const keyMap: KeyMap = {
        name: ['full_name', (v: any) => v ?? 'Default'],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        full_name: 'Default',
      });
    });

    it('should handle complex object transformations', () => {
      const payload = {
        user: { firstName: 'John', lastName: 'Doe' },
      };
      const keyMap: KeyMap = {
        user: ['person', (v: any) => `${v.firstName} ${v.lastName}`],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        person: 'John Doe',
      });
    });

    it('should handle array transformations', () => {
      const payload = {
        tags: ['one', 'two', 'three'],
      };
      const keyMap: KeyMap = {
        tags: ['categories', (v: string[]) => v.join(',')],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        categories: 'one,two,three',
      });
    });
  });

  describe('mixed mapping types', () => {
    it('should handle both string and tuple mappings', () => {
      const payload = {
        firstName: 'John',
        lastName: 'Doe',
        age: '30',
        city: 'NYC',
      };
      const keyMap: KeyMap = {
        firstName: 'first_name',
        lastName: 'last_name',
        age: ['user_age', (v: string) => parseInt(v, 10)],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        user_age: 30,
        city: 'NYC',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle boolean values', () => {
      const payload = { isActive: true, isAdmin: false };
      const keyMap: KeyMap = {
        isActive: 'active',
        isAdmin: 'admin',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        active: true,
        admin: false,
      });
    });

    it('should handle numeric keys in payload', () => {
      const payload = { 0: 'first', 1: 'second' };
      const keyMap: KeyMap = {
        '0': 'zero',
        '1': 'one',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        zero: 'first',
        one: 'second',
      });
    });

    it('should handle special characters in keys', () => {
      const payload = { 'user-name': 'John', 'user.email': 'john@example.com' };
      const keyMap: KeyMap = {
        'user-name': 'userName',
        'user.email': 'userEmail',
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        userName: 'John',
        userEmail: 'john@example.com',
      });
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01');
      const payload = { createdAt: date };
      const keyMap: KeyMap = {
        createdAt: ['created_at', (v: Date) => v.toISOString()],
      };

      const result = mapKeys(payload, keyMap);

      expect(result).toEqual({
        created_at: date.toISOString(),
      });
    });

    it('should not mutate original payload', () => {
      const payload = { name: 'John', age: 30 };
      const originalPayload = { ...payload };
      const keyMap: KeyMap = {
        name: 'full_name',
      };

      mapKeys(payload, keyMap);

      expect(payload).toEqual(originalPayload);
    });
  });
});

describe('createKeyMapper', () => {
  it('should create a reusable mapper function', () => {
    const keyMap: KeyMap = {
      firstName: 'first_name',
      lastName: 'last_name',
    };
    const mapper = createKeyMapper(keyMap);

    const result = mapper({ firstName: 'John', lastName: 'Doe' });

    expect(result).toEqual({
      first_name: 'John',
      last_name: 'Doe',
    });
  });

  it('should work with multiple payloads', () => {
    const keyMap: KeyMap = {
      name: 'full_name',
      age: ['user_age', (v: number) => v + 1],
    };
    const mapper = createKeyMapper(keyMap);

    const result1 = mapper({ name: 'John', age: 30 });
    const result2 = mapper({ name: 'Jane', age: 25 });

    expect(result1).toEqual({
      full_name: 'John',
      user_age: 31,
    });
    expect(result2).toEqual({
      full_name: 'Jane',
      user_age: 26,
    });
  });

  it('should return a function', () => {
    const keyMap: KeyMap = {};
    const mapper = createKeyMapper(keyMap);

    expect(typeof mapper).toBe('function');
  });

  it('should work with transformations', () => {
    const keyMap: KeyMap = {
      price: ['cost', (v: string) => parseFloat(v) * 2],
    };
    const mapper = createKeyMapper(keyMap);

    const result = mapper({ price: '100' });

    expect(result).toEqual({
      cost: 200,
    });
  });
});
