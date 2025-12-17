/**
 * Tests for error classes
 * Covers AutosaveError, TransportError, ValidationError, and DiffError
 */

import {
  AutosaveError,
  TransportError,
  ValidationError,
  DiffError,
} from '../errors';

describe('AutosaveError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new AutosaveError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AutosaveError');
    });

    it('should accept original error', () => {
      const originalError = new Error('Original error');
      const error = new AutosaveError('Test error', 'TEST_CODE', originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('should accept metadata', () => {
      const metadata = { field: 'name', value: 'test' };
      const error = new AutosaveError('Test error', 'TEST_CODE', undefined, metadata);

      expect(error.metadata).toEqual(metadata);
    });

    it('should be instance of Error', () => {
      const error = new AutosaveError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AutosaveError);
    });

    it('should have correct stack trace', () => {
      const error = new AutosaveError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('fromUnknown()', () => {
    it('should return same instance if already AutosaveError', () => {
      const original = new AutosaveError('Test', 'TEST_CODE');
      const result = AutosaveError.fromUnknown(original);

      expect(result).toBe(original);
    });

    it('should wrap Error instances', () => {
      const originalError = new Error('Original message');
      const result = AutosaveError.fromUnknown(originalError, 'CUSTOM_CODE');

      expect(result).toBeInstanceOf(AutosaveError);
      expect(result.message).toBe('Autosave failed: Original message');
      expect(result.code).toBe('CUSTOM_CODE');
      expect(result.originalError).toBe(originalError);
    });

    it('should handle string errors', () => {
      const result = AutosaveError.fromUnknown('String error', 'STRING_ERROR');

      expect(result).toBeInstanceOf(AutosaveError);
      expect(result.message).toBe('Autosave failed: String error');
      expect(result.code).toBe('STRING_ERROR');
      expect(result.originalError).toBeInstanceOf(Error);
      expect(result.originalError?.message).toBe('String error');
    });

    it('should handle non-Error objects', () => {
      const unknownError = { message: 'Custom object' };
      const result = AutosaveError.fromUnknown(unknownError);

      expect(result).toBeInstanceOf(AutosaveError);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.originalError).toBeInstanceOf(Error);
    });

    it('should handle null/undefined', () => {
      const resultNull = AutosaveError.fromUnknown(null);
      expect(resultNull).toBeInstanceOf(AutosaveError);
      expect(resultNull.message).toBe('Autosave failed: null');

      const resultUndefined = AutosaveError.fromUnknown(undefined);
      expect(resultUndefined).toBeInstanceOf(AutosaveError);
      expect(resultUndefined.message).toBe('Autosave failed: undefined');
    });

    it('should handle numbers', () => {
      const result = AutosaveError.fromUnknown(404);

      expect(result).toBeInstanceOf(AutosaveError);
      expect(result.message).toBe('Autosave failed: 404');
    });

    it('should use default code when not provided', () => {
      const result = AutosaveError.fromUnknown(new Error('Test'));

      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should use custom code when provided', () => {
      const result = AutosaveError.fromUnknown(new Error('Test'), 'CUSTOM_CODE');

      expect(result.code).toBe('CUSTOM_CODE');
    });
  });
});

describe('TransportError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new TransportError('Transport failed');

      expect(error.message).toBe('Transport failed');
      expect(error.code).toBe('TRANSPORT_ERROR');
      expect(error.name).toBe('AutosaveError');
    });

    it('should accept original error', () => {
      const originalError = new Error('Network error');
      const error = new TransportError('Transport failed', originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('should extend AutosaveError', () => {
      const error = new TransportError('Transport failed');

      expect(error).toBeInstanceOf(AutosaveError);
      expect(error).toBeInstanceOf(TransportError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have TRANSPORT_ERROR code', () => {
      const error = new TransportError('Test');

      expect(error.code).toBe('TRANSPORT_ERROR');
    });
  });
});

