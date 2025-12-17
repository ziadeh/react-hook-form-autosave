/**
 * Tests for ValidationCache
 * Covers validation result caching and cleanup functionality
 */

import { ValidationCache } from '../validationCache';

describe('ValidationCache', () => {
  let cache: ValidationCache;

  beforeEach(() => {
    cache = new ValidationCache();
  });

  describe('basic operations', () => {
    it('should store and retrieve boolean values', () => {
      cache.set('key1', true);
      cache.set('key2', false);

      expect(cache.get('key1')).toBe(true);
      expect(cache.get('key2')).toBe(false);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get('non-existent');

      expect(result).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', true);
      cache.set('key1', false);

      expect(cache.get('key1')).toBe(false);
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', true);
      expect(cache.size()).toBe(1);

      cache.set('key2', false);
      expect(cache.size()).toBe(2);
    });

    it('should check if key exists', () => {
      cache.set('key1', true);

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', true);
      expect(cache.has('key1')).toBe(true);

      const deleted = cache.delete('key1');

      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent');

      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', true);
      cache.set('key2', false);
      cache.set('key3', true);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('max size and cleanup', () => {
    it('should enforce max size limit', () => {
      const smallCache = new ValidationCache(3);

      smallCache.set('key1', true);
      smallCache.set('key2', false);
      smallCache.set('key3', true);
      smallCache.set('key4', false);

      expect(smallCache.size()).toBeLessThanOrEqual(3);
    });

    it('should remove oldest entries when exceeding max size', () => {
      const smallCache = new ValidationCache(2);

      smallCache.set('key1', true);
      smallCache.set('key2', false);
      smallCache.set('key3', true);

      // key1 should be removed (oldest)
      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.size()).toBe(2);
    });

    it('should handle adding to cache at max capacity', () => {
      const smallCache = new ValidationCache(1);

      smallCache.set('key1', true);
      smallCache.set('key2', false);

      expect(smallCache.size()).toBe(1);
      expect(smallCache.has('key2')).toBe(true);
    });

    it('should remove correct number of entries when cleanup is triggered', () => {
      const smallCache = new ValidationCache(3);

      smallCache.set('key1', true);
      smallCache.set('key2', false);
      smallCache.set('key3', true);
      smallCache.set('key4', false);
      smallCache.set('key5', true);

      expect(smallCache.size()).toBe(3);
    });

    it('should handle default max size', () => {
      const defaultCache = new ValidationCache();

      for (let i = 0; i < 60; i++) {
        defaultCache.set(`key${i}`, i % 2 === 0);
      }

      expect(defaultCache.size()).toBeLessThanOrEqual(50);
    });
  });

  describe('keys and entries', () => {
    it('should return all keys', () => {
      cache.set('key1', true);
      cache.set('key2', false);
      cache.set('key3', true);

      const keys = cache.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });

    it('should return empty array when no keys', () => {
      const keys = cache.keys();

      expect(keys).toEqual([]);
    });

    it('should return all entries', () => {
      cache.set('key1', true);
      cache.set('key2', false);

      const entries = cache.entries();

      expect(entries.length).toBe(2);
      expect(entries).toContainEqual(['key1', true]);
      expect(entries).toContainEqual(['key2', false]);
    });

    it('should return entries as tuples', () => {
      cache.set('key1', true);

      const entries = cache.entries();
      const [key, value] = entries[0];

      expect(typeof key).toBe('string');
      expect(typeof value).toBe('boolean');
    });
  });

  describe('validation scenarios', () => {
    it('should cache valid validation results', () => {
      const payload1 = JSON.stringify({ email: 'test@example.com' });
      const payload2 = JSON.stringify({ email: 'invalid' });

      cache.set(payload1, true);
      cache.set(payload2, false);

      expect(cache.get(payload1)).toBe(true);
      expect(cache.get(payload2)).toBe(false);
    });

    it('should handle repeated validation of same payload', () => {
      const payload = JSON.stringify({ email: 'test@example.com' });

      cache.set(payload, true);
      cache.set(payload, true);
      cache.set(payload, true);

      expect(cache.size()).toBe(1);
      expect(cache.get(payload)).toBe(true);
    });

    it('should handle changing validation result for same key', () => {
      const key = 'validation-key';

      cache.set(key, false);
      expect(cache.get(key)).toBe(false);

      cache.set(key, true);
      expect(cache.get(key)).toBe(true);
    });

    it('should cache multiple different validations', () => {
      const keys = [
        'email-validation',
        'password-validation',
        'phone-validation',
        'name-validation',
      ];

      keys.forEach((key, index) => {
        cache.set(key, index % 2 === 0);
      });

      expect(cache.get('email-validation')).toBe(true);
      expect(cache.get('password-validation')).toBe(false);
      expect(cache.get('phone-validation')).toBe(true);
      expect(cache.get('name-validation')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in keys', () => {
      const specialKeys = [
        'key:with:colon',
        'key.with.dot',
        'key-with-dash',
        'key_with_underscore',
        'key with space',
      ];

      specialKeys.forEach((key, index) => {
        cache.set(key, index % 2 === 0);
        expect(cache.get(key)).toBe(index % 2 === 0);
      });
    });

    it('should handle numeric string keys', () => {
      cache.set('123', true);
      cache.set('456', false);

      expect(cache.get('123')).toBe(true);
      expect(cache.get('456')).toBe(false);
    });

    it('should handle empty string key', () => {
      cache.set('', true);

      expect(cache.get('')).toBe(true);
    });

    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(1000);
      cache.set(longKey, true);

      expect(cache.get(longKey)).toBe(true);
    });

    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, i % 2 === 0);
      }

      expect(cache.size()).toBeLessThanOrEqual(50);

      // Check that recent entries are still there
      expect(cache.has('key99')).toBe(true);
      expect(cache.has('key98')).toBe(true);
    });

    it('should handle alternating true/false values', () => {
      cache.set('key1', true);
      cache.set('key1', false);
      cache.set('key1', true);
      cache.set('key1', false);

      expect(cache.get('key1')).toBe(false);
      expect(cache.size()).toBe(1);
    });

    it('should maintain independence between different instances', () => {
      const cache1 = new ValidationCache();
      const cache2 = new ValidationCache();

      cache1.set('key1', true);
      cache2.set('key1', false);

      expect(cache1.get('key1')).toBe(true);
      expect(cache2.get('key1')).toBe(false);
    });

    it('should handle mixed operations', () => {
      cache.set('key1', true);
      cache.set('key2', false);
      cache.delete('key1');
      cache.set('key3', true);
      cache.clear();
      cache.set('key4', false);

      expect(cache.size()).toBe(1);
      expect(cache.get('key4')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('performance considerations', () => {
    it('should handle max size boundary correctly', () => {
      const maxSize = 10;
      const testCache = new ValidationCache(maxSize);

      for (let i = 0; i < maxSize + 5; i++) {
        testCache.set(`key${i}`, true);
      }

      expect(testCache.size()).toBe(maxSize);

      // Most recent entries should still be present
      expect(testCache.has(`key${maxSize + 4}`)).toBe(true);
      expect(testCache.has(`key${maxSize + 3}`)).toBe(true);
    });

    it('should efficiently handle large number of operations', () => {
      const largeCache = new ValidationCache(100);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        largeCache.set(`key${i}`, i % 2 === 0);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(largeCache.size()).toBeLessThanOrEqual(100);
    });
  });
});
