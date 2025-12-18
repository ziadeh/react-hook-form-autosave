/**
 * Tests for autosaveReducer
 * Covers all action types and state transitions
 */

import { autosaveReducer, initialAutosaveState } from '../reducer';
import type { AutosaveState, AutosaveAction } from '../types';

describe('autosaveReducer', () => {
  describe('initialAutosaveState', () => {
    it('should have correct initial values', () => {
      expect(initialAutosaveState).toEqual({
        isSaving: false,
        lastError: null,
        baseline: null,
        isBaselineInitialized: false,
        config: {},
        metrics: {
          totalSaves: 0,
          successfulSaves: 0,
          failedSaves: 0,
          averageSaveTime: 0,
        },
      });
    });
  });

  describe('SAVE_START', () => {
    it('should set isSaving to true', () => {
      const action: AutosaveAction = { type: 'SAVE_START' };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.isSaving).toBe(true);
    });

    it('should clear lastError', () => {
      const stateWithError: AutosaveState = {
        ...initialAutosaveState,
        lastError: new Error('Previous error'),
      };

      const action: AutosaveAction = { type: 'SAVE_START' };
      const newState = autosaveReducer(stateWithError, action);

      expect(newState.lastError).toBeNull();
    });

    it('should not modify other state properties', () => {
      const action: AutosaveAction = { type: 'SAVE_START' };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.baseline).toBe(initialAutosaveState.baseline);
      expect(newState.metrics).toEqual(initialAutosaveState.metrics);
    });
  });

  describe('SAVE_SUCCESS', () => {
    it('should set isSaving to false', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        isSaving: true,
      };

      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 100 };
      const newState = autosaveReducer(state, action);

      expect(newState.isSaving).toBe(false);
    });

    it('should clear lastError', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        lastError: new Error('Some error'),
      };

      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 100 };
      const newState = autosaveReducer(state, action);

      expect(newState.lastError).toBeNull();
    });

    it('should increment totalSaves', () => {
      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.totalSaves).toBe(1);
    });

    it('should increment successfulSaves', () => {
      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.successfulSaves).toBe(1);
    });

    it('should not change failedSaves', () => {
      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.failedSaves).toBe(0);
    });

    it('should calculate average save time for first save', () => {
      const action: AutosaveAction = { type: 'SAVE_SUCCESS', duration: 150 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.averageSaveTime).toBe(150);
    });

    it('should calculate correct average save time for multiple saves', () => {
      let state = initialAutosaveState;

      // First save: 100ms
      state = autosaveReducer(state, { type: 'SAVE_SUCCESS', duration: 100 });
      expect(state.metrics.averageSaveTime).toBe(100);

      // Second save: 200ms -> average should be 150ms
      state = autosaveReducer(state, { type: 'SAVE_SUCCESS', duration: 200 });
      expect(state.metrics.averageSaveTime).toBe(150);

      // Third save: 150ms -> average should be 150ms
      state = autosaveReducer(state, { type: 'SAVE_SUCCESS', duration: 150 });
      expect(state.metrics.averageSaveTime).toBe(150);
    });
  });

  describe('SAVE_ERROR', () => {
    it('should set isSaving to false', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        isSaving: true,
      };

      const error = new Error('Save failed');
      const action: AutosaveAction = { type: 'SAVE_ERROR', error, duration: 100 };
      const newState = autosaveReducer(state, action);

      expect(newState.isSaving).toBe(false);
    });

    it('should set lastError', () => {
      const error = new Error('Save failed');
      const action: AutosaveAction = { type: 'SAVE_ERROR', error, duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.lastError).toBe(error);
    });

    it('should increment totalSaves', () => {
      const error = new Error('Save failed');
      const action: AutosaveAction = { type: 'SAVE_ERROR', error, duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.totalSaves).toBe(1);
    });

    it('should increment failedSaves', () => {
      const error = new Error('Save failed');
      const action: AutosaveAction = { type: 'SAVE_ERROR', error, duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.failedSaves).toBe(1);
    });

    it('should not change successfulSaves', () => {
      const error = new Error('Save failed');
      const action: AutosaveAction = { type: 'SAVE_ERROR', error, duration: 100 };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.metrics.successfulSaves).toBe(0);
    });

    it('should calculate average save time including failed saves', () => {
      let state = initialAutosaveState;

      // First successful save: 100ms
      state = autosaveReducer(state, { type: 'SAVE_SUCCESS', duration: 100 });

      // Failed save: 200ms -> average should be 150ms
      const error = new Error('Failed');
      state = autosaveReducer(state, { type: 'SAVE_ERROR', error, duration: 200 });

      expect(state.metrics.averageSaveTime).toBe(150);
    });
  });

  describe('UPDATE_BASELINE', () => {
    it('should merge baseline with existing baseline', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        baseline: { name: 'John', email: 'john@example.com' },
      };

      const action: AutosaveAction = {
        type: 'UPDATE_BASELINE',
        baseline: { email: 'newemail@example.com', age: 30 },
      };
      const newState = autosaveReducer(state, action);

      expect(newState.baseline).toEqual({
        name: 'John',
        email: 'newemail@example.com',
        age: 30,
      });
    });

    it('should work when baseline is null', () => {
      const action: AutosaveAction = {
        type: 'UPDATE_BASELINE',
        baseline: { name: 'John' },
      };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.baseline).toEqual({ name: 'John' });
    });

    it('should not change isBaselineInitialized', () => {
      const action: AutosaveAction = {
        type: 'UPDATE_BASELINE',
        baseline: { name: 'John' },
      };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.isBaselineInitialized).toBe(false);
    });
  });

  describe('INITIALIZE_BASELINE', () => {
    it('should set baseline', () => {
      const baseline = { name: 'John', email: 'john@example.com' };
      const action: AutosaveAction = { type: 'INITIALIZE_BASELINE', baseline };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.baseline).toEqual(baseline);
    });

    it('should set isBaselineInitialized to true', () => {
      const baseline = { name: 'John' };
      const action: AutosaveAction = { type: 'INITIALIZE_BASELINE', baseline };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState.isBaselineInitialized).toBe(true);
    });

    it('should replace existing baseline', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        baseline: { name: 'John', email: 'john@example.com' },
      };

      const newBaseline = { name: 'Jane' };
      const action: AutosaveAction = { type: 'INITIALIZE_BASELINE', baseline: newBaseline };
      const newState = autosaveReducer(state, action);

      expect(newState.baseline).toEqual(newBaseline);
      expect(newState.baseline).not.toHaveProperty('email');
    });
  });

  describe('RESET_BASELINE', () => {
    it('should set baseline to null', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        baseline: { name: 'John', email: 'john@example.com' },
        isBaselineInitialized: true,
      };

      const action: AutosaveAction = { type: 'RESET_BASELINE' };
      const newState = autosaveReducer(state, action);

      expect(newState.baseline).toBeNull();
    });

    it('should set isBaselineInitialized to false', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        baseline: { name: 'John' },
        isBaselineInitialized: true,
      };

      const action: AutosaveAction = { type: 'RESET_BASELINE' };
      const newState = autosaveReducer(state, action);

      expect(newState.isBaselineInitialized).toBe(false);
    });

    it('should not affect other state properties', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        baseline: { name: 'John' },
        isBaselineInitialized: true,
        isSaving: true,
        lastError: new Error('Test'),
      };

      const action: AutosaveAction = { type: 'RESET_BASELINE' };
      const newState = autosaveReducer(state, action);

      expect(newState.isSaving).toBe(true);
      expect(newState.lastError).toBe(state.lastError);
      expect(newState.metrics).toEqual(state.metrics);
    });
  });

  describe('ABORT', () => {
    it('should set isSaving to false', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        isSaving: true,
      };

      const action: AutosaveAction = { type: 'ABORT' };
      const newState = autosaveReducer(state, action);

      expect(newState.isSaving).toBe(false);
    });

    it('should not affect other state properties', () => {
      const state: AutosaveState = {
        ...initialAutosaveState,
        isSaving: true,
        lastError: new Error('Test'),
        baseline: { name: 'John' },
        metrics: {
          totalSaves: 5,
          successfulSaves: 4,
          failedSaves: 1,
          averageSaveTime: 125,
        },
      };

      const action: AutosaveAction = { type: 'ABORT' };
      const newState = autosaveReducer(state, action);

      expect(newState.lastError).toBe(state.lastError);
      expect(newState.baseline).toBe(state.baseline);
      expect(newState.metrics).toEqual(state.metrics);
    });
  });

  describe('Unknown action', () => {
    it('should return unchanged state for unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;
      const newState = autosaveReducer(initialAutosaveState, unknownAction);

      expect(newState).toBe(initialAutosaveState);
    });
  });

  describe('State immutability', () => {
    it('should not mutate original state', () => {
      const originalState = { ...initialAutosaveState };
      const action: AutosaveAction = { type: 'SAVE_START' };

      autosaveReducer(initialAutosaveState, action);

      expect(initialAutosaveState).toEqual(originalState);
    });

    it('should return a new state object', () => {
      const action: AutosaveAction = { type: 'SAVE_START' };
      const newState = autosaveReducer(initialAutosaveState, action);

      expect(newState).not.toBe(initialAutosaveState);
    });
  });
});
