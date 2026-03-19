/**
 * Tests for transform utility functions
 * Covers datesToIso, createDefaultSelectPayload, createDefaultShouldSave, createEffectiveDirtyFieldsGetter
 */

import {
  datesToIso,
  createDefaultSelectPayload,
  createDefaultShouldSave,
  createEffectiveDirtyFieldsGetter,
} from '../transforms';

describe('datesToIso', () => {
  it('should convert Date values to ISO strings', () => {
    const date = new Date('2025-01-15T12:00:00Z');
    const result = datesToIso({ createdAt: date });
    expect(typeof result.createdAt).toBe('string');
    expect(result.createdAt).toContain('2025-01-15');
  });

  it('should leave non-Date values unchanged', () => {
    const result = datesToIso({ name: 'John', count: 42, flag: true });
    expect(result).toEqual({ name: 'John', count: 42, flag: true });
  });

  it('should handle mixed values', () => {
    const date = new Date('2025-06-01T00:00:00Z');
    const result = datesToIso({ name: 'Alice', createdAt: date });
    expect(result.name).toBe('Alice');
    expect(typeof result.createdAt).toBe('string');
  });

  it('should return empty object for empty input', () => {
    expect(datesToIso({})).toEqual({});
  });
});

describe('createDefaultSelectPayload', () => {
  it('should extract only dirty fields from values', () => {
    const getEffectiveDirtyFields = (dirty: any) => dirty;
    const selectPayload = createDefaultSelectPayload(getEffectiveDirtyFields);

    const values = { name: 'John', email: 'j@test.com', age: 30 };
    const dirty = { name: true };

    const result = selectPayload(values, dirty);

    expect(result).toHaveProperty('name', 'John');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('age');
  });

  it('should return empty when no dirty fields', () => {
    const getEffectiveDirtyFields = (dirty: any) => dirty;
    const selectPayload = createDefaultSelectPayload(getEffectiveDirtyFields);

    const result = selectPayload({ name: 'John' }, {});

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should use getEffectiveDirtyFields to get dirty fields', () => {
    const getEffectiveDirtyFields = jest.fn((dirty: any) => ({ ...dirty, extra: true }));
    const selectPayload = createDefaultSelectPayload(getEffectiveDirtyFields);

    const values = { name: 'John', extra: 'ExtraValue' };
    selectPayload(values, { name: true });

    expect(getEffectiveDirtyFields).toHaveBeenCalledWith({ name: true });
  });
});

