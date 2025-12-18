/**
 * Tests for config schema
 * Covers createConfig function and validation logic
 */

import { createConfig, type AutosaveConfig, type ConflictResolution } from '../schema';

describe('createConfig', () => {
  describe('default configuration', () => {
    it('should return default config when called with no arguments', () => {
      const config = createConfig();

      expect(config).toEqual({
        debug: false,
        debounceMs: 600,
        maxRetries: 3,
        enableMetrics: false,
        enableCache: true,
        cacheSize: 100,
        cacheTtlMs: 5 * 60 * 1000,
        rateLimitMs: 0,
        offlineSupport: false,
        conflictResolution: 'client',
      });
    });

    it('should return default config when called with empty object', () => {
      const config = createConfig({});

      expect(config.debug).toBe(false);
      expect(config.debounceMs).toBe(600);
      expect(config.maxRetries).toBe(3);
    });

    it('should have debug explicitly disabled by default', () => {
      const config = createConfig();

      expect(config.debug).toBe(false);
    });
  });

  describe('numeric field validation', () => {
    describe('debounceMs', () => {
      it('should accept valid debounceMs', () => {
        const config = createConfig({ debounceMs: 1000 });
        expect(config.debounceMs).toBe(1000);
      });

      it('should accept zero debounceMs', () => {
        const config = createConfig({ debounceMs: 0 });
        expect(config.debounceMs).toBe(0);
      });

      it('should reject negative debounceMs', () => {
        expect(() => createConfig({ debounceMs: -1 })).toThrow(
          RangeError
        );
        expect(() => createConfig({ debounceMs: -1 })).toThrow(
          '"debounceMs" must be >= 0'
        );
      });

      it('should reject non-numeric debounceMs', () => {
        expect(() => createConfig({ debounceMs: '600' as any })).toThrow(
          TypeError
        );
        expect(() => createConfig({ debounceMs: '600' as any })).toThrow(
          '"debounceMs" must be a finite number'
        );
      });

      it('should reject NaN debounceMs', () => {
        expect(() => createConfig({ debounceMs: NaN })).toThrow(TypeError);
      });

      it('should reject Infinity debounceMs', () => {
        expect(() => createConfig({ debounceMs: Infinity })).toThrow(TypeError);
      });
    });

    describe('maxRetries', () => {
      it('should accept valid maxRetries', () => {
        const config = createConfig({ maxRetries: 5 });
        expect(config.maxRetries).toBe(5);
      });

      it('should accept zero maxRetries', () => {
        const config = createConfig({ maxRetries: 0 });
        expect(config.maxRetries).toBe(0);
      });

      it('should reject negative maxRetries', () => {
        expect(() => createConfig({ maxRetries: -1 })).toThrow(
          '"maxRetries" must be >= 0'
        );
      });

      it('should reject non-numeric maxRetries', () => {
        expect(() => createConfig({ maxRetries: null as any })).toThrow(
          '"maxRetries" must be a finite number'
        );
      });
    });

    describe('cacheSize', () => {
      it('should accept valid cacheSize', () => {
        const config = createConfig({ cacheSize: 200 });
        expect(config.cacheSize).toBe(200);
      });

      it('should accept minimum cacheSize of 1', () => {
        const config = createConfig({ cacheSize: 1 });
        expect(config.cacheSize).toBe(1);
      });

      it('should reject zero cacheSize', () => {
        expect(() => createConfig({ cacheSize: 0 })).toThrow(
          '"cacheSize" must be >= 1'
        );
      });

      it('should reject negative cacheSize', () => {
        expect(() => createConfig({ cacheSize: -1 })).toThrow(RangeError);
      });
    });

    describe('cacheTtlMs', () => {
      it('should accept valid cacheTtlMs', () => {
        const config = createConfig({ cacheTtlMs: 10000 });
        expect(config.cacheTtlMs).toBe(10000);
      });

      it('should accept minimum cacheTtlMs of 1000', () => {
        const config = createConfig({ cacheTtlMs: 1000 });
        expect(config.cacheTtlMs).toBe(1000);
      });

      it('should reject cacheTtlMs below 1000', () => {
        expect(() => createConfig({ cacheTtlMs: 999 })).toThrow(
          '"cacheTtlMs" must be >= 1000'
        );
      });

      it('should reject zero cacheTtlMs', () => {
        expect(() => createConfig({ cacheTtlMs: 0 })).toThrow(RangeError);
      });
    });

    describe('rateLimitMs', () => {
      it('should accept valid rateLimitMs', () => {
        const config = createConfig({ rateLimitMs: 500 });
        expect(config.rateLimitMs).toBe(500);
      });

      it('should accept zero rateLimitMs', () => {
        const config = createConfig({ rateLimitMs: 0 });
        expect(config.rateLimitMs).toBe(0);
      });

      it('should reject negative rateLimitMs', () => {
        expect(() => createConfig({ rateLimitMs: -1 })).toThrow(
          '"rateLimitMs" must be >= 0'
        );
      });
    });
  });

  describe('boolean field validation', () => {
    describe('debug', () => {
      it('should accept true debug', () => {
        const config = createConfig({ debug: true });
        expect(config.debug).toBe(true);
      });

      it('should accept false debug', () => {
        const config = createConfig({ debug: false });
        expect(config.debug).toBe(false);
      });

      it('should reject non-boolean debug', () => {
        expect(() => createConfig({ debug: 'true' as any })).toThrow(
          '"debug" must be a boolean'
        );
      });

      it('should reject null debug', () => {
        expect(() => createConfig({ debug: null as any })).toThrow(TypeError);
      });
    });

    describe('enableMetrics', () => {
      it('should accept true enableMetrics', () => {
        const config = createConfig({ enableMetrics: true });
        expect(config.enableMetrics).toBe(true);
      });

      it('should accept false enableMetrics', () => {
        const config = createConfig({ enableMetrics: false });
        expect(config.enableMetrics).toBe(false);
      });

      it('should reject non-boolean enableMetrics', () => {
        expect(() => createConfig({ enableMetrics: 1 as any })).toThrow(
          '"enableMetrics" must be a boolean'
        );
      });
    });

    describe('enableCache', () => {
      it('should accept true enableCache', () => {
        const config = createConfig({ enableCache: true });
        expect(config.enableCache).toBe(true);
      });

      it('should accept false enableCache', () => {
        const config = createConfig({ enableCache: false });
        expect(config.enableCache).toBe(false);
      });

      it('should reject non-boolean enableCache', () => {
        expect(() => createConfig({ enableCache: 'yes' as any })).toThrow(
          '"enableCache" must be a boolean'
        );
      });
    });

    describe('offlineSupport', () => {
      it('should accept true offlineSupport', () => {
        const config = createConfig({ offlineSupport: true });
        expect(config.offlineSupport).toBe(true);
      });

      it('should accept false offlineSupport', () => {
        const config = createConfig({ offlineSupport: false });
        expect(config.offlineSupport).toBe(false);
      });

      it('should reject non-boolean offlineSupport', () => {
        expect(() => createConfig({ offlineSupport: [] as any })).toThrow(
          '"offlineSupport" must be a boolean'
        );
      });
    });
  });

  describe('conflictResolution validation', () => {
    it('should accept "client" conflictResolution', () => {
      const config = createConfig({ conflictResolution: 'client' });
      expect(config.conflictResolution).toBe('client');
    });

    it('should accept "server" conflictResolution', () => {
      const config = createConfig({ conflictResolution: 'server' });
      expect(config.conflictResolution).toBe('server');
    });

    it('should accept "merge" conflictResolution', () => {
      const config = createConfig({ conflictResolution: 'merge' });
      expect(config.conflictResolution).toBe('merge');
    });

    it('should reject invalid conflictResolution', () => {
      expect(() =>
        createConfig({ conflictResolution: 'invalid' as ConflictResolution })
      ).toThrow('"conflictResolution" must be one of "client" | "server" | "merge"');
    });

    it('should reject null conflictResolution', () => {
      expect(() =>
        createConfig({ conflictResolution: null as any })
      ).toThrow(TypeError);
    });

    it('should reject undefined conflictResolution explicitly set', () => {
      expect(() =>
        createConfig({ conflictResolution: undefined as any })
      ).toThrow(TypeError);
    });
  });

  describe('optional fields', () => {
    describe('maxPayloadSize', () => {
      it('should accept valid maxPayloadSize', () => {
        const config = createConfig({ maxPayloadSize: 1000 });
        expect(config.maxPayloadSize).toBe(1000);
      });

      it('should be undefined when not provided', () => {
        const config = createConfig();
        expect(config.maxPayloadSize).toBeUndefined();
      });

      it('should accept large maxPayloadSize', () => {
        const config = createConfig({ maxPayloadSize: 10000000 });
        expect(config.maxPayloadSize).toBe(10000000);
      });

      it('should reject non-numeric maxPayloadSize', () => {
        expect(() => createConfig({ maxPayloadSize: 'large' as any })).toThrow(
          '"maxPayloadSize" must be a finite number'
        );
      });

      it('should reject NaN maxPayloadSize', () => {
        expect(() => createConfig({ maxPayloadSize: NaN })).toThrow(TypeError);
      });

      it('should not validate maxPayloadSize when undefined', () => {
        expect(() => createConfig({ maxPayloadSize: undefined })).not.toThrow();
      });
    });
  });

  describe('partial configuration', () => {
    it('should merge partial config with defaults', () => {
      const config = createConfig({
        debounceMs: 1000,
        enableCache: false,
      });

      expect(config.debounceMs).toBe(1000);
      expect(config.enableCache).toBe(false);
      // Defaults should remain
      expect(config.maxRetries).toBe(3);
      expect(config.cacheSize).toBe(100);
    });

    it('should override only specified fields', () => {
      const config = createConfig({ debug: true });

      expect(config.debug).toBe(true);
      expect(config.debounceMs).toBe(600); // default
      expect(config.conflictResolution).toBe('client'); // default
    });

    it('should handle multiple overrides', () => {
      const config = createConfig({
        debounceMs: 2000,
        maxRetries: 5,
        enableMetrics: true,
        cacheSize: 50,
      });

      expect(config.debounceMs).toBe(2000);
      expect(config.maxRetries).toBe(5);
      expect(config.enableMetrics).toBe(true);
      expect(config.cacheSize).toBe(50);
    });
  });

  describe('complete configuration', () => {
    it('should accept complete valid config', () => {
      const input: AutosaveConfig = {
        debug: true,
        debounceMs: 1000,
        maxRetries: 5,
        enableMetrics: true,
        enableCache: true,
        cacheSize: 200,
        cacheTtlMs: 10000,
        maxPayloadSize: 50000,
        rateLimitMs: 100,
        offlineSupport: true,
        conflictResolution: 'server',
      };

      const config = createConfig(input);

      expect(config).toEqual(input);
    });

    it('should validate all fields even in complete config', () => {
      expect(() =>
        createConfig({
          debug: true,
          debounceMs: -1, // invalid
          maxRetries: 3,
          enableMetrics: false,
          enableCache: true,
          cacheSize: 100,
          cacheTtlMs: 5000,
          rateLimitMs: 0,
          offlineSupport: false,
          conflictResolution: 'client',
        })
      ).toThrow('"debounceMs" must be >= 0');
    });
  });

  describe('edge cases', () => {
    it('should handle very large numeric values', () => {
      const config = createConfig({
        debounceMs: 1000000,
        maxRetries: 100,
        cacheSize: 10000,
        cacheTtlMs: 3600000,
      });

      expect(config.debounceMs).toBe(1000000);
      expect(config.maxRetries).toBe(100);
    });

    it('should handle all boolean combinations', () => {
      const config = createConfig({
        debug: true,
        enableMetrics: true,
        enableCache: false,
        offlineSupport: true,
      });

      expect(config.debug).toBe(true);
      expect(config.enableMetrics).toBe(true);
      expect(config.enableCache).toBe(false);
      expect(config.offlineSupport).toBe(true);
    });

    it('should reject mixed invalid types', () => {
      expect(() =>
        createConfig({
          debounceMs: '600' as any,
          enableCache: 'yes' as any,
        })
      ).toThrow(TypeError);
    });

    it('should preserve type safety', () => {
      const config = createConfig({ debounceMs: 1000 });
      
      // TypeScript should recognize these types
      const _debug: boolean = config.debug;
      const _debounce: number = config.debounceMs;
      const _resolution: ConflictResolution = config.conflictResolution;
      
      expect(_debug).toBeDefined();
      expect(_debounce).toBeDefined();
      expect(_resolution).toBeDefined();
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for type mismatch', () => {
      expect(() => createConfig({ debug: 'true' as any })).toThrow(
        '"debug" must be a boolean'
      );
    });

    it('should provide clear error message for range violation', () => {
      expect(() => createConfig({ cacheSize: 0 })).toThrow(
        '"cacheSize" must be >= 1'
      );
    });

    it('should provide clear error message for enum violation', () => {
      expect(() =>
        createConfig({ conflictResolution: 'both' as any })
      ).toThrow('"conflictResolution" must be one of "client" | "server" | "merge"');
    });

    it('should include field name in error message', () => {
      expect(() => createConfig({ maxRetries: -5 })).toThrow('maxRetries');
      expect(() => createConfig({ enableMetrics: null as any })).toThrow('enableMetrics');
    });
  });
});
