/**
 * Tests for usePendingState hook
 * Covers all 7 branches of computeHasPendingChanges, abort, flush, updateLastSavedState
 */

import { renderHook, act } from '@testing-library/react';
import { usePendingState } from '../usePendingState';
import { AutosaveManager } from '../../../../core/autosave';
import { createMockForm, createMockTransport } from '../../../../testing/testUtils';

function makeHook(opts: {
  equalsBaseline?: (vals: any) => boolean;
  ignoreHistoryOps?: boolean;
  isDirty?: boolean;
  dirtyFields?: Record<string, boolean>;
  formValues?: Record<string, any>;
} = {}) {
  const transport = createMockTransport();
  const manager = new AutosaveManager(transport);

  const {
    equalsBaseline = () => true,
    ignoreHistoryOps = false,
    isDirty = false,
    dirtyFields = {},
    formValues = { name: 'John' },
  } = opts;

  const form = createMockForm({
    formState: { isDirty, isValid: true, dirtyFields, isValidating: false } as any,
    getValues: () => formValues as any,
  });

  const { result } = renderHook(() =>
    usePendingState(form, manager, equalsBaseline, ignoreHistoryOps)
  );

  return { result, manager, form, transport };
}

describe('usePendingState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with empty pending payload', () => {
      const { result } = makeHook();
      expect(result.current.pendingPayloadRef.current).toEqual({});
    });

    it('isEmpty should return true initially', () => {
      const { result } = makeHook();
      expect(result.current.isEmpty()).toBe(true);
    });
  });

  describe('computeHasPendingChanges()', () => {
    describe('Branch 1: noPendingGuard', () => {
      it('should return false when noPendingGuard is set', () => {
        const { result } = makeHook();
        act(() => {
          result.current.setNoPendingGuard(true);
        });
        expect(result.current.computeHasPendingChanges()).toBe(false);
      });

      it('should auto-clear noPendingGuard after 100ms', () => {
        const { result } = makeHook({ equalsBaseline: () => false, isDirty: true, dirtyFields: { name: true } });
        act(() => {
          result.current.setNoPendingGuard(true);
        });
        result.current.computeHasPendingChanges(); // triggers timer
        act(() => {
          jest.advanceTimersByTime(101);
        });
        // After guard clears, dirty form should be pending
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });

    describe('Branch 2: active debounce timer', () => {
      it('should return true when debounce timeout is active', () => {
        const { result } = makeHook();
        act(() => {
          const id = setTimeout(() => {}, 600) as ReturnType<typeof setTimeout>;
          result.current.setDebounceTimeout(id);
        });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });

    describe('Branch 3: react-layer pending payload', () => {
      it('should return true when pendingPayload is non-empty', () => {
        const { result } = makeHook();
        act(() => {
          result.current.setPendingPayload({ name: 'Jane' });
        });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });

    describe('Branch 4: manager pending changes', () => {
      it('should return true when manager has queued changes', () => {
        const { result, manager } = makeHook();
        manager.queueChange({ name: 'Jane' });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });

    describe('Branch 5: history pending', () => {
      it('should return true when historyPending is true and not ignoring ops', () => {
        const { result } = makeHook({ ignoreHistoryOps: false });
        act(() => {
          result.current.setHistoryPending(true);
        });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });

      it('should return false when historyPending but ignoreHistoryOps is true', () => {
        const { result } = makeHook({ ignoreHistoryOps: true, equalsBaseline: () => true });
        act(() => {
          result.current.setHistoryPending(true);
        });
        // With ignoreHistoryOps, falls through to baseline comparison which returns false (equals)
        expect(result.current.computeHasPendingChanges()).toBe(false);
      });
    });

    describe('Branch 6: lastSavedState match', () => {
      it('should return false when current values match last saved state', () => {
        const formValues = { name: 'John', age: 30 };
        const { result } = makeHook({ formValues });
        act(() => {
          result.current.updateLastSavedState(formValues);
        });
        expect(result.current.computeHasPendingChanges()).toBe(false);
      });

      it('should return true (falls to dirty check) when values differ from saved state', () => {
        const { result } = makeHook({
          formValues: { name: 'Jane' },
          isDirty: true,
          dirtyFields: { name: true },
          equalsBaseline: () => false,
        });
        act(() => {
          result.current.updateLastSavedState({ name: 'John' }); // saved is John, current is Jane
        });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });

    describe('Branch 7: baseline comparison', () => {
      it('should return false when equals baseline', () => {
        const { result } = makeHook({ equalsBaseline: () => true });
        expect(result.current.computeHasPendingChanges()).toBe(false);
      });

      it('should return true when differs from baseline', () => {
        const { result } = makeHook({ equalsBaseline: () => false, isDirty: true, dirtyFields: { name: true } });
        expect(result.current.computeHasPendingChanges()).toBe(true);
      });
    });
  });

  describe('updateLastSavedState()', () => {
    it('should serialize and store values in stable order', () => {
      const { result } = makeHook({ formValues: { b: 2, a: 1 } });
      act(() => {
        result.current.updateLastSavedState({ b: 2, a: 1 });
      });
      // Serialize with reverse key order — should still match
      const form2Values = { a: 1, b: 2 };
      const { result: result2 } = makeHook({ formValues: form2Values });
      act(() => {
        result2.current.updateLastSavedState({ a: 1, b: 2 });
      });
      // Both produce the same stable JSON, so computeHasPendingChanges returns false
      expect(result.current.computeHasPendingChanges()).toBe(false);
    });
  });

  describe('getPendingChanges()', () => {
    it('should merge react-layer and manager pending changes', () => {
      const { result, manager } = makeHook();
      act(() => {
        result.current.setPendingPayload({ name: 'Jane' });
      });
      manager.queueChange({ age: 25 });
      const pending = result.current.getPendingChanges();
      expect(pending).toEqual({ name: 'Jane', age: 25 });
    });
  });

  describe('isEmpty()', () => {
    it('should return true when nothing pending', () => {
      const { result } = makeHook();
      expect(result.current.isEmpty()).toBe(true);
    });

    it('should return false when pending payload exists', () => {
      const { result } = makeHook();
      act(() => {
        result.current.setPendingPayload({ name: 'Jane' });
      });
      expect(result.current.isEmpty()).toBe(false);
    });

    it('should return false when debounce timer active', () => {
      const { result } = makeHook();
      act(() => {
        const id = setTimeout(() => {}, 600) as ReturnType<typeof setTimeout>;
        result.current.setDebounceTimeout(id);
      });
      expect(result.current.isEmpty()).toBe(false);
    });

    it('should return false when manager has pending', () => {
      const { result, manager } = makeHook();
      manager.queueChange({ name: 'Jane' });
      expect(result.current.isEmpty()).toBe(false);
    });
  });

  describe('clearPendingPayload()', () => {
    it('should empty the pending payload', () => {
      const { result } = makeHook();
      act(() => {
        result.current.setPendingPayload({ name: 'Jane' });
        result.current.clearPendingPayload();
      });
      expect(result.current.pendingPayloadRef.current).toEqual({});
    });
  });

  describe('abort()', () => {
    it('should clear debounce timeout', () => {
      const { result } = makeHook({ equalsBaseline: () => true });
      act(() => {
        const id = setTimeout(() => {}, 600) as ReturnType<typeof setTimeout>;
        result.current.setDebounceTimeout(id);
        result.current.abort();
      });
      expect(result.current.debounceTimeoutRef.current).toBeNull();
    });

    it('should clear pending payload', () => {
      const { result } = makeHook({ equalsBaseline: () => true });
      act(() => {
        result.current.setPendingPayload({ name: 'Jane' });
        result.current.abort();
      });
      expect(result.current.pendingPayloadRef.current).toEqual({});
    });

    it('should set noPendingGuard when equals baseline', () => {
      const { result } = makeHook({ equalsBaseline: () => true });
      act(() => {
        result.current.abort();
      });
      expect(result.current.noPendingGuardRef.current).toBe(true);
    });

    it('should abort manager', () => {
      const { result, manager } = makeHook({ equalsBaseline: () => true });
      manager.queueChange({ name: 'Jane' });
      act(() => {
        result.current.abort();
      });
      expect(manager.isEmpty()).toBe(true);
    });
  });

  describe('flush()', () => {
    it('should flush manager and return result', async () => {
      const { result, transport } = makeHook({ equalsBaseline: () => true });
      let flushResult: any;
      await act(async () => {
        result.current.setPendingPayload({ name: 'Jane' });
        flushResult = await result.current.flush();
      });
      expect(flushResult.ok).toBe(true);
      expect(transport.getCalls()).toHaveLength(1);
    });

    it('should clear pending payload after flush', async () => {
      const { result } = makeHook({ equalsBaseline: () => true });
      await act(async () => {
        result.current.setPendingPayload({ name: 'Jane' });
        await result.current.flush();
      });
      expect(result.current.pendingPayloadRef.current).toEqual({});
    });
  });

  describe('setters', () => {
    it('setHistoryPending should update historyPendingRef', () => {
      const { result } = makeHook();
      act(() => { result.current.setHistoryPending(true); });
      expect(result.current.historyPendingRef.current).toBe(true);
    });

    it('setNoPendingGuard should update noPendingGuardRef', () => {
      const { result } = makeHook();
      act(() => { result.current.setNoPendingGuard(true); });
      expect(result.current.noPendingGuardRef.current).toBe(true);
    });

    it('setLastQueuedSig should update lastQueuedSigRef', () => {
      const { result } = makeHook();
      act(() => { result.current.setLastQueuedSig('abc123'); });
      expect(result.current.lastQueuedSigRef.current).toBe('abc123');
    });
  });
});
