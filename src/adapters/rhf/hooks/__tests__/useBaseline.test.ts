/**
 * Tests for useBaseline hook
 * Covers baseline initialization, updating, resetting, and comparison
 */

import { renderHook, act } from '@testing-library/react';
import { useBaseline } from '../useBaseline';
import { createMockForm } from '../../../../testing/testUtils';

describe('useBaseline', () => {
  describe('initial state', () => {
    it('should start with null baseline', () => {
      const form = createMockForm({ getValues: () => ({ name: 'John' }) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.getBaseline()).toBeNull();
    });

    it('should start with isBaselineInitialized false', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.isBaselineInitialized()).toBe(false);
    });

    it('should start with isBaselineInitializedRef.current false', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.isBaselineInitializedRef.current).toBe(false);
    });
  });

  describe('initializeBaseline()', () => {
    it('should set baseline to provided values', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John', age: 30 });
      });
      expect(result.current.getBaseline()).toEqual({ name: 'John', age: 30 });
    });

    it('should set isBaselineInitialized to true', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
      });
      expect(result.current.isBaselineInitialized()).toBe(true);
    });

    it('should update isBaselineInitializedRef', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ x: 1 });
      });
      expect(result.current.isBaselineInitializedRef.current).toBe(true);
    });

    it('should make a copy of the values (not reference)', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      const values = { name: 'John' };
      act(() => {
        result.current.initializeBaseline(values);
      });
      values.name = 'Jane'; // mutate original
      expect(result.current.getBaseline()).toEqual({ name: 'John' }); // baseline unchanged
    });
  });

  describe('updateBaseline()', () => {
    it('should merge payload into existing baseline', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John', age: 30 });
        result.current.updateBaseline({ name: 'Jane' });
      });
      expect(result.current.getBaseline()).toEqual({ name: 'Jane', age: 30 });
    });

    it('should do nothing if baseline is null', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.updateBaseline({ name: 'Jane' });
      });
      expect(result.current.getBaseline()).toBeNull();
    });

    it('should add new keys to baseline', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
        result.current.updateBaseline({ email: 'john@test.com' });
      });
      expect(result.current.getBaseline()).toEqual({
        name: 'John',
        email: 'john@test.com',
      });
    });
  });

  describe('resetBaseline()', () => {
    it('should set baseline back to null', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
        result.current.resetBaseline();
      });
      expect(result.current.getBaseline()).toBeNull();
    });

    it('should set isBaselineInitialized back to false', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
        result.current.resetBaseline();
      });
      expect(result.current.isBaselineInitialized()).toBe(false);
    });
  });

  describe('equalsBaseline()', () => {
    it('should return false when baseline is null', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.equalsBaseline({ name: 'John' })).toBe(false);
    });

    it('should return true when values match baseline exactly', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John', age: 30 });
      });
      expect(result.current.equalsBaseline({ name: 'John', age: 30 })).toBe(true);
    });

    it('should return false when values differ from baseline', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
      });
      expect(result.current.equalsBaseline({ name: 'Jane' })).toBe(false);
    });

    it('should compare nested objects deeply', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ profile: { name: 'John', city: 'NYC' } });
      });
      expect(result.current.equalsBaseline({ profile: { name: 'John', city: 'NYC' } })).toBe(true);
      expect(result.current.equalsBaseline({ profile: { name: 'John', city: 'LA' } })).toBe(false);
    });

    it('should return false when baseline has extra keys', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ name: 'John', age: 30 });
      });
      expect(result.current.equalsBaseline({ name: 'John' })).toBe(false);
    });

    it('should compare arrays correctly', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.initializeBaseline({ tags: ['a', 'b', 'c'] });
      });
      expect(result.current.equalsBaseline({ tags: ['a', 'b', 'c'] })).toBe(true);
      expect(result.current.equalsBaseline({ tags: ['a', 'b'] })).toBe(false);
    });
  });

  describe('forceBaselineUpdate()', () => {
    it('should update baseline to current form values', () => {
      const form = createMockForm({
        getValues: () => ({ name: 'CurrentName', age: 25 }) as any,
      });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.forceBaselineUpdate();
      });
      expect(result.current.getBaseline()).toEqual({ name: 'CurrentName', age: 25 });
    });

    it('should set isBaselineInitialized to true', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      act(() => {
        result.current.forceBaselineUpdate();
      });
      expect(result.current.isBaselineInitialized()).toBe(true);
    });
  });

  describe('shouldInitializeBaseline()', () => {
    it('should return false when neither diffMap nor undoEnabled', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form, undefined, false));
      expect(result.current.shouldInitializeBaseline(false)).toBe(false);
    });

    it('should return true when undoEnabled and not dirty and not initialized', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form, undefined, true));
      expect(result.current.shouldInitializeBaseline(false)).toBe(true);
    });

    it('should return false when isDirty', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form, undefined, true));
      expect(result.current.shouldInitializeBaseline(true)).toBe(false);
    });

    it('should return false when already initialized', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form, undefined, true));
      act(() => {
        result.current.initializeBaseline({ name: 'John' });
      });
      expect(result.current.shouldInitializeBaseline(false)).toBe(false);
    });
  });

  describe('shouldResetBaseline()', () => {
    it('should return true when not dirty and no dirtyFields', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.shouldResetBaseline(false, {})).toBe(true);
    });

    it('should return false when dirty', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.shouldResetBaseline(true, {})).toBe(false);
    });

    it('should return false when dirtyFields is non-empty', () => {
      const form = createMockForm({ getValues: () => ({}) });
      const { result } = renderHook(() => useBaseline(form));
      expect(result.current.shouldResetBaseline(false, { name: true })).toBe(false);
    });
  });
});
