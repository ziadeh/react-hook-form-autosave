/**
 * Tests for PayloadCache
 * Covers caching, TTL, cleanup, and stats functionality
 */

import { PayloadCache, type CacheEntry } from '../payloadCache';
import type { SaveResult } from '../../core/types';

describe('PayloadCache', () => {
  let cache: PayloadCache;
  let mockResult: SaveResult;

  beforeEach(() => {
    cache = new PayloadCache();
    mockResult = {
      ok: true,
      metadata: { message: 'saved' },
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', mockResult);
      const result = cache.get('key1');

      expect(result).toEqual(mockResult);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should overwrite existing values', () => {
      const result1: SaveResult = { ok: true, version: '1' };
      const result2: SaveResult = { ok: false, error: new Error('failed') };

      cache.set('key1', result1);
      cache.set('key1', result2);

      expect(cache.get('key1')).toEqual(result2);
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', mockResult);
      expect(cache.size()).toBe(1);

      cache.set('key2', mockResult);
      expect(cache.size()).toBe(2);
    });

    it('should check if key exists', () => {
      cache.set('key1', mockResult);

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', mockResult);
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
      cache.set('key1', mockResult);
      cache.set('key2', mockResult);
      cache.set('key3', mockResult);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should return cached value before expiration', () => {
      const ttlMs = 5 * 60 * 1000; // 5 minutes
      cache.set('key1', mockResult);

      jest.advanceTimersByTime(ttlMs - 1000); // 4 minutes 59 seconds

      expect(cache.get('key1')).toEqual(mockResult);
    });

    it('should return null after TTL expires', () => {
      const ttlMs = 5 * 60 * 1000; // 5 minutes
      cache.set('key1', mockResult);

      jest.advanceTimersByTime(ttlMs + 1000); // 5 minutes 1 second

      expect(cache.get('key1')).toBeNull();
    });

    it('should remove expired entries on get', () => {
      cache.set('key1', mockResult);
      expect(cache.size()).toBe(1);

      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      cache.get('key1');
      expect(cache.size()).toBe(0);
    });

    it('should support custom TTL', () => {
      const customTtl = 1000; // 1 second
      const customCache = new PayloadCache(100, customTtl);

      customCache.set('key1', mockResult);
      jest.advanceTimersByTime(500); // 0.5 seconds

      expect(customCache.get('key1')).toEqual(mockResult);

      jest.advanceTimersByTime(600); // Total 1.1 seconds

      expect(customCache.get('key1')).toBeNull();
    });
  });

  describe('hits tracking', () => {
    it('should increment hit count on each get', () => {
      cache.set('key1', mockResult);

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const entries = cache.entries();
      const entry = entries.find(([key]) => key === 'key1')?.[1];

      expect(entry?.hits).toBe(3);
    });

    it('should start with 0 hits', () => {
      cache.set('key1', mockResult);

      const entries = cache.entries();
      const entry = entries.find(([key]) => key === 'key1')?.[1];

      expect(entry?.hits).toBe(0);
    });

    it('should reset hits when overwriting entry', () => {
      cache.set('key1', mockResult);
      cache.get('key1');
      cache.get('key1');

      cache.set('key1', mockResult);

      const entries = cache.entries();
      const entry = entries.find(([key]) => key === 'key1')?.[1];

      expect(entry?.hits).toBe(0);
    });
  });

  describe('max size and cleanup', () => {
    it('should enforce max size limit', () => {
      const smallCache = new PayloadCache(3);

      smallCache.set('key1', mockResult);
      smallCache.set('key2', mockResult);
      smallCache.set('key3', mockResult);
      smallCache.set('key4', mockResult);

      expect(smallCache.size()).toBeLessThanOrEqual(3);
    });

    it('should remove oldest entries when exceeding max size', () => {
      const smallCache = new PayloadCache(2);

      smallCache.set('key1', mockResult);
      jest.advanceTimersByTime(100);

      smallCache.set('key2', mockResult);
      jest.advanceTimersByTime(100);

      smallCache.set('key3', mockResult);

      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
    });

    it('should remove expired entries during cleanup before removing by timestamp', () => {
      const ttlMs = 1000;
      const smallCache = new PayloadCache(2, ttlMs);

      smallCache.set('key1', mockResult);
      jest.advanceTimersByTime(1500); // Expire key1

      smallCache.set('key2', mockResult);
      smallCache.set('key3', mockResult); // This should trigger cleanup

      // key1 should be removed due to expiration, not by timestamp
      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
    });

    it('should handle adding to cache at max capacity', () => {
      const smallCache = new PayloadCache(1);

      smallCache.set('key1', mockResult);
      smallCache.set('key2', mockResult);

      expect(smallCache.size()).toBe(1);
      expect(smallCache.has('key2')).toBe(true);
    });
  });

  describe('keys and entries', () => {
    it('should return all keys', () => {
      cache.set('key1', mockResult);
      cache.set('key2', mockResult);
      cache.set('key3', mockResult);

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
      cache.set('key1', mockResult);
      cache.set('key2', mockResult);

      const entries = cache.entries();

      expect(entries.length).toBe(2);
      expect(entries.every(([key, entry]) => typeof key === 'string' && entry.result)).toBe(true);
    });

    it('should return entries with correct structure', () => {
      cache.set('key1', mockResult);

      const entries = cache.entries();
      const [key, entry] = entries[0];

      expect(key).toBe('key1');
      expect(entry).toHaveProperty('result');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('hits');
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats).toEqual({
        size: 0,
        totalHits: 0,
        averageHits: 0,
        oldestEntry: 0,
        newestEntry: 0,
      });
    });

    it('should return correct stats with entries', () => {
      cache.set('key1', mockResult);
      cache.get('key1');
      cache.get('key1');

      jest.advanceTimersByTime(1000);

      cache.set('key2', mockResult);
      cache.get('key2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.totalHits).toBe(3);
      expect(stats.averageHits).toBe(1.5);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
    });

    it('should calculate average hits correctly', () => {
      cache.set('key1', mockResult);
      cache.get('key1'); // 1 hit
      cache.get('key1'); // 2 hits

      cache.set('key2', mockResult);
      cache.get('key2'); // 1 hit

      cache.set('key3', mockResult); // 0 hits

      const stats = cache.getStats();

      expect(stats.totalHits).toBe(3);
      expect(stats.averageHits).toBe(1); // (2 + 1 + 0) / 3
    });

    it('should track oldest and newest entries', () => {
      const time1 = Date.now();
      cache.set('key1', mockResult);

      jest.advanceTimersByTime(1000);
      const time2 = Date.now();
      cache.set('key2', mockResult);

      jest.advanceTimersByTime(1000);
      const time3 = Date.now();
      cache.set('key3', mockResult);

      const stats = cache.getStats();

      expect(stats.oldestEntry).toBeCloseTo(time1, -2);
      expect(stats.newestEntry).toBeCloseTo(time3, -2);
      expect(stats.newestEntry).toBeGreaterThan(stats.oldestEntry);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in keys', () => {
      const specialKeys = ['key:with:colon', 'key.with.dot', 'key-with-dash', 'key_with_underscore'];

      specialKeys.forEach((key) => {
        cache.set(key, mockResult);
        expect(cache.get(key)).toEqual(mockResult);
      });
    });

    it('should handle numeric string keys', () => {
      cache.set('123', mockResult);
      cache.set('456', mockResult);

      expect(cache.get('123')).toEqual(mockResult);
      expect(cache.get('456')).toEqual(mockResult);
    });

    it('should handle empty string key', () => {
      cache.set('', mockResult);

      expect(cache.get('')).toEqual(mockResult);
    });

    it('should handle different SaveResult types', () => {
      const successResult: SaveResult = {
        ok: true,
        version: '1',
        metadata: { id: 1 },
      };
      const failureResult: SaveResult = {
        ok: false,
        error: new Error('Failed'),
        code: 'SAVE_ERROR',
      };

      cache.set('success', successResult);
      cache.set('failure', failureResult);

      expect(cache.get('success')).toEqual(successResult);
      expect(cache.get('failure')).toEqual(failureResult);
    });

    it('should not affect other entries when one expires', () => {
      cache.set('key1', mockResult);
      jest.advanceTimersByTime(6 * 60 * 1000); // Expire key1

      cache.set('key2', mockResult);

      cache.get('key1'); // Should be null
      expect(cache.get('key2')).toEqual(mockResult);
      expect(cache.size()).toBe(1);
    });

    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, mockResult);
      }

      expect(cache.size()).toBeLessThanOrEqual(100);
    });

    it('should handle default constructor parameters', () => {
      const defaultCache = new PayloadCache();

      for (let i = 0; i < 150; i++) {
        defaultCache.set(`key${i}`, mockResult);
      }

      expect(defaultCache.size()).toBeLessThanOrEqual(100);
    });
  });
});