describe('createDefaultShouldSave', () => {
  it('should return true when there are effective dirty fields', () => {
    const getEffectiveDirtyFields = () => ({ name: true });
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields);

    const result = shouldSave({ dirtyFields: { name: true }, values: { name: 'Jane' }, isValid: true, isDirty: true });
    expect(result).toBe(true);
  });

  it('should return false when no dirty fields and no undo/redo', () => {
    const getEffectiveDirtyFields = () => ({});
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields);

    const result = shouldSave({ dirtyFields: {}, values: { name: 'John' }, isValid: true, isDirty: false });
    expect(result).toBe(false);
  });

  it('should return true when in undo/redo and value differs from baseline', () => {
    const getEffectiveDirtyFields = () => ({});
    const baselineRef = { current: { name: 'John' } };
    const lastOpRef = { current: 'undo' };
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields, baselineRef, lastOpRef);

    const result = shouldSave({ dirtyFields: {}, values: { name: 'OldName' }, isValid: true, isDirty: false });
    expect(result).toBe(true);
  });

  it('should return false when in undo/redo but value equals baseline', () => {
    const getEffectiveDirtyFields = () => ({});
    const baselineRef = { current: { name: 'John' } };
    const lastOpRef = { current: 'undo' };
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields, baselineRef, lastOpRef);

    const result = shouldSave({ dirtyFields: {}, values: { name: 'John' }, isValid: true, isDirty: false });
    expect(result).toBe(false);
  });

  it('should compare Date values in undo context', () => {
    const getEffectiveDirtyFields = () => ({});
    const date = new Date('2025-01-01');
    const baselineRef = { current: { createdAt: date } };
    const lastOpRef = { current: 'undo' };
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields, baselineRef, lastOpRef);

    // Same date — no save needed
    expect(shouldSave({ dirtyFields: {}, values: { createdAt: new Date('2025-01-01') }, isValid: true, isDirty: false })).toBe(false);
    // Different date — save needed
    expect(shouldSave({ dirtyFields: {}, values: { createdAt: new Date('2025-06-01') }, isValid: true, isDirty: false })).toBe(true);
  });

  it('should compare array values in undo context', () => {
    const getEffectiveDirtyFields = () => ({});
    const baselineRef = { current: { tags: ['a', 'b'] } };
    const lastOpRef = { current: 'redo' };
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields, baselineRef, lastOpRef);

    // Same array — no save
    expect(shouldSave({ dirtyFields: {}, values: { tags: ['a', 'b'] }, isValid: true, isDirty: false })).toBe(false);
    // Different array — save
    expect(shouldSave({ dirtyFields: {}, values: { tags: ['a', 'b', 'c'] }, isValid: true, isDirty: false })).toBe(true);
  });

  it('should compare nested object values in undo context', () => {
    const getEffectiveDirtyFields = () => ({});
    const baselineRef = { current: { profile: { name: 'John', age: 30 } } };
    const lastOpRef = { current: 'undo' };
    const shouldSave = createDefaultShouldSave(getEffectiveDirtyFields, baselineRef, lastOpRef);

    // Same nested object
    expect(shouldSave({ dirtyFields: {}, values: { profile: { name: 'John', age: 30 } }, isValid: true, isDirty: false })).toBe(false);
    // Changed nested object
    expect(shouldSave({ dirtyFields: {}, values: { profile: { name: 'Jane', age: 30 } }, isValid: true, isDirty: false })).toBe(true);
  });
});

describe('createEffectiveDirtyFieldsGetter', () => {
  it('should return current dirty fields when undo is not active', () => {
    const lastOpRef = { current: null };
    const undoAffectedFieldsRef = { current: new Set<string>() };
    const getter = createEffectiveDirtyFieldsGetter(false, lastOpRef, undoAffectedFieldsRef);

    const result = getter({ name: true, email: true });
    expect(result).toEqual({ name: true, email: true });
  });

  it('should add undo-affected fields to dirty set during undo', () => {
    const lastOpRef = { current: 'undo' };
    const undoAffectedFieldsRef = { current: new Set(['age']) };
    const getter = createEffectiveDirtyFieldsGetter(true, lastOpRef, undoAffectedFieldsRef);

    const result = getter({ name: true });
    expect(result).toHaveProperty('name', true);
    expect(result.age).toBe(true);
  });

  it('should add undo-affected fields during redo', () => {
    const lastOpRef = { current: 'redo' };
    const undoAffectedFieldsRef = { current: new Set(['email']) };
    const getter = createEffectiveDirtyFieldsGetter(true, lastOpRef, undoAffectedFieldsRef);

    const result = getter({});
    expect(result.email).toBe(true);
  });

  it('should handle nested undo-affected field paths', () => {
    const lastOpRef = { current: 'undo' };
    const undoAffectedFieldsRef = { current: new Set(['profile.name']) };
    const getter = createEffectiveDirtyFieldsGetter(true, lastOpRef, undoAffectedFieldsRef);

    const result = getter({});
    expect(result.profile?.name).toBe(true);
  });

  it('should NOT add undo-affected fields when undoEnabled is false', () => {
    const lastOpRef = { current: 'undo' };
    const undoAffectedFieldsRef = { current: new Set(['age']) };
    const getter = createEffectiveDirtyFieldsGetter(false, lastOpRef, undoAffectedFieldsRef);

    const result = getter({ name: true });
    expect(result).not.toHaveProperty('age');
  });
});
