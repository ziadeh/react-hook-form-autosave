/**
 * Tests for useAutosaveEffects hook
 * Covers baseline init, auto-hydration detection, main save effect, undo/redo trigger
 */

import { renderHook, act } from '@testing-library/react';
import { useAutosaveEffects } from '../useAutosaveEffects';
import { ValidationCache } from '../../../../cache/validationCache';
import { createLogger } from '../../../../utils/logger';
import { createMockForm } from '../../../../testing/testUtils';

type FormValues = { name: string; age?: number };

function makeParams(opts: {
  isDirty?: boolean;
  isValidating?: boolean;
  dirtyFields?: Record<string, boolean>;
  diffMap?: Record<string, any>;
  undoEnabled?: boolean;
  ignoreHistoryOps?: boolean;
  lastOp?: string | null;
  isHydrating?: boolean;
  isBaselineInitialized?: boolean;
  autoHydrate?: boolean;
  values?: FormValues;
  formValues?: FormValues;
  shouldSave?: (ctx: any) => boolean;
} = {}) {
  const {
    isDirty = false,
    isValidating = false,
    dirtyFields = {},
    diffMap,
    undoEnabled = false,
    ignoreHistoryOps = false,
    lastOp = null,
    isHydrating = false,
    isBaselineInitialized = false,
    autoHydrate = true,
    values = { name: 'John' },
    formValues = { name: 'John' },
    shouldSave = () => true,
  } = opts;

  const form = createMockForm<FormValues>({
    formState: {
      isDirty,
      isValid: true,
      dirtyFields,
      isValidating,
      errors: {},
    } as any,
    getValues: () => ({ ...formValues }) as any,
  });

  const validationCache = new ValidationCache();
  const logger = createLogger('test', false);
  const debouncedSave = jest.fn();
  const initializeBaseline = jest.fn();
  const resetBaseline = jest.fn();
  const setHistoryPending = jest.fn();
  const clearPendingPayload = jest.fn();
  const setLastQueuedSig = jest.fn();
  const setNoPendingGuard = jest.fn();
  const updateLastSavedState = jest.fn();
  const isEmpty = jest.fn(() => true);
  const handleHydration = jest.fn();
  const undoMgrRef = { current: null as any };

  const isHydratingRef = { current: isHydrating };
  const isBaselineInitializedRef = { current: isBaselineInitialized };
  const lastOpRef = { current: lastOp };
  const undoAffectedFieldsRef = { current: new Set<string>() };
  const historyPendingRef = { current: false };
  const lastRecordedValuesSigRef = { current: '' };

  const params = {
    form,
    values,
    isDirty,
    isValidating,
    dirtyFields,
    diffMap,
    logger,
    undoEnabled,
    ignoreHistoryOps,
    validationCache,
    debouncedSave,
    shouldSave,
    autoHydrate,
    isHydratingRef,
    isBaselineInitializedRef,
    lastOpRef,
    undoAffectedFieldsRef,
    historyPendingRef,
    lastRecordedValuesSigRef,
    initializeBaseline,
    resetBaseline,
    setHistoryPending,
    clearPendingPayload,
    setLastQueuedSig,
    setNoPendingGuard,
    updateLastSavedState,
    isEmpty,
    handleHydration,
    undoMgrRef,
  };

  return {
    params,
    debouncedSave,
    initializeBaseline,
    resetBaseline,
    setHistoryPending,
    handleHydration,
    setNoPendingGuard,
    isEmpty,
    isHydratingRef,
    isBaselineInitializedRef,
  };
}

describe('useAutosaveEffects', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('baseline initialization', () => {
    it('should initialize baseline when undoEnabled, not dirty, not yet initialized', () => {
      const { params, initializeBaseline } = makeParams({
        undoEnabled: true,
        isDirty: false,
        isBaselineInitialized: false,
        isHydrating: false,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(initializeBaseline).toHaveBeenCalled();
    });

    it('should NOT initialize baseline when already initialized', () => {
      const { params, initializeBaseline } = makeParams({
        undoEnabled: true,
        isDirty: false,
        isBaselineInitialized: true,
        isHydrating: false,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(initializeBaseline).not.toHaveBeenCalled();
    });

    it('should NOT initialize baseline when currently hydrating', () => {
      const { params, initializeBaseline } = makeParams({
        undoEnabled: true,
        isDirty: false,
        isBaselineInitialized: false,
        isHydrating: true,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(initializeBaseline).not.toHaveBeenCalled();
    });

    it('should NOT initialize baseline when neither diffMap nor undoEnabled', () => {
      const { params, initializeBaseline } = makeParams({
        undoEnabled: false,
        diffMap: undefined,
        isDirty: false,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(initializeBaseline).not.toHaveBeenCalled();
    });
  });

  describe('main save effect', () => {
    it('should call debouncedSave when form is dirty with user changes', () => {
      const { params, debouncedSave } = makeParams({
        isDirty: true,
        dirtyFields: { name: true },
        isValidating: false,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(debouncedSave).toHaveBeenCalledWith(
        params.values,
        params.dirtyFields,
        false
      );
    });

    it('should NOT call debouncedSave when validating', () => {
      const { params, debouncedSave } = makeParams({
        isDirty: true,
        dirtyFields: { name: true },
        isValidating: true,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(debouncedSave).not.toHaveBeenCalled();
    });

    it('should NOT call debouncedSave when hydrating', () => {
      const { params, debouncedSave, isHydratingRef } = makeParams({
        isDirty: true,
        dirtyFields: { name: true },
      });
      isHydratingRef.current = true;

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(debouncedSave).not.toHaveBeenCalled();
    });

    it('should NOT call debouncedSave when shouldSave returns false', () => {
      const { params, debouncedSave } = makeParams({
        isDirty: true,
        dirtyFields: { name: true },
        shouldSave: () => false,
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(debouncedSave).not.toHaveBeenCalled();
    });

    it('should NOT call debouncedSave when form is clean', () => {
      const { params, debouncedSave } = makeParams({
        isDirty: false,
        dirtyFields: {},
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(debouncedSave).not.toHaveBeenCalled();
    });
  });

  describe('undo/redo trigger', () => {
    it('should trigger debounced save for undo op when undoEnabled', () => {
      const { params, debouncedSave, setHistoryPending } = makeParams({
        undoEnabled: true,
        ignoreHistoryOps: false,
        lastOp: 'undo',
        isDirty: true,
        dirtyFields: { name: true },
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(setHistoryPending).toHaveBeenCalledWith(true);
      expect(debouncedSave).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        true // forceAfterUndo
      );
    });

    it('should NOT call debouncedSave for undo when ignoreHistoryOps=true', () => {
      const { params, debouncedSave } = makeParams({
        undoEnabled: true,
        ignoreHistoryOps: true,
        lastOp: 'undo',
        isDirty: false,
        dirtyFields: {},
      });

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      // With ignoreHistoryOps and no user changes, no save
      // (the undo check returns early because isUndoRedo but ignoreHistoryOps=true)
      expect(debouncedSave).not.toHaveBeenCalled();
    });
  });

  describe('cache clearing', () => {
    it('should clear validationCache when form becomes clean', () => {
      const { params } = makeParams({
        isDirty: false,
        dirtyFields: {},
      });
      const spy = jest.spyOn(params.validationCache, 'clear');

      renderHook(() => useAutosaveEffects(params));

      act(() => {
        jest.runAllTimers();
      });

      expect(spy).toHaveBeenCalled();
    });
  });
});
