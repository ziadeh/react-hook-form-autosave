/**
 * Tests for createComposedTransport
 * Covers basic transport, keyMap, mapPayload, dispatch, updateBaseline, onSaved, metrics
 */

import { createComposedTransport } from '../composeTransport';
import { createMockTransport } from '../../../../testing/testUtils';

describe('createComposedTransport', () => {
  describe('basic transport', () => {
    it('should call baseTransport with payload', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const composed = createComposedTransport({ baseTransport: mockTransport });

      const result = await composed({ name: 'John' });

      expect(result.ok).toBe(true);
      expect(mockTransport.getCalls()).toHaveLength(1);
      expect(mockTransport.getCalls()[0]).toEqual({ name: 'John' });
    });

    it('should return transport result on success', async () => {
      const mockTransport = createMockTransport([{ ok: true, version: '1.0' }]);
      const composed = createComposedTransport({ baseTransport: mockTransport });

      const result = await composed({ name: 'John' });

      expect(result.ok).toBe(true);
    });

    it('should return transport result on failure', async () => {
      const error = new Error('Network error');
      const mockTransport = createMockTransport([{ ok: false, error }]);
      const composed = createComposedTransport({ baseTransport: mockTransport });

      const result = await composed({ name: 'John' });

      expect(result.ok).toBe(false);
    });

    it('should dispatch SAVE_START at beginning', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const dispatch = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        dispatch,
      });

      await composed({ name: 'John' });

      expect(dispatch).toHaveBeenCalledWith({ type: 'SAVE_START' });
    });

    it('should dispatch SAVE_SUCCESS on success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const dispatch = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        dispatch,
      });

      await composed({ name: 'John' });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SAVE_SUCCESS' })
      );
    });

    it('should dispatch SAVE_ERROR on failure', async () => {
      const error = new Error('fail');
      const mockTransport = createMockTransport([{ ok: false, error }]);
      const dispatch = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        dispatch,
      });

      await composed({ name: 'John' });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SAVE_ERROR' })
      );
    });

    it('should not call transport when payload is empty after filtering', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const composed = createComposedTransport({ baseTransport: mockTransport });

      // Empty payload
      const result = await composed({});

      expect(result.ok).toBe(true);
      // Transport should not be called for empty payload
      expect(mockTransport.getCalls()).toHaveLength(0);
    });
  });

  describe('keyMap transformation', () => {
    it('should rename keys according to keyMap', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        keyMap: { name: 'full_name', email: 'email_address' },
      });

      await composed({ name: 'John', email: 'j@test.com' });

      const call = mockTransport.getCalls()[0];
      expect(call).toHaveProperty('full_name', 'John');
      expect(call).toHaveProperty('email_address', 'j@test.com');
      expect(call).not.toHaveProperty('name');
    });

    it('should pass unknown keys through unchanged', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        keyMap: { name: 'full_name' },
      });

      await composed({ name: 'John', age: 30 });

      const call = mockTransport.getCalls()[0];
      expect(call).toHaveProperty('full_name', 'John');
      expect(call).toHaveProperty('age', 30);
    });
  });

  describe('mapPayload', () => {
    it('should apply mapPayload transformation', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const mapPayload = jest.fn((p: Record<string, any>) => ({
        ...p,
        _source: 'autosave',
      }));
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        mapPayload,
      });

      await composed({ name: 'John' });

      expect(mapPayload).toHaveBeenCalledWith(expect.objectContaining({ name: 'John' }));
      expect(mockTransport.getCalls()[0]).toHaveProperty('_source', 'autosave');
    });
  });

  describe('onSaved callback', () => {
    it('should call onSaved with result and payload on success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const onSaved = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        onSaved,
      });

      const payload = { name: 'John' };
      await composed(payload);

      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true }),
        payload
      );
    });

    it('should call onSaved with result on failure', async () => {
      const error = new Error('fail');
      const mockTransport = createMockTransport([{ ok: false, error }]);
      const onSaved = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        onSaved,
      });

      await composed({ name: 'John' });

      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ ok: false }),
        expect.any(Object)
      );
    });
  });

  describe('updateBaseline', () => {
    it('should call updateBaseline with payload on success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const updateBaseline = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        updateBaseline,
      });

      await composed({ name: 'John' });

      expect(updateBaseline).toHaveBeenCalledWith(expect.objectContaining({ name: 'John' }));
    });

    it('should NOT call updateBaseline on failure', async () => {
      const error = new Error('fail');
      const mockTransport = createMockTransport([{ ok: false, error }]);
      const updateBaseline = jest.fn();
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        updateBaseline,
      });

      await composed({ name: 'John' });

      expect(updateBaseline).not.toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('should call metrics.recordSave on success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const metrics = { recordSave: jest.fn(), recordRetry: jest.fn(), recordCacheHit: jest.fn(), recordCacheMiss: jest.fn(), recordDebounce: jest.fn() };
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        metrics,
      });

      await composed({ name: 'John' });

      expect(metrics.recordSave).toHaveBeenCalledWith(expect.any(Number), true);
    });

    it('should call metrics.recordSave with false on failure', async () => {
      const error = new Error('fail');
      const mockTransport = createMockTransport([{ ok: false, error }]);
      const metrics = { recordSave: jest.fn(), recordRetry: jest.fn(), recordCacheHit: jest.fn(), recordCacheMiss: jest.fn(), recordDebounce: jest.fn() };
      const composed = createComposedTransport({
        baseTransport: mockTransport,
        metrics,
      });

      await composed({ name: 'John' });

      expect(metrics.recordSave).toHaveBeenCalledWith(expect.any(Number), false);
    });
  });

  describe('date serialization', () => {
    it('should convert Date objects to ISO strings in payload', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const composed = createComposedTransport({ baseTransport: mockTransport });

      const date = new Date('2025-01-15T12:00:00Z');
      await composed({ createdAt: date });

      const call = mockTransport.getCalls()[0];
      expect(typeof call.createdAt).toBe('string');
      expect(call.createdAt).toContain('2025-01-15');
    });
  });

  describe('updateLastSavedState and form.reset', () => {
    it('should call updateLastSavedState and form.reset on success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const updateLastSavedState = jest.fn();
      const formMock = {
        getValues: jest.fn((field?: any) => field ? 'value' : { name: 'John' }),
        reset: jest.fn(),
        setValue: jest.fn(),
      };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        updateLastSavedState,
        form: formMock,
      });

      await composed({ name: 'John' });

      expect(updateLastSavedState).toHaveBeenCalled();
      expect(formMock.reset).toHaveBeenCalled();
    });

    it('should mark undo checkpoint after successful save when undoEnabled', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const markCheckpoint = jest.fn();
      const undoMgrRef = { current: { markCheckpoint, getState: () => ({ past: 1, future: 0, checkpoints: [] }) } };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        undoEnabled: true,
        undoMgrRef,
      });

      await composed({ name: 'John' });

      expect(markCheckpoint).toHaveBeenCalled();
    });

    it('should clear undoAffectedFields after success', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const undoAffectedFieldsRef = { current: new Set(['name']) };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        undoAffectedFieldsRef,
      });

      await composed({ name: 'John' });

      expect(undoAffectedFieldsRef.current.size).toBe(0);
    });
  });

  describe('undo/redo context', () => {
    it('should clear lastOpRef after successful save', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const lastOpRef = { current: 'undo' };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        lastOpRef,
      });

      await composed({ name: 'John' });

      expect(lastOpRef.current).toBeNull();
    });
  });

  describe('transport exception handling', () => {
    it('should handle transport exception gracefully', async () => {
      const throwingTransport = jest.fn().mockRejectedValue(new Error('Network crash'));
      const dispatch = jest.fn();

      const composed = createComposedTransport({
        baseTransport: throwingTransport,
        dispatch,
      });

      const result = await composed({ name: 'John' });

      expect(result.ok).toBe(false);
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SAVE_ERROR' }));
    });
  });

  describe('diffMap handling', () => {
    it('should call diffMap handler.onAdd for new items', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const onAdd = jest.fn().mockResolvedValue(undefined);
      const onRemove = jest.fn().mockResolvedValue(undefined);
      const diffMap = {
        tags: {
          idOf: (item: any) => item.id,
          onAdd,
          onRemove,
        },
      };

      const baseline = { tags: [{ id: 1, name: 'old' }] };
      const baselineRef = { current: baseline };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        diffMap,
        baselineRef,
      });

      // Payload has a new tag added
      await composed({ tags: [{ id: 1, name: 'old' }, { id: 2, name: 'new' }] });

      expect(onAdd).toHaveBeenCalledWith({ id: 2, name: 'new' });
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('should call diffMap handler.onRemove for removed items', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const onAdd = jest.fn().mockResolvedValue(undefined);
      const onRemove = jest.fn().mockResolvedValue(undefined);
      const diffMap = {
        tags: {
          idOf: (item: any) => item.id,
          onAdd,
          onRemove,
        },
      };

      const baseline = { tags: [{ id: 1, name: 'old' }, { id: 2, name: 'to-remove' }] };
      const baselineRef = { current: baseline };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        diffMap,
        baselineRef,
      });

      // Payload has tag 2 removed
      await composed({ tags: [{ id: 1, name: 'old' }] });

      expect(onRemove).toHaveBeenCalledWith({ id: 2, name: 'to-remove' });
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('should handle diffMap onAdd error gracefully', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const onAdd = jest.fn().mockRejectedValue(new Error('add failed'));
      const onRemove = jest.fn().mockResolvedValue(undefined);
      const diffMap = {
        tags: {
          idOf: (item: any) => item.id,
          onAdd,
          onRemove,
        },
      };

      const baseline = { tags: [] };
      const baselineRef = { current: baseline };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        diffMap,
        baselineRef,
      });

      // Add should fail
      const result = await composed({ tags: [{ id: 1, name: 'new' }] });

      expect(result.ok).toBe(false);
    });

    it('should trigger revert on diffMap failure with form provided', async () => {
      jest.useFakeTimers();
      const mockTransport = createMockTransport([{ ok: true }]);
      const onAdd = jest.fn().mockRejectedValue(new Error('add failed'));
      const onRemove = jest.fn().mockResolvedValue(undefined);
      const diffMap = {
        tags: {
          idOf: (item: any) => item.id,
          onAdd,
          onRemove,
        },
      };

      const baseline = { tags: [] };
      const baselineRef = { current: { ...baseline } };
      const lastOpRef = { current: null as string | null };
      const isHydratingRef = { current: false };
      const updateBaseline = jest.fn();
      const updateLastSavedState = jest.fn();

      const formMock = {
        getValues: jest.fn((field?: any) => field ? [{ id: 1 }] : { tags: [{ id: 1 }] }),
        setValue: jest.fn(),
        reset: jest.fn(),
      };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        diffMap,
        baselineRef,
        form: formMock,
        lastOpRef,
        isHydratingRef,
        clearDebounceTimeout: jest.fn(),
        updateBaseline,
        updateLastSavedState,
      });

      const result = await composed({ tags: [{ id: 1, name: 'new' }] });

      expect(result.ok).toBe(false);
      expect(lastOpRef.current).toBe('revert');
      expect(isHydratingRef.current).toBe(true);

      // The revert path sets values back to baseline
      expect(formMock.setValue).toHaveBeenCalled();

      // Advance timers to clear revert flags
      jest.advanceTimersByTime(200);
      expect(lastOpRef.current).toBeNull();
      expect(isHydratingRef.current).toBe(false);

      jest.useRealTimers();
    });

    it('should call updateLastSavedState during revert with form provided', async () => {
      const mockTransport = createMockTransport([{ ok: true }]);
      const onAdd = jest.fn().mockRejectedValue(new Error('add failed'));
      const diffMap = {
        tags: { idOf: (item: any) => item.id, onAdd, onRemove: jest.fn().mockResolvedValue(undefined) },
      };
      const baselineRef = { current: { tags: [] } };
      const updateLastSavedState = jest.fn();
      const formMock = {
        getValues: jest.fn((f?: any) => f ? [] : { tags: [] }),
        setValue: jest.fn(),
        reset: jest.fn(),
      };

      const composed = createComposedTransport({
        baseTransport: mockTransport,
        diffMap,
        baselineRef,
        form: formMock,
        updateLastSavedState,
      });

      await composed({ tags: [{ id: 1 }] });

      expect(updateLastSavedState).toHaveBeenCalled();
    });
  });
});