describe('ValidationError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('AutosaveError');
    });

    it('should accept failedFields', () => {
      const failedFields = ['email', 'password'];
      const error = new ValidationError('Validation failed', failedFields);

      expect(error.failedFields).toEqual(failedFields);
    });

    it('should store failedFields in metadata', () => {
      const failedFields = ['email', 'password'];
      const error = new ValidationError('Validation failed', failedFields);

      expect(error.metadata).toEqual({ failedFields });
    });

    it('should extend AutosaveError', () => {
      const error = new ValidationError('Validation failed');

      expect(error).toBeInstanceOf(AutosaveError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have VALIDATION_ERROR code', () => {
      const error = new ValidationError('Test');

      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should work without failedFields', () => {
      const error = new ValidationError('Validation failed');

      expect(error.failedFields).toBeUndefined();
      expect(error.metadata).toEqual({ failedFields: undefined });
    });
  });
});

describe('DiffError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new DiffError('Diff operation failed');

      expect(error.message).toBe('Diff operation failed');
      expect(error.code).toBe('DIFF_ERROR');
      expect(error.name).toBe('AutosaveError');
    });

    it('should accept field parameter', () => {
      const error = new DiffError('Diff failed', 'tags');

      expect(error.field).toBe('tags');
    });

    it('should store field in metadata', () => {
      const error = new DiffError('Diff failed', 'tags');

      expect(error.metadata).toEqual({ field: 'tags' });
    });

    it('should accept original error', () => {
      const originalError = new Error('API error');
      const error = new DiffError('Diff failed', 'tags', originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('should extend AutosaveError', () => {
      const error = new DiffError('Diff failed');

      expect(error).toBeInstanceOf(AutosaveError);
      expect(error).toBeInstanceOf(DiffError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have DIFF_ERROR code', () => {
      const error = new DiffError('Test');

      expect(error.code).toBe('DIFF_ERROR');
    });

    it('should work without field parameter', () => {
      const error = new DiffError('Diff failed');

      expect(error.field).toBeUndefined();
      expect(error.metadata).toEqual({ field: undefined });
    });
  });
});

describe('Error class hierarchy', () => {
  it('should maintain proper inheritance chain', () => {
    const autosaveError = new AutosaveError('Test', 'TEST');
    const transportError = new TransportError('Test');
    const validationError = new ValidationError('Test');
    const diffError = new DiffError('Test');

    // All errors should be instances of Error
    expect(autosaveError).toBeInstanceOf(Error);
    expect(transportError).toBeInstanceOf(Error);
    expect(validationError).toBeInstanceOf(Error);
    expect(diffError).toBeInstanceOf(Error);

    // All custom errors should be instances of AutosaveError
    expect(autosaveError).toBeInstanceOf(AutosaveError);
    expect(transportError).toBeInstanceOf(AutosaveError);
    expect(validationError).toBeInstanceOf(AutosaveError);
    expect(diffError).toBeInstanceOf(AutosaveError);

    // Specific error types should not be instances of each other
    expect(transportError).not.toBeInstanceOf(ValidationError);
    expect(transportError).not.toBeInstanceOf(DiffError);
    expect(validationError).not.toBeInstanceOf(TransportError);
    expect(validationError).not.toBeInstanceOf(DiffError);
    expect(diffError).not.toBeInstanceOf(TransportError);
    expect(diffError).not.toBeInstanceOf(ValidationError);
  });

  it('should have correct name property', () => {
    const autosaveError = new AutosaveError('Test', 'TEST');
    const transportError = new TransportError('Test');
    const validationError = new ValidationError('Test');
    const diffError = new DiffError('Test');

    expect(autosaveError.name).toBe('AutosaveError');
    expect(transportError.name).toBe('AutosaveError');
    expect(validationError.name).toBe('AutosaveError');
    expect(diffError.name).toBe('AutosaveError');
  });
});
