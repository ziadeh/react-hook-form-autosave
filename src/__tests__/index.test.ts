/**
 * Tests for main index exports
 * Validates that all public APIs are properly exported
 */

import * as autosaveKit from '../index';

describe('index exports', () => {
  describe('core exports', () => {
    it('should export AutosaveManager', () => {
      expect(autosaveKit.AutosaveManager).toBeDefined();
      expect(typeof autosaveKit.AutosaveManager).toBe('function');
    });

    it('should export TransportError', () => {
      expect(autosaveKit.TransportError).toBeDefined();
      expect(typeof autosaveKit.TransportError).toBe('function');
    });

    it('should export ValidationError', () => {
      expect(autosaveKit.ValidationError).toBeDefined();
      expect(typeof autosaveKit.ValidationError).toBe('function');
    });
  });

  describe('adapter exports', () => {
    it('should export useRhfAutosave', () => {
      expect(autosaveKit.useRhfAutosave).toBeDefined();
      expect(typeof autosaveKit.useRhfAutosave).toBe('function');
    });

    it('should export trpcTransport', () => {
      expect(autosaveKit.trpcTransport).toBeDefined();
      expect(typeof autosaveKit.trpcTransport).toBe('function');
    });
  });

  describe('strategy exports', () => {
    it('should export validation strategies', () => {
      expect(autosaveKit.NoValidationStrategy).toBeDefined();
      expect(autosaveKit.PayloadValidationStrategy).toBeDefined();
      expect(autosaveKit.AllFieldsValidationStrategy).toBeDefined();
    });

    it('should export createValidationStrategy', () => {
      expect(autosaveKit.createValidationStrategy).toBeDefined();
      expect(typeof autosaveKit.createValidationStrategy).toBe('function');
    });

    it('should export withRetry', () => {
      expect(autosaveKit.withRetry).toBeDefined();
      expect(typeof autosaveKit.withRetry).toBe('function');
    });

    it('should export composeTransports', () => {
      expect(autosaveKit.composeTransports).toBeDefined();
      expect(typeof autosaveKit.composeTransports).toBe('function');
    });

    it('should export parallelTransports', () => {
      expect(autosaveKit.parallelTransports).toBeDefined();
      expect(typeof autosaveKit.parallelTransports).toBe('function');
    });
  });

  describe('state management exports', () => {
    it('should export autosaveReducer', () => {
      expect(autosaveKit.autosaveReducer).toBeDefined();
      expect(typeof autosaveKit.autosaveReducer).toBe('function');
    });

    it('should export initialAutosaveState', () => {
      expect(autosaveKit.initialAutosaveState).toBeDefined();
      expect(typeof autosaveKit.initialAutosaveState).toBe('object');
    });
  });

  describe('utility exports', () => {
    it('should export pickChanged', () => {
      expect(autosaveKit.pickChanged).toBeDefined();
      expect(typeof autosaveKit.pickChanged).toBe('function');
    });

    it('should export mapKeys', () => {
      expect(autosaveKit.mapKeys).toBeDefined();
      expect(typeof autosaveKit.mapKeys).toBe('function');
    });

    it('should export createKeyMapper', () => {
      expect(autosaveKit.createKeyMapper).toBeDefined();
      expect(typeof autosaveKit.createKeyMapper).toBe('function');
    });

    it('should export debounce', () => {
      expect(autosaveKit.debounce).toBeDefined();
      expect(typeof autosaveKit.debounce).toBe('function');
    });

    it('should export createLogger', () => {
      expect(autosaveKit.createLogger).toBeDefined();
      expect(typeof autosaveKit.createLogger).toBe('function');
    });
  });

  describe('cache exports', () => {
    it('should export PayloadCache', () => {
      expect(autosaveKit.PayloadCache).toBeDefined();
      expect(typeof autosaveKit.PayloadCache).toBe('function');
    });

    it('should export ValidationCache', () => {
      expect(autosaveKit.ValidationCache).toBeDefined();
      expect(typeof autosaveKit.ValidationCache).toBe('function');
    });
  });

  describe('metrics exports', () => {
    it('should export MetricsCollector', () => {
      expect(autosaveKit.MetricsCollector).toBeDefined();
      expect(typeof autosaveKit.MetricsCollector).toBe('function');
    });
  });

  describe('helper exports', () => {
    it('should export isPending', () => {
      expect(autosaveKit.isPending).toBeDefined();
      expect(typeof autosaveKit.isPending).toBe('function');
    });

    it('should export reconcilePendingField', () => {
      expect(autosaveKit.reconcilePendingField).toBeDefined();
      expect(typeof autosaveKit.reconcilePendingField).toBe('function');
    });
  });

  describe('class instantiation', () => {
    it('should allow creating PayloadCache instance', () => {
      const cache = new autosaveKit.PayloadCache();
      expect(cache).toBeInstanceOf(autosaveKit.PayloadCache);
    });

    it('should allow creating ValidationCache instance', () => {
      const cache = new autosaveKit.ValidationCache();
      expect(cache).toBeInstanceOf(autosaveKit.ValidationCache);
    });

    it('should allow creating MetricsCollector instance', () => {
      const collector = new autosaveKit.MetricsCollector();
      expect(collector).toBeInstanceOf(autosaveKit.MetricsCollector);
    });

    it('should allow creating validation strategy instances', () => {
      const noValidation = new autosaveKit.NoValidationStrategy();
      const payloadValidation = new autosaveKit.PayloadValidationStrategy();
      const allFieldsValidation = new autosaveKit.AllFieldsValidationStrategy();

      expect(noValidation).toBeInstanceOf(autosaveKit.NoValidationStrategy);
      expect(payloadValidation).toBeInstanceOf(autosaveKit.PayloadValidationStrategy);
      expect(allFieldsValidation).toBeInstanceOf(autosaveKit.AllFieldsValidationStrategy);
    });

    it('should allow creating error instances', () => {
      const transportError = new autosaveKit.TransportError('test');
      const validationError = new autosaveKit.ValidationError('test');

      expect(transportError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(Error);
      expect(transportError.message).toBe('test');
      expect(validationError.message).toBe('test');
    });
  });

  describe('function invocation', () => {
    it('should allow calling utility functions', () => {
      const debounced = autosaveKit.debounce(() => {}, 100);
      expect(debounced.cancel).toBeDefined();
      expect(debounced.flush).toBeDefined();
      expect(debounced.pending).toBeDefined();
    });

    it('should allow calling createLogger', () => {
      const logger = autosaveKit.createLogger('test');
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should allow calling createValidationStrategy', () => {
      const strategy = autosaveKit.createValidationStrategy('none');
      expect(strategy).toBeInstanceOf(autosaveKit.NoValidationStrategy);
    });

    it('should allow calling pickChanged', () => {
      const result = autosaveKit.pickChanged(
        { name: 'John', age: 30 },
        { name: true }
      );
      expect(result).toEqual({ name: 'John' });
    });

    it('should allow calling mapKeys', () => {
      const result = autosaveKit.mapKeys(
        { firstName: 'John' },
        { firstName: 'first_name' }
      );
      expect(result).toEqual({ first_name: 'John' });
    });
  });

  describe('type exports', () => {
    it('should have proper module structure', () => {
      const exports = Object.keys(autosaveKit);
      
      // Check that we have a reasonable number of exports
      expect(exports.length).toBeGreaterThan(20);
      
      // Verify no duplicate or unexpected exports
      const uniqueExports = new Set(exports);
      expect(uniqueExports.size).toBe(exports.length);
    });

    it('should not export internal implementation details', () => {
      const exports = Object.keys(autosaveKit);
      
      // These should NOT be exported (internal implementation)
      expect(exports).not.toContain('InternalUndoManager');
      expect(exports).not.toContain('useAutosaveEffects');
      expect(exports).not.toContain('useBaseline');
      expect(exports).not.toContain('useDebouncedSave');
      expect(exports).not.toContain('usePendingState');
      expect(exports).not.toContain('useUndoRedo');
    });
  });

  describe('integration smoke tests', () => {
    it('should work with composed transports', () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });
      
      const composed = autosaveKit.composeTransports(transport1, transport2);
      expect(composed).toBeDefined();
      expect(typeof composed).toBe('function');
    });

    it('should work with retry wrapper', () => {
      const transport = jest.fn().mockResolvedValue({ ok: true });
      const retryTransport = autosaveKit.withRetry(transport);
      
      expect(retryTransport).toBeDefined();
      expect(typeof retryTransport).toBe('function');
    });

    it('should work with parallel transports', () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });
      
      const parallel = autosaveKit.parallelTransports(transport1, transport2);
      expect(parallel).toBeDefined();
      expect(typeof parallel).toBe('function');
    });

    it('should work with trpc transport wrapper', () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };
      
      const transport = autosaveKit.trpcTransport(mockMutation);
      expect(transport).toBeDefined();
      expect(typeof transport).toBe('function');
    });
  });

  describe('backwards compatibility', () => {
    it('should maintain stable exports', () => {
      // Core APIs that should always be available
      const coreExports = [
        'AutosaveManager',
        'useRhfAutosave',
        'trpcTransport',
        'debounce',
        'createLogger',
        'PayloadCache',
        'MetricsCollector',
      ];

      coreExports.forEach((exportName) => {
        expect(autosaveKit).toHaveProperty(exportName);
        expect((autosaveKit as any)[exportName]).toBeDefined();
      });
    });
  });
});
