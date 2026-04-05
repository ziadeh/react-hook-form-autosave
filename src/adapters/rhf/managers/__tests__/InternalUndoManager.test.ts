/**
 * Tests for InternalUndoManager
 * Covers past/future stacks, undo/redo, checkpoints, listeners, maxEntries
 */

import { InternalUndoManager } from '../InternalUndoManager';
import type { HistoryEntry } from '../../utils/types';

function makeEntry(name: string, prev: unknown, next: unknown): HistoryEntry {
  return [{ name, prevValue: prev, nextValue: next, rootField: name }];
}

function makeManager(opts: {
  maxEntries?: number;
  onHistoryApplied?: (entry: HistoryEntry, op: 'undo' | 'redo') => void;
} = {}) {
  const setValueCalls: Array<{ name: string; value: unknown }> = [];
  const values: Record<string, unknown> = {};

  const setValue = (name: string, value: unknown) => {
    values[name] = value;
    setValueCalls.push({ name, value });
  };

  const getCurrentValues = () => ({ ...values });

  const logger = { debug: jest.fn() };

  const mgr = new InternalUndoManager(
    setValue,
    getCurrentValues,
    opts.onHistoryApplied,
    opts.maxEntries,
    logger
  );

  return { mgr, values, setValueCalls, logger };
}

