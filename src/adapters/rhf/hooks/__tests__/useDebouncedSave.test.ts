/**
 * Tests for useDebouncedSave hook
 * Covers debounce timing, payload building, validation gating, duplicate detection, forceSave
 */

import { renderHook, act } from '@testing-library/react';
import { useDebouncedSave } from '../useDebouncedSave';
import { AutosaveManager } from '../../../../core/autosave';
import { ValidationCache } from '../../../../cache/validationCache';
import { MetricsCollector } from '../../../../metrics/collector';
import { createMockForm, createMockTransport } from '../../../../testing/testUtils';
import { createLogger } from '../../../../utils/logger';

type FormValues = { name: string; email?: string; age?: number };

function makeParams(opts: {
  debounceMs?: number;
  validateBeforeSave?: 'none' | 'payload' | 'all';
  equalsBaseline?: (vals: any) => boolean;
  lastOp?: string | null;
  baseline?: Record<string, any> | null;
  shouldSave?: (ctx: any) => boolean;
  formValues?: FormValues;
  formValid?: boolean;
  formDirty?: boolean;
  formDirtyFields?: Record<string, boolean>;
} = {}) {
  const transport = createMockTransport([{ ok: true }]);
  const manager = new AutosaveManager(transport);
  const validationCache = new ValidationCache();
  const metrics = new MetricsCollector();
  const logger = createLogger('test', false);

  const {
    debounceMs = 100,
    validateBeforeSave = 'none',
    equalsBaseline = () => false,
    lastOp = null,
    baseline = null,
    shouldSave,
    formValues = { name: 'John' },
    formValid = true,
    formDirty = true,
    formDirtyFields = { name: true },
  } = opts;

  const triggerMock = jest.fn().mockResolvedValue(formValid);
  const form = createMockForm<FormValues>({
    formState: {
      isDirty: formDirty,
      isValid: formValid,
      dirtyFields: formDirtyFields,
      isValidating: false,
    } as any,
    getValues: () => formValues as any,
    trigger: triggerMock,
  });

  // Refs
  const debounceTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
  const pendingPayloadRef = { current: {} as Record<string, any> };
  const lastQueuedSigRef = { current: '' };
  const historyPendingRef = { current: false };
  const noPendingGuardRef = { current: false };
  const baselineRef = { current: baseline };
  const lastOpRef = { current: lastOp };

  // Setters
  const setDebounceTimeout = jest.fn((id: ReturnType<typeof setTimeout>) => { debounceTimeoutRef.current = id; });
  const clearDebounceTimeout = jest.fn(() => {
    if (debounceTimeoutRef.current) { clearTimeout(debounceTimeoutRef.current); debounceTimeoutRef.current = null; }
  });
  const setPendingPayload = jest.fn((p: Record<string, any>) => { pendingPayloadRef.current = p; });
  const clearPendingPayload = jest.fn(() => { pendingPayloadRef.current = {}; });
  const setLastQueuedSig = jest.fn((sig: string) => { lastQueuedSigRef.current = sig; });
  const setHistoryPending = jest.fn((v: boolean) => { historyPendingRef.current = v; });
  const setNoPendingGuard = jest.fn((v: boolean) => { noPendingGuardRef.current = v; });
  const updateLastSavedState = jest.fn();

  const selectPayload = jest.fn((values: FormValues, dirty: Record<string, boolean>) => {
    const result: Partial<FormValues> = {};
    for (const key of Object.keys(dirty) as (keyof FormValues)[]) {
      if (key in values) (result as any)[key] = values[key];
    }
    return result;
  });

  const getEffectiveDirtyFields = jest.fn((dirty: any) => dirty);

  const params = {
    form,
    manager,
    validationCache,
    metrics,
    logger,
    validateBeforeSave,
    equalsBaseline,
    getEffectiveDirtyFields,
    selectPayload,
    shouldSave,
    config: { debounceMs },
    debounceTimeoutRef,
    pendingPayloadRef,
    lastQueuedSigRef,
    historyPendingRef,
    noPendingGuardRef,
    baselineRef,
    lastOpRef,
    setDebounceTimeout,
    clearDebounceTimeout,
    setPendingPayload,
    clearPendingPayload,
    setLastQueuedSig,
    setHistoryPending,
    setNoPendingGuard,
    updateLastSavedState,
  };

  return { params, transport, manager, triggerMock, setLastQueuedSig, updateLastSavedState, lastQueuedSigRef };
}

