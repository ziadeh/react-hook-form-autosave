/**
 * Tests for MetricsCollector
 * Covers metrics collection, calculation, and reporting
 */

import { MetricsCollector, type AutosaveMetrics } from '../collector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('initialization', () => {
    it('should initialize with zero metrics', () => {
      const metrics = collector.getMetrics();

      expect(metrics).toEqual({
        totalSaves: 0,
        successfulSaves: 0,
        failedSaves: 0,
        averageDebounceTime: 0,
        averageSaveTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        retryCount: 0,
      });
    });

    it('should be enabled by default', () => {
      collector.recordSave(100, true);
      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(1);
    });

    it('should support disabled initialization', () => {
      const disabledCollector = new MetricsCollector(false);
      disabledCollector.recordSave(100, true);
      const metrics = disabledCollector.getMetrics();

      expect(metrics.totalSaves).toBe(0);
    });
  });

  describe('recordSave', () => {
    it('should record successful save', () => {
      collector.recordSave(100, true);
      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(1);
      expect(metrics.successfulSaves).toBe(1);
      expect(metrics.failedSaves).toBe(0);
    });

    it('should record failed save', () => {
      collector.recordSave(100, false);
      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(1);
      expect(metrics.successfulSaves).toBe(0);
      expect(metrics.failedSaves).toBe(1);
    });

    it('should record multiple saves', () => {
      collector.recordSave(100, true);
      collector.recordSave(200, true);
      collector.recordSave(150, false);
      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(3);
      expect(metrics.successfulSaves).toBe(2);
      expect(metrics.failedSaves).toBe(1);
    });

    it('should update average save time', () => {
      collector.recordSave(100, true);
      collector.recordSave(200, true);
      const metrics = collector.getMetrics();

      expect(metrics.averageSaveTime).toBe(150); // (100 + 200) / 2
    });

    it('should calculate average correctly with multiple saves', () => {
      collector.recordSave(100, true);
      collector.recordSave(200, true);
      collector.recordSave(300, true);
      const metrics = collector.getMetrics();

      expect(metrics.averageSaveTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should not record when disabled', () => {
      const disabledCollector = new MetricsCollector(false);
      disabledCollector.recordSave(100, true);
      disabledCollector.recordSave(200, false);
      const metrics = disabledCollector.getMetrics();

      expect(metrics.totalSaves).toBe(0);
      expect(metrics.successfulSaves).toBe(0);
      expect(metrics.failedSaves).toBe(0);
    });
  });

  describe('recordCacheHit', () => {
    it('should record cache hit', () => {
      collector.recordCacheHit();
      const metrics = collector.getMetrics();

      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(0);
    });

    it('should record multiple cache hits', () => {
      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheHit();
      const metrics = collector.getMetrics();

      expect(metrics.cacheHits).toBe(3);
    });

    it('should work when disabled', () => {
      const disabledCollector = new MetricsCollector(false);
      disabledCollector.recordCacheHit();
      const metrics = disabledCollector.getMetrics();

      // Note: cache recording works even when disabled
      expect(metrics.cacheHits).toBe(1);
    });
  });

  describe('recordCacheMiss', () => {
    it('should record cache miss', () => {
      collector.recordCacheMiss();
      const metrics = collector.getMetrics();

      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHits).toBe(0);
    });

    it('should record multiple cache misses', () => {
      collector.recordCacheMiss();
      collector.recordCacheMiss();
      const metrics = collector.getMetrics();

      expect(metrics.cacheMisses).toBe(2);
    });
  });

  describe('recordRetry', () => {
    it('should record retry', () => {
      collector.recordRetry();
      const metrics = collector.getMetrics();

      expect(metrics.retryCount).toBe(1);
    });

    it('should record multiple retries', () => {
      collector.recordRetry();
      collector.recordRetry();
      collector.recordRetry();
      const metrics = collector.getMetrics();

      expect(metrics.retryCount).toBe(3);
    });
  });

  describe('recordDebounce', () => {
    it('should record debounce time', () => {
      collector.recordDebounce(100);
      const metrics = collector.getMetrics();

      expect(metrics.averageDebounceTime).toBe(50); // (0 + 100) / 2
    });

    it('should update average debounce time', () => {
      collector.recordDebounce(100);
      collector.recordDebounce(200);
      const metrics = collector.getMetrics();

      // First: (0 + 100) / 2 = 50
      // Second: (50 + 200) / 2 = 125
      expect(metrics.averageDebounceTime).toBe(125);
    });

    it('should calculate moving average correctly', () => {
      collector.recordDebounce(100);
      collector.recordDebounce(100);
      collector.recordDebounce(100);
      const metrics = collector.getMetrics();

      // First: (0 + 100) / 2 = 50
      // Second: (50 + 100) / 2 = 75
      // Third: (75 + 100) / 2 = 87.5
      expect(metrics.averageDebounceTime).toBe(87.5);
    });
  });

  describe('getSuccessRate', () => {
    it('should return 1 when no saves recorded', () => {
      const rate = collector.getSuccessRate();

      expect(rate).toBe(1);
    });

    it('should calculate success rate correctly', () => {
      collector.recordSave(100, true);
      collector.recordSave(100, true);
      collector.recordSave(100, false);
      const rate = collector.getSuccessRate();

      expect(rate).toBeCloseTo(2 / 3);
    });

    it('should return 1 for all successful saves', () => {
      collector.recordSave(100, true);
      collector.recordSave(100, true);
      collector.recordSave(100, true);
      const rate = collector.getSuccessRate();

      expect(rate).toBe(1);
    });

    it('should return 0 for all failed saves', () => {
      collector.recordSave(100, false);
      collector.recordSave(100, false);
      const rate = collector.getSuccessRate();

      expect(rate).toBe(0);
    });

    it('should handle single save', () => {
      collector.recordSave(100, true);
      expect(collector.getSuccessRate()).toBe(1);

      collector.reset();
      collector.recordSave(100, false);
      expect(collector.getSuccessRate()).toBe(0);
    });
  });

  describe('getCacheHitRate', () => {
    it('should return 0 when no cache accesses', () => {
      const rate = collector.getCacheHitRate();

      expect(rate).toBe(0);
    });

    it('should calculate cache hit rate correctly', () => {
      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheMiss();
      const rate = collector.getCacheHitRate();

      expect(rate).toBeCloseTo(2 / 3);
    });

    it('should return 1 for all cache hits', () => {
      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheHit();
      const rate = collector.getCacheHitRate();

      expect(rate).toBe(1);
    });

    it('should return 0 for all cache misses', () => {
      collector.recordCacheMiss();
      collector.recordCacheMiss();
      const rate = collector.getCacheHitRate();

      expect(rate).toBe(0);
    });

    it('should handle single cache access', () => {
      collector.recordCacheHit();
      expect(collector.getCacheHitRate()).toBe(1);

      collector.reset();
      collector.recordCacheMiss();
      expect(collector.getCacheHitRate()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to zero', () => {
      collector.recordSave(100, true);
      collector.recordSave(200, false);
      collector.recordCacheHit();
      collector.recordCacheMiss();
      collector.recordRetry();
      collector.recordDebounce(100);

      collector.reset();
      const metrics = collector.getMetrics();

      expect(metrics).toEqual({
        totalSaves: 0,
        successfulSaves: 0,
        failedSaves: 0,
        averageDebounceTime: 0,
        averageSaveTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        retryCount: 0,
      });
    });

    it('should allow recording after reset', () => {
      collector.recordSave(100, true);
      collector.reset();
      collector.recordSave(200, true);
      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(1);
      expect(metrics.averageSaveTime).toBe(200);
    });

    it('should reset success rate to 1', () => {
      collector.recordSave(100, false);
      collector.reset();

      expect(collector.getSuccessRate()).toBe(1);
    });

    it('should reset cache hit rate to 0', () => {
      collector.recordCacheHit();
      collector.recordCacheMiss();
      collector.reset();

      expect(collector.getCacheHitRate()).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return copy of metrics', () => {
      const metrics1 = collector.getMetrics();
      const metrics2 = collector.getMetrics();

      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);
    });

    it('should return readonly metrics', () => {
      const metrics = collector.getMetrics();
      
      // Try to modify (should not affect internal state)
      (metrics as any).totalSaves = 999;
      
      const freshMetrics = collector.getMetrics();
      expect(freshMetrics.totalSaves).toBe(0);
    });

    it('should reflect current state', () => {
      collector.recordSave(100, true);
      let metrics = collector.getMetrics();
      expect(metrics.totalSaves).toBe(1);

      collector.recordSave(200, true);
      metrics = collector.getMetrics();
      expect(metrics.totalSaves).toBe(2);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed operations correctly', () => {
      collector.recordSave(100, true);
      collector.recordSave(200, false);
      collector.recordSave(150, true);
      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheMiss();
      collector.recordRetry();
      collector.recordRetry();
      collector.recordDebounce(100);

      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(3);
      expect(metrics.successfulSaves).toBe(2);
      expect(metrics.failedSaves).toBe(1);
      expect(metrics.averageSaveTime).toBe(150);
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.retryCount).toBe(2);
      expect(collector.getSuccessRate()).toBeCloseTo(2 / 3);
      expect(collector.getCacheHitRate()).toBeCloseTo(2 / 3);
    });

    it('should handle real-world usage pattern', () => {
      // Simulate real autosave scenario
      for (let i = 0; i < 10; i++) {
        collector.recordDebounce(50 + i * 10);
        
        if (i % 3 === 0) {
          collector.recordCacheMiss();
        } else {
          collector.recordCacheHit();
        }

        const success = i < 8; // 8 successes, 2 failures
        collector.recordSave(100 + i * 50, success);

        if (!success) {
          collector.recordRetry();
        }
      }

      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(10);
      expect(metrics.successfulSaves).toBe(8);
      expect(metrics.failedSaves).toBe(2);
      expect(metrics.retryCount).toBe(2);
      // i % 3 === 0 for i = 0, 3, 6, 9 = 4 cache misses
      // All others (1, 2, 4, 5, 7, 8) = 6 cache hits
      expect(metrics.cacheMisses).toBe(4);
      expect(metrics.cacheHits).toBe(6);
      expect(collector.getSuccessRate()).toBe(0.8);
      expect(collector.getCacheHitRate()).toBe(0.6);
    });
  });

  describe('edge cases', () => {
    it('should handle zero duration saves', () => {
      collector.recordSave(0, true);
      const metrics = collector.getMetrics();

      expect(metrics.averageSaveTime).toBe(0);
    });

    it('should handle very large durations', () => {
      collector.recordSave(1000000, true);
      const metrics = collector.getMetrics();

      expect(metrics.averageSaveTime).toBe(1000000);
    });

    it('should handle fractional durations', () => {
      collector.recordSave(100.5, true);
      collector.recordSave(200.5, true);
      const metrics = collector.getMetrics();

      expect(metrics.averageSaveTime).toBe(150.5);
    });

    it('should maintain accuracy with large number of operations', () => {
      for (let i = 0; i < 1000; i++) {
        collector.recordSave(100, true);
      }

      const metrics = collector.getMetrics();

      expect(metrics.totalSaves).toBe(1000);
      expect(metrics.successfulSaves).toBe(1000);
      expect(metrics.averageSaveTime).toBeCloseTo(100, 1);
    });
  });
});
