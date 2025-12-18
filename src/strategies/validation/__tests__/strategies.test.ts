/**
 * Tests for validation strategies
 * Covers NoValidationStrategy, PayloadValidationStrategy, and AllFieldsValidationStrategy
 */

import {
  NoValidationStrategy,
  PayloadValidationStrategy,
  AllFieldsValidationStrategy,
} from '../strategies';
import type { FormSubset } from '../types';
import type { SavePayload } from '../../../core/types';

describe('Validation Strategies', () => {
  describe('NoValidationStrategy', () => {
    it('should always return true', async () => {
      const strategy = new NoValidationStrategy();
      const result = await strategy.validate();

      expect(result).toBe(true);
    });

    it('should not call form methods', async () => {
      const mockForm: Partial<FormSubset<any>> = {
        trigger: jest.fn(),
      };

      const strategy = new NoValidationStrategy();
      // Note: NoValidationStrategy doesn't use the form parameter
      await strategy.validate();

      expect(mockForm.trigger).not.toHaveBeenCalled();
    });

    it('should return true for any case', async () => {
      const strategy = new NoValidationStrategy();

      const result1 = await strategy.validate();
      const result2 = await strategy.validate();
      const result3 = await strategy.validate();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should work independently', async () => {
      const strategy = new NoValidationStrategy();

      await expect(strategy.validate()).resolves.toBe(true);
      await expect(strategy.validate()).resolves.toBe(true);
    });
  });

  describe('PayloadValidationStrategy', () => {
    let mockForm: jest.Mocked<FormSubset<any>>;

    beforeEach(() => {
      mockForm = {
        trigger: jest.fn().mockResolvedValue(true),
        watch: jest.fn(),
        formState: {
          isDirty: false,
          isValid: true,
          dirtyFields: {},
          isValidating: false,
        },
        reset: jest.fn(),
        getValues: jest.fn(),
        setValue: jest.fn(),
        register: jest.fn(),
      };
    });

    describe('validation with payload fields', () => {
      it('should trigger validation for payload fields', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { name: 'test', email: 'test@example.com' };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(['name', 'email'], { shouldFocus: false });
      });

      it('should return validation result', async () => {
        mockForm.trigger.mockResolvedValue(true);
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { field: 'value' };

        const result = await strategy.validate(mockForm, payload);

        expect(result).toBe(true);
      });

      it('should return false when validation fails', async () => {
        mockForm.trigger.mockResolvedValue(false);
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { field: 'invalid' };

        const result = await strategy.validate(mockForm, payload);

        expect(result).toBe(false);
      });

      it('should validate single field', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { username: 'john' };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(['username'], { shouldFocus: false });
      });

      it('should validate multiple fields', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          age: 30,
        };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(
          ['firstName', 'lastName', 'email', 'age'],
          { shouldFocus: false }
        );
      });

      it('should not focus on validation errors', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { field: 'value' };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ shouldFocus: false })
        );
      });
    });

    describe('empty payload handling', () => {
      it('should return true for empty payload', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = {};

        const result = await strategy.validate(mockForm, payload);

        expect(result).toBe(true);
        expect(mockForm.trigger).not.toHaveBeenCalled();
      });

      it('should not trigger validation for empty payload', async () => {
        const strategy = new PayloadValidationStrategy();
        await strategy.validate(mockForm, {});

        expect(mockForm.trigger).not.toHaveBeenCalled();
      });
    });

    describe('field name extraction', () => {
      it('should extract field names from payload keys', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = {
          'user.name': 'John',
          'user.email': 'john@example.com',
          'settings.theme': 'dark',
        };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(
          ['user.name', 'user.email', 'settings.theme'],
          { shouldFocus: false }
        );
      });

      it('should handle numeric keys', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = {
          '0': 'first',
          '1': 'second',
        };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(['0', '1'], { shouldFocus: false });
      });

      it('should handle special characters in keys', async () => {
        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = {
          'field-with-dash': 'value1',
          'field_with_underscore': 'value2',
          'field.with.dots': 'value3',
        };

        await strategy.validate(mockForm, payload);

        expect(mockForm.trigger).toHaveBeenCalledWith(
          ['field-with-dash', 'field_with_underscore', 'field.with.dots'],
          { shouldFocus: false }
        );
      });
    });

    describe('async validation', () => {
      it('should handle async validation resolution', async () => {
        mockForm.trigger.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
        );

        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { field: 'value' };

        const result = await strategy.validate(mockForm, payload);

        expect(result).toBe(true);
      });

      it('should handle async validation rejection', async () => {
        mockForm.trigger.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(false), 100))
        );

        const strategy = new PayloadValidationStrategy();
        const payload: SavePayload = { field: 'invalid' };

        const result = await strategy.validate(mockForm, payload);

        expect(result).toBe(false);
      });
    });
  });

  describe('AllFieldsValidationStrategy', () => {
    let mockForm: jest.Mocked<FormSubset<any>>;

    beforeEach(() => {
      mockForm = {
        trigger: jest.fn().mockResolvedValue(true),
        watch: jest.fn(),
        formState: {
          isDirty: false,
          isValid: true,
          dirtyFields: {},
          isValidating: false,
        },
        reset: jest.fn(),
        getValues: jest.fn(),
        setValue: jest.fn(),
        register: jest.fn(),
      };
    });

    describe('validation triggering', () => {
      it('should trigger validation for all fields', async () => {
        const strategy = new AllFieldsValidationStrategy();
        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });
      });

      it('should return validation result', async () => {
        mockForm.trigger.mockResolvedValue(true);
        const strategy = new AllFieldsValidationStrategy();

        const result = await strategy.validate(mockForm);

        expect(result).toBe(true);
      });

      it('should return false when validation fails', async () => {
        mockForm.trigger.mockResolvedValue(false);
        const strategy = new AllFieldsValidationStrategy();

        const result = await strategy.validate(mockForm);

        expect(result).toBe(false);
      });

      it('should not focus on validation errors', async () => {
        const strategy = new AllFieldsValidationStrategy();
        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalledWith(
          undefined,
          expect.objectContaining({ shouldFocus: false })
        );
      });
    });

    describe('form-only validation', () => {
      it('should validate all fields', async () => {
        const strategy = new AllFieldsValidationStrategy();

        await strategy.validate(mockForm);
        expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });

        mockForm.trigger.mockClear();

        await strategy.validate(mockForm);
        expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });

        mockForm.trigger.mockClear();

        await strategy.validate(mockForm);
        expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });
      });

      it('should always trigger all fields', async () => {
        const strategy = new AllFieldsValidationStrategy();

        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });
        expect(mockForm.trigger).not.toHaveBeenCalledWith(['name', 'email', 'age'], expect.anything());
      });
    });

    describe('async validation', () => {
      it('should handle async validation', async () => {
        mockForm.trigger.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
        );

        const strategy = new AllFieldsValidationStrategy();
        const result = await strategy.validate(mockForm);

        expect(result).toBe(true);
      });

      it('should handle async validation failure', async () => {
        mockForm.trigger.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(false), 100))
        );

        const strategy = new AllFieldsValidationStrategy();
        const result = await strategy.validate(mockForm);

        expect(result).toBe(false);
      });
    });

    describe('form state independence', () => {
      it('should validate even when form is not dirty', async () => {
        mockForm.formState.isDirty = false;
        const strategy = new AllFieldsValidationStrategy();

        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalled();
      });

      it('should validate even when form is already valid', async () => {
        mockForm.formState.isValid = true;
        const strategy = new AllFieldsValidationStrategy();

        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalled();
      });

      it('should validate even during validation', async () => {
        mockForm.formState.isValidating = true;
        const strategy = new AllFieldsValidationStrategy();

        await strategy.validate(mockForm);

        expect(mockForm.trigger).toHaveBeenCalled();
      });
    });
  });

  describe('Strategy comparison', () => {
    let mockForm: jest.Mocked<FormSubset<any>>;

    beforeEach(() => {
      mockForm = {
        trigger: jest.fn().mockResolvedValue(true),
        watch: jest.fn(),
        formState: {
          isDirty: false,
          isValid: true,
          dirtyFields: {},
          isValidating: false,
        },
        reset: jest.fn(),
        getValues: jest.fn(),
        setValue: jest.fn(),
        register: jest.fn(),
      };
    });

    it('NoValidation should not call trigger', async () => {
      const strategy = new NoValidationStrategy();
      await strategy.validate();

      expect(mockForm.trigger).not.toHaveBeenCalled();
    });

    it('PayloadValidation should call trigger with specific fields', async () => {
      const strategy = new PayloadValidationStrategy();
      await strategy.validate(mockForm, { field1: 'value', field2: 'value' });

      expect(mockForm.trigger).toHaveBeenCalledWith(['field1', 'field2'], { shouldFocus: false });
    });

    it('AllFieldsValidation should call trigger with undefined', async () => {
      const strategy = new AllFieldsValidationStrategy();
      await strategy.validate(mockForm);

      expect(mockForm.trigger).toHaveBeenCalledWith(undefined, { shouldFocus: false });
    });

    it('strategies should handle different form states independently', async () => {
      // NoValidation doesn't use trigger
      // Set up trigger for PayloadValidation (returns false) and AllFieldsValidation (returns true)
      mockForm.trigger
        .mockResolvedValueOnce(false) // PayloadValidation
        .mockResolvedValueOnce(true); // AllFieldsValidation

      const noVal = new NoValidationStrategy();
      const payloadVal = new PayloadValidationStrategy();
      const allVal = new AllFieldsValidationStrategy();

      const result1 = await noVal.validate();
      const result2 = await payloadVal.validate(mockForm, { field: 'value' });
      const result3 = await allVal.validate(mockForm);

      expect(result1).toBe(true); // NoValidation always returns true
      expect(result2).toBe(false); // PayloadValidation got false from trigger
      expect(result3).toBe(true);  // AllFieldsValidation got true from trigger
    });
  });
});