describe('InternalUndoManager', () => {
  describe('initial state', () => {
    it('should start with empty stacks', () => {
      const { mgr } = makeManager();
      expect(mgr.canUndo()).toBe(false);
      expect(mgr.canRedo()).toBe(false);
      expect(mgr.getState()).toEqual({ past: 0, future: 0, checkpoints: [] });
    });

    it('should have null lastOp initially', () => {
      const { mgr } = makeManager();
      expect(mgr.getLastOp()).toBeNull();
    });
  });

  describe('record()', () => {
    it('should add entry to past stack', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'old', 'new'));
      expect(mgr.canUndo()).toBe(true);
      expect(mgr.getState().past).toBe(1);
    });

    it('should set lastOp to "user"', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'old', 'new'));
      expect(mgr.getLastOp()).toBe('user');
    });

    it('should ignore empty entries', () => {
      const { mgr } = makeManager();
      mgr.record([]);
      expect(mgr.canUndo()).toBe(false);
    });

    it('should notify listeners on record', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.subscribe(listener);
      mgr.record(makeEntry('name', 'old', 'new'));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple entries', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 'x', 'y'));
      mgr.record(makeEntry('c', true, false));
      expect(mgr.getState().past).toBe(3);
    });
  });

  describe('maxEntries trimming', () => {
    it('should trim oldest entry when maxEntries exceeded', () => {
      const { mgr } = makeManager({ maxEntries: 2 });
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 2, 3));
      mgr.record(makeEntry('c', 3, 4)); // should trim 'a'
      expect(mgr.getState().past).toBe(2);
    });

    it('should adjust checkpoints when entries trimmed', () => {
      const { mgr } = makeManager({ maxEntries: 3 });
      mgr.record(makeEntry('a', 1, 2));
      mgr.markCheckpoint(); // checkpoint at position 1
      mgr.record(makeEntry('b', 2, 3));
      mgr.record(makeEntry('c', 3, 4));
      mgr.record(makeEntry('d', 4, 5)); // trims 'a', checkpoint shifts to 0
      // Checkpoint at 0 means "undo all"
      expect(mgr.getState().past).toBe(3);
    });

    it('should remove negative checkpoints after trim', () => {
      const { mgr } = makeManager({ maxEntries: 2 });
      mgr.record(makeEntry('a', 1, 2));
      mgr.markCheckpoint(); // checkpoint at 1
      mgr.record(makeEntry('b', 2, 3));
      mgr.record(makeEntry('c', 3, 4)); // trims 'a', checkpoint becomes 0
      mgr.record(makeEntry('d', 4, 5)); // trims 'b', checkpoint becomes -1, filtered out
      expect(mgr.getState().checkpoints.every((cp) => cp >= 0)).toBe(true);
    });
  });

  describe('undo()', () => {
    it('should return false when nothing to undo', () => {
      const { mgr } = makeManager();
      expect(mgr.undo()).toBe(false);
    });

    it('should apply previous values via setValue', () => {
      const { mgr, setValueCalls } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      expect(setValueCalls).toContainEqual({ name: 'name', value: 'John' });
    });

    it('should move entry from past to future', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      expect(mgr.getState().past).toBe(0);
      expect(mgr.getState().future).toBe(1);
    });

    it('should set lastOp to "undo"', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      expect(mgr.getLastOp()).toBe('undo');
    });

    it('should call onHistoryApplied with undo', () => {
      const onHistoryApplied = jest.fn();
      const { mgr } = makeManager({ onHistoryApplied });
      const entry = makeEntry('name', 'John', 'Jane');
      mgr.record(entry);
      mgr.undo();
      expect(onHistoryApplied).toHaveBeenCalledWith(entry, 'undo');
    });

    it('should notify listeners', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.subscribe(listener);
      mgr.record(makeEntry('name', 'John', 'Jane'));
      listener.mockClear();
      mgr.undo();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should build correct redo entry from current values', () => {
      const { mgr, values, setValueCalls } = makeManager();
      values['name'] = 'Current';
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      // Should be able to redo back to 'Current'
      mgr.redo();
      expect(setValueCalls[setValueCalls.length - 1]).toEqual({ name: 'name', value: 'Current' });
    });

    it('should handle multi-field entries', () => {
      const { mgr, setValueCalls } = makeManager();
      const entry: HistoryEntry = [
        { name: 'first', prevValue: 'John', nextValue: 'Jane', rootField: 'first' },
        { name: 'last', prevValue: 'Smith', nextValue: 'Doe', rootField: 'last' },
      ];
      mgr.record(entry);
      mgr.undo();
      expect(setValueCalls).toContainEqual({ name: 'first', value: 'John' });
      expect(setValueCalls).toContainEqual({ name: 'last', value: 'Smith' });
    });
  });

  describe('redo()', () => {
    it('should return false when nothing to redo', () => {
      const { mgr } = makeManager();
      expect(mgr.redo()).toBe(false);
    });

    it('should apply next values via setValue', () => {
      const { mgr, setValueCalls } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      setValueCalls.length = 0;
      mgr.redo();
      expect(setValueCalls[0].name).toBe('name');
    });

    it('should move entry from future to past', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      mgr.redo();
      expect(mgr.getState().past).toBe(1);
      expect(mgr.getState().future).toBe(0);
    });

    it('should set lastOp to "redo"', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      mgr.redo();
      expect(mgr.getLastOp()).toBe('redo');
    });

    it('should call onHistoryApplied with redo', () => {
      const onHistoryApplied = jest.fn();
      const { mgr } = makeManager({ onHistoryApplied });
      const entry = makeEntry('name', 'John', 'Jane');
      mgr.record(entry);
      mgr.undo();
      onHistoryApplied.mockClear();
      mgr.redo();
      expect(onHistoryApplied).toHaveBeenCalledWith(expect.any(Array), 'redo');
    });

    it('should not redo after new record', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      mgr.clearFuture();
      mgr.record(makeEntry('name', 'John', 'Bob'));
      expect(mgr.canRedo()).toBe(false);
    });
  });

  describe('clearFuture()', () => {
    it('should clear redo stack', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      expect(mgr.canRedo()).toBe(true);
      mgr.clearFuture();
      expect(mgr.canRedo()).toBe(false);
    });

    it('should notify listeners when future is cleared', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undo();
      mgr.subscribe(listener);
      mgr.clearFuture();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not notify when future already empty', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.subscribe(listener);
      mgr.clearFuture(); // nothing to clear
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('undoWithoutApplying()', () => {
    it('should remove last entry without calling setValue', () => {
      const { mgr, setValueCalls } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      const result = mgr.undoWithoutApplying();
      expect(result).toBe(true);
      expect(setValueCalls).toHaveLength(0);
      expect(mgr.canUndo()).toBe(false);
    });

    it('should return false when nothing to undo', () => {
      const { mgr } = makeManager();
      expect(mgr.undoWithoutApplying()).toBe(false);
    });

    it('should set lastOp to null', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('name', 'John', 'Jane'));
      mgr.undoWithoutApplying();
      expect(mgr.getLastOp()).toBeNull();
    });
  });

  describe('checkpoints', () => {
    it('should mark checkpoint at current past length', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 2, 3));
      mgr.markCheckpoint();
      expect(mgr.getState().checkpoints).toEqual([2]);
    });

    it('undoToLastCheckpoint should undo to marked position', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 2, 3));
      mgr.markCheckpoint(); // at position 2
      mgr.record(makeEntry('c', 3, 4));
      mgr.record(makeEntry('d', 4, 5));
      mgr.undoToLastCheckpoint(); // undo until past.length === 2
      expect(mgr.getState().past).toBe(2);
    });

    it('undoToLastCheckpoint should undo everything with no checkpoint', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 2, 3));
      const result = mgr.undoToLastCheckpoint();
      expect(result).toBe(true);
      expect(mgr.getState().past).toBe(0);
    });

    it('undoToLastCheckpoint returns false when nothing to undo', () => {
      const { mgr } = makeManager();
      const result = mgr.undoToLastCheckpoint();
      expect(result).toBe(false);
    });

    it('should use injected logger for debug messages', () => {
      const { mgr, logger } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.undoToLastCheckpoint(); // no checkpoint
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No checkpoint found')
      );
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should call listener on state changes', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.subscribe(listener);
      mgr.record(makeEntry('name', 'a', 'b'));
      expect(listener).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.record(makeEntry('name', 'a', 'b'));
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const { mgr } = makeManager();
      const l1 = jest.fn();
      const l2 = jest.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.record(makeEntry('name', 'a', 'b'));
      expect(l1).toHaveBeenCalled();
      expect(l2).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should reset all state', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.undo();
      mgr.markCheckpoint();
      mgr.clear();
      expect(mgr.getState()).toEqual({ past: 0, future: 0, checkpoints: [] });
      expect(mgr.getLastOp()).toBeNull();
    });

    it('should notify listeners on clear', () => {
      const { mgr } = makeManager();
      const listener = jest.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('canUndo / canRedo', () => {
    it('canUndo is true after record', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('x', 1, 2));
      expect(mgr.canUndo()).toBe(true);
    });

    it('canUndo is false after undo all', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('x', 1, 2));
      mgr.undo();
      expect(mgr.canUndo()).toBe(false);
    });

    it('canRedo is true after undo', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('x', 1, 2));
      mgr.undo();
      expect(mgr.canRedo()).toBe(true);
    });

    it('canRedo is false after redo all', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('x', 1, 2));
      mgr.undo();
      mgr.redo();
      expect(mgr.canRedo()).toBe(false);
    });
  });

  describe('getState()', () => {
    it('returns accurate counts', () => {
      const { mgr } = makeManager();
      mgr.record(makeEntry('a', 1, 2));
      mgr.record(makeEntry('b', 2, 3));
      mgr.undo();
      expect(mgr.getState()).toEqual({
        past: 1,
        future: 1,
        checkpoints: [],
      });
    });
  });

  describe('snapshot before mutate (nested fields)', () => {
    it('should build redo entry from pre-mutation snapshot for multi-field entries', () => {
      const values: Record<string, unknown> = { 'profile.firstName': 'Jane', 'profile.lastName': 'Doe' };
      const setValueCalls: Array<{ name: string; value: unknown }> = [];

      // setValue mutates values immediately (simulating React re-render)
      const setValue = (name: string, value: unknown) => {
        values[name] = value;
        setValueCalls.push({ name, value });
      };
      const getCurrentValues = () => ({ ...values });
      const mgr = new InternalUndoManager(setValue, getCurrentValues);

      // Record: changed both firstName and lastName
      mgr.record([
        { name: 'profile.firstName', prevValue: 'John', nextValue: 'Jane', rootField: 'profile' },
        { name: 'profile.lastName', prevValue: 'Smith', nextValue: 'Doe', rootField: 'profile' },
      ]);

      // Undo — should snapshot { firstName: 'Jane', lastName: 'Doe' } BEFORE applying
      mgr.undo();

      // After undo, values should be restored to prev
      expect(values['profile.firstName']).toBe('John');
      expect(values['profile.lastName']).toBe('Smith');

      // Now redo — should restore to 'Jane' and 'Doe' (the pre-undo snapshot)
      setValueCalls.length = 0;
      mgr.redo();

      const redoFirstName = setValueCalls.find(c => c.name === 'profile.firstName');
      const redoLastName = setValueCalls.find(c => c.name === 'profile.lastName');
      expect(redoFirstName?.value).toBe('Jane');
      expect(redoLastName?.value).toBe('Doe');
    });

    it('should preserve correct undo values after redo of multi-field entry', () => {
      const values: Record<string, unknown> = { a: 10, b: 20 };
      const setValueCalls: Array<{ name: string; value: unknown }> = [];

      const setValue = (name: string, value: unknown) => {
        values[name] = value;
        setValueCalls.push({ name, value });
      };
      const getCurrentValues = () => ({ ...values });
      const mgr = new InternalUndoManager(setValue, getCurrentValues);

      mgr.record([
        { name: 'a', prevValue: 1, nextValue: 10, rootField: 'a' },
        { name: 'b', prevValue: 2, nextValue: 20, rootField: 'b' },
      ]);

      // Undo: a→1, b→2
      mgr.undo();
      expect(values['a']).toBe(1);
      expect(values['b']).toBe(2);

      // Redo: a→10, b→20
      mgr.redo();
      expect(values['a']).toBe(10);
      expect(values['b']).toBe(20);

      // Undo again: should go back to a→1, b→2
      setValueCalls.length = 0;
      mgr.undo();
      expect(setValueCalls).toContainEqual({ name: 'a', value: 1 });
      expect(setValueCalls).toContainEqual({ name: 'b', value: 2 });
    });
  });
});