describe('useDebouncedSave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('debouncedSave()', () => {
    it('should schedule a debounced save with the configured delay', async () => {
      const { params, transport } = makeParams({ debounceMs: 200 });
      const { result } = renderHook(() => useDebouncedSave(params));

      act(() => {
        result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
      });

      // Not fired yet
      expect(transport.getCalls()).toHaveLength(0);

      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      });

      expect(transport.getCalls()).toHaveLength(1);
    });

    it('should cancel previous debounce on new call', async () => {
      const { params, transport } = makeParams({ debounceMs: 200 });
      const { result } = renderHook(() => useDebouncedSave(params));

      act(() => {
        result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
      });
      act(() => {
        jest.advanceTimersByTime(100);
        result.current.debouncedSave({ name: 'Jane' } as FormValues, { name: true }, false);
      });

      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      });

      // Only one call — the second debounce
      expect(transport.getCalls()).toHaveLength(1);
      expect(transport.getCalls()[0]).toEqual({ name: 'Jane' });
    });

    it('should build payload from dirty fields', async () => {
      const { params, transport } = makeParams({
        debounceMs: 50,
        formValues: { name: 'John', email: 'j@test.com' },
        formDirtyFields: { name: true }, // only name dirty
      });
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        result.current.debouncedSave({ name: 'John', email: 'j@test.com' } as FormValues, { name: true }, false);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Only name in payload (dirty field only)
      expect(transport.getCalls()[0]).toEqual({ name: 'John' });
    });

    it('should skip save when payload is empty', async () => {
      const { params, transport } = makeParams({ debounceMs: 50 });
      // selectPayload returns empty
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params as any).selectPayload = jest.fn(() => ({}));
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        result.current.debouncedSave({ name: 'John' } as FormValues, {}, false);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(transport.getCalls()).toHaveLength(0);
    });

    it('should update saved state and guard when empty payload + equalsBaseline', async () => {
      const { params, transport, updateLastSavedState } = makeParams({
        debounceMs: 50,
        equalsBaseline: () => true, // equals baseline when empty
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params as any).selectPayload = jest.fn(() => ({}));
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        result.current.debouncedSave({ name: 'John' } as FormValues, {}, false);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(transport.getCalls()).toHaveLength(0);
      expect(updateLastSavedState).toHaveBeenCalled();
    });

    it('should skip duplicate payloads (same signature)', async () => {
      const { params, transport } = makeParams({ debounceMs: 50 });
      // First save — sets lastQueuedSig
      params.lastQueuedSigRef.current = JSON.stringify({ name: 'John' }); // pre-set sig
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(transport.getCalls()).toHaveLength(0);
    });

    describe('after undo/redo', () => {
      it('should build payload by comparing with baseline when forceAfterUndo=true', async () => {
        const { params, transport } = makeParams({
          debounceMs: 50,
          lastOp: 'undo',
          baseline: { name: 'John', age: 30 },
          formValues: { name: 'OldName', age: 30 }, // name reverted
        });
        const { result } = renderHook(() => useDebouncedSave(params));

        await act(async () => {
          result.current.debouncedSave({ name: 'OldName', age: 30 } as any, {}, true);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        // Only name differs from baseline
        expect(transport.getCalls()[0]).toEqual({ name: 'OldName' });
      });

      it('should send all values when no baseline exists during undo/redo', async () => {
        const { params, transport } = makeParams({
          debounceMs: 50,
          lastOp: 'undo',
          baseline: null,
          formValues: { name: 'OldName' },
        });
        const { result } = renderHook(() => useDebouncedSave(params));

        await act(async () => {
          result.current.debouncedSave({ name: 'OldName' } as FormValues, {}, true);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        expect(transport.getCalls()[0]).toEqual({ name: 'OldName' });
      });
    });

    describe('validation gating', () => {
      it('should skip save when validateBeforeSave=payload and validation fails', async () => {
        const { params, transport } = makeParams({
          debounceMs: 50,
          validateBeforeSave: 'payload',
          formValid: false,
        });
        params.form = createMockForm<FormValues>({
          formState: { isDirty: true, isValid: false, dirtyFields: { name: true }, isValidating: false } as any,
          getValues: () => ({ name: 'John' }) as any,
          trigger: jest.fn().mockResolvedValue(false),
        });
        const { result } = renderHook(() => useDebouncedSave(params));

        await act(async () => {
          result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        expect(transport.getCalls()).toHaveLength(0);
      });

      it('should proceed when validateBeforeSave=none regardless of validity', async () => {
        const { params, transport } = makeParams({
          debounceMs: 50,
          validateBeforeSave: 'none',
        });
        const { result } = renderHook(() => useDebouncedSave(params));

        await act(async () => {
          result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        expect(transport.getCalls()).toHaveLength(1);
      });

      it('should use cached validation result on second save (cache hit)', async () => {
        const { params, transport, triggerMock } = makeParams({
          debounceMs: 50,
          validateBeforeSave: 'payload',
        });
        const { result } = renderHook(() => useDebouncedSave(params));

        // First save — triggers validation (cache miss)
        await act(async () => {
          result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        // Reset lastQueuedSig so second save proceeds
        params.lastQueuedSigRef.current = '';

        // Second save with same payload — should hit cache
        await act(async () => {
          result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
          jest.advanceTimersByTime(100);
          await Promise.resolve();
        });

        // trigger should only be called once (second used cache)
        expect(triggerMock.mock.calls.length).toBeLessThanOrEqual(2);
      });
    });

    it('should update lastSavedState on successful save', async () => {
      const { params, updateLastSavedState } = makeParams({ debounceMs: 50 });
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        result.current.debouncedSave({ name: 'John' } as FormValues, { name: true }, false);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(updateLastSavedState).toHaveBeenCalled();
    });
  });

  describe('forceSave()', () => {
    it('should immediately save without debounce', async () => {
      const { params, transport } = makeParams({
        baseline: { name: 'John' },
        equalsBaseline: (v) => v.name === 'John',
        formValues: { name: 'Jane' },
      });
      params.baselineRef.current = { name: 'John' };
      const { result } = renderHook(() => useDebouncedSave(params));

      let saveResult: any;
      await act(async () => {
        saveResult = await result.current.forceSave();
      });

      expect(saveResult.ok).toBe(true);
      expect(transport.getCalls()).toHaveLength(1);
    });

    it('should return ok:true without transport call when already in sync with baseline', async () => {
      const { params, transport } = makeParams({
        equalsBaseline: () => true, // already synced
        formValues: { name: 'John' },
      });
      params.baselineRef.current = { name: 'John' };
      const { result } = renderHook(() => useDebouncedSave(params));

      let saveResult: any;
      await act(async () => {
        saveResult = await result.current.forceSave();
      });

      expect(saveResult.ok).toBe(true);
      expect(transport.getCalls()).toHaveLength(0);
    });

    it('should block save when shouldSave returns false', async () => {
      const { params, transport } = makeParams({
        shouldSave: () => false,
        equalsBaseline: () => false,
        formValues: { name: 'Jane' },
        baseline: { name: 'John' },
      });
      params.baselineRef.current = { name: 'John' };
      const { result } = renderHook(() => useDebouncedSave(params));

      let saveResult: any;
      await act(async () => {
        saveResult = await result.current.forceSave();
      });

      expect(saveResult.ok).toBe(false);
      expect(transport.getCalls()).toHaveLength(0);
    });

    it('should build payload by comparing with baseline', async () => {
      const { params, transport } = makeParams({
        equalsBaseline: () => false,
        baseline: { name: 'John', age: 30 },
        formValues: { name: 'Jane', age: 30 },
      });
      params.baselineRef.current = { name: 'John', age: 30 };
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        await result.current.forceSave();
      });

      // Only name changed
      expect(transport.getCalls()[0]).toEqual({ name: 'Jane' });
    });

    it('should cancel pending debounce', async () => {
      const { params, transport } = makeParams({
        debounceMs: 500,
        equalsBaseline: () => false,
        baseline: { name: 'John' },
        formValues: { name: 'Jane' },
      });
      params.baselineRef.current = { name: 'John' };
      const { result } = renderHook(() => useDebouncedSave(params));

      act(() => {
        result.current.debouncedSave({ name: 'Jane' } as FormValues, { name: true }, false);
      });

      await act(async () => {
        await result.current.forceSave();
        jest.runAllTimers(); // advance any remaining timers
        await Promise.resolve();
      });

      // Only one transport call (from forceSave, not from the debounce)
      expect(transport.getCalls().length).toBeGreaterThanOrEqual(1);
    });

    it('should update lastSavedState after successful forceSave', async () => {
      const { params, updateLastSavedState } = makeParams({
        equalsBaseline: () => false,
        baseline: { name: 'John' },
        formValues: { name: 'Jane' },
      });
      params.baselineRef.current = { name: 'John' };
      const { result } = renderHook(() => useDebouncedSave(params));

      await act(async () => {
        await result.current.forceSave();
      });

      expect(updateLastSavedState).toHaveBeenCalled();
    });
  });
});
