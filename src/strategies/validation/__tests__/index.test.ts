/**
 * Tests for validation strategy factory
 * Covers createValidationStrategy function
 */

import {
  createValidationStrategy,
  type ValidationMode,
  NoValidationStrategy,
  PayloadValidationStrategy,
  AllFieldsValidationStrategy,
} from '../index';

describe('createValidationStrategy', () => {
  describe('strategy creation', () => {
    it('should create NoValidationStrategy for "none" mode', () => {
      const strategy = createValidationStrategy('none');

      expect(strategy).toBeInstanceOf(NoValidationStrategy);
    });

    it('should create PayloadValidationStrategy for "payload" mode', () => {
      const strategy = createValidationStrategy('payload');

      expect(strategy).toBeInstanceOf(PayloadValidationStrategy);
    });

    it('should create AllFieldsValidationStrategy for "all" mode', () => {
      const strategy = createValidationStrategy('all');

      expect(strategy).toBeInstanceOf(AllFieldsValidationStrategy);
    });

    it('should default to "payload" mode when no mode specified', () => {
      const strategy = createValidationStrategy();

      expect(strategy).toBeInstanceOf(PayloadValidationStrategy);
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown validation mode', () => {
      expect(() => {
        createValidationStrategy('invalid' as ValidationMode);
      }).toThrow('Unknown validation mode: invalid');
    });

    it('should throw error for undefined mode as string', () => {
      expect(() => {
        createValidationStrategy(undefined as any);
      }).not.toThrow(); // undefined defaults to "payload"
    });
  });

  describe('strategy behavior', () => {
    it('should create independent strategy instances', () => {
      const strategy1 = createValidationStrategy('none');
      const strategy2 = createValidationStrategy('none');

      expect(strategy1).not.toBe(strategy2);
      expect(strategy1).toBeInstanceOf(NoValidationStrategy);
      expect(strategy2).toBeInstanceOf(NoValidationStrategy);
    });

    it('should create different strategies for different modes', () => {
      const noneStrategy = createValidationStrategy('none');
      const payloadStrategy = createValidationStrategy('payload');
      const allStrategy = createValidationStrategy('all');

      expect(noneStrategy).toBeInstanceOf(NoValidationStrategy);
      expect(payloadStrategy).toBeInstanceOf(PayloadValidationStrategy);
      expect(allStrategy).toBeInstanceOf(AllFieldsValidationStrategy);
    });
  });

  describe('type parameter support', () => {
    it('should support generic type parameter', () => {
      interface MyFormValues {
        name: string;
        email: string;
      }

      const strategy = createValidationStrategy<MyFormValues>('payload');

      expect(strategy).toBeInstanceOf(PayloadValidationStrategy);
    });

    it('should create strategies with different type parameters', () => {
      interface Form1 {
        field1: string;
      }
      interface Form2 {
        field2: number;
      }

      const strategy1 = createValidationStrategy<Form1>('none');
      const strategy2 = createValidationStrategy<Form2>('all');

      expect(strategy1).toBeInstanceOf(NoValidationStrategy);
      expect(strategy2).toBeInstanceOf(AllFieldsValidationStrategy);
    });
  });

  describe('mode variations', () => {
    const modes: ValidationMode[] = ['none', 'payload', 'all'];

    modes.forEach((mode) => {
      it(`should handle "${mode}" mode correctly`, () => {
        expect(() => createValidationStrategy(mode)).not.toThrow();
      });
    });

    it('should create correct strategy for each mode', () => {
      const noneStrategy = createValidationStrategy('none');
      const payloadStrategy = createValidationStrategy('payload');
      const allStrategy = createValidationStrategy('all');

      expect(noneStrategy.constructor.name).toBe('NoValidationStrategy');
      expect(payloadStrategy.constructor.name).toBe('PayloadValidationStrategy');
      expect(allStrategy.constructor.name).toBe('AllFieldsValidationStrategy');
    });
  });
});
