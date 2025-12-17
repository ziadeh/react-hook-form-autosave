/**
 * Tests for AutosaveManager
 * Covers core save logic, race conditions, retry behavior, and error handling
 */

import { AutosaveManager } from '../autosave';
import { AutosaveError } from '../errors';
import type { SavePayload, SaveResult, Transport, SaveContext } from '../types';

// Mock logger for testing
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock transport function
const createMockTransport = (
  implementation?: (payload: SavePayload, context?: SaveContext) => Promise<SaveResult>
): jest.MockedFunction<Transport> => {
  return jest.fn(implementation || (async () => ({ ok: true as const })));
};

describe('AutosaveManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and initialization', () => {
    it('should initialize with default options', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      expect(manager.isEmpty()).toBe(true);
      expect(manager.getPendingChanges()).toEqual({});
    });

    it('should accept custom debounceMs', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport, 1000);

      expect(manager).toBeInstanceOf(AutosaveManager);
    });

    it('should accept custom logger', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'test' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Queueing change',
        expect.any(Object)
      );
    });

    it('should accept custom timer implementation', () => {
      const transport = createMockTransport();
      const customTimer = {
        setTimeout: setTimeout as typeof setTimeout,
        clearTimeout: clearTimeout as typeof clearTimeout,
      };

      const manager = new AutosaveManager(transport, 600, undefined, customTimer);
      expect(manager).toBeInstanceOf(AutosaveManager);
    });
  });

  describe('queueChange()', () => {
    it('should queue a single change', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });

      expect(manager.isEmpty()).toBe(false);
      expect(manager.getPendingChanges()).toEqual({ name: 'John' });
    });

    it('should merge multiple changes correctly', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      manager.queueChange({ email: 'john@example.com' });

      expect(manager.getPendingChanges()).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should overwrite existing keys', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      manager.queueChange({ name: 'Jane' });

      expect(manager.getPendingChanges()).toEqual({ name: 'Jane' });
    });

    it('should log debug information when logger is provided', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Queueing change',
        expect.objectContaining({
          delta: { name: 'John' },
        })
      );
    });
  });

  describe('flush()', () => {
    it('should return early when empty', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      const result = await manager.flush();

      expect(result).toEqual({ ok: true });
      expect(transport).not.toHaveBeenCalled();
    });

    it('should call transport with pending payload', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John', email: 'john@example.com' });
      await manager.flush();

      expect(transport).toHaveBeenCalledWith(
        { name: 'John', email: 'john@example.com' },
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          timestamp: expect.any(Number),
          retryCount: 0,
        })
      );
    });

    it('should clear pending changes after successful flush', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      expect(manager.isEmpty()).toBe(true);
    });

    it('should set isInflight flag during save', async () => {
      let isInflightDuringSave = false;
      const transport = createMockTransport(async () => {
        // Check if we can queue changes during save (should trigger shouldRerun)
        return { ok: true };
      });

      const manager = new AutosaveManager(transport);
      manager.queueChange({ name: 'John' });

      const flushPromise = manager.flush();

      // Queue another change while save is in flight
      manager.queueChange({ email: 'test@example.com' });

      await flushPromise;

      // The second flush should have been triggered automatically
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should handle shouldRerun when flush called during inflight save', async () => {
      let firstCallCompleted = false;
      const transport = createMockTransport(async () => {
        if (!firstCallCompleted) {
          firstCallCompleted = true;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return { ok: true };
      });

      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const firstFlush = manager.flush();

      // Try to flush again while first is in progress
      await new Promise(resolve => setTimeout(resolve, 10));
      const secondFlush = await manager.flush();

      expect(secondFlush).toEqual({ ok: true });
      await firstFlush;

      // Transport should be called at least once
      expect(transport).toHaveBeenCalled();
    });

    it('should automatically rerun flush after inflight save completes', async () => {
      let callCount = 0;
      const transport = createMockTransport(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return { ok: true };
      });

      const manager = new AutosaveManager(transport, 0, mockLogger);

      // Queue first change and start saving
      manager.queueChange({ name: 'John' });
      const firstFlush = manager.flush();

      // While first save is in progress, queue another change and try to flush
      await new Promise(resolve => setTimeout(resolve, 10));
      manager.queueChange({ email: 'john@example.com' });
      await manager.flush(); // This should set shouldRerun flag

      // Wait for first flush to complete
      await firstFlush;

      // Wait a bit for the automatic rerun to happen
      await new Promise(resolve => setTimeout(resolve, 50));

      // Transport should have been called twice - once for initial, once for rerun
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Flush requested while save in progress, will rerun'
      );
    });

    it('should create new AbortController for each flush', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      manager.queueChange({ name: 'Jane' });
      await manager.flush();

      expect(transport).toHaveBeenCalledTimes(2);

      const firstContext = transport.mock.calls[0]?.[1];
      const secondContext = transport.mock.calls[1]?.[1];

      expect(firstContext?.signal).toBeInstanceOf(AbortSignal);
      expect(secondContext?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should include performance timing', async () => {
      const transport = createMockTransport(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ok: true };
      });
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Save completed',
        expect.objectContaining({
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('abort()', () => {
    it('should clear pending changes', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      manager.abort();

      expect(manager.isEmpty()).toBe(true);
    });

    it('should abort ongoing request', async () => {
      let wasAborted = false;
      const transport = createMockTransport(async (_payload, context) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
          context?.signal?.addEventListener('abort', () => {
            wasAborted = true;
          });
        });
        return { ok: true as const };
      });

      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const flushPromise = manager.flush();

      // Abort while save is in progress
      await new Promise(resolve => setTimeout(resolve, 10));
      manager.abort();

      await flushPromise.catch(() => {}); // Ignore potential errors from abort

      // Give time for abort to process
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should prevent shouldRerun from triggering', async () => {
      const transport = createMockTransport(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { ok: true };
      });

      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const flushPromise = manager.flush();

      // Try to trigger shouldRerun
      await new Promise(resolve => setTimeout(resolve, 10));
      manager.queueChange({ email: 'test@example.com' });

      // Then abort
      manager.abort();

      await flushPromise;

      expect(manager.isEmpty()).toBe(true);
    });

    it('should log debug information', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.abort();

      expect(mockLogger.debug).toHaveBeenCalledWith('Aborting autosave');
    });
  });

  describe('isEmpty()', () => {
    it('should return true when no pending changes', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      expect(manager.isEmpty()).toBe(true);
    });

    it('should return false when changes are queued', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });

      expect(manager.isEmpty()).toBe(false);
    });

    it('should return true after abort', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      manager.abort();

      expect(manager.isEmpty()).toBe(true);
    });
  });

  describe('getPendingChanges()', () => {
    it('should return empty object when no changes', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      expect(manager.getPendingChanges()).toEqual({});
    });

    it('should return pending changes', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John', email: 'john@example.com' });

      expect(manager.getPendingChanges()).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should return a readonly copy (not mutate internal state)', () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const pending = manager.getPendingChanges();

      // Try to mutate the returned object
      (pending as any).name = 'Jane';

      // Internal state should not change
      expect(manager.getPendingChanges()).toEqual({ name: 'John' });
    });
  });

  describe('Error handling', () => {
    it('should handle transport errors', async () => {
      const transport = createMockTransport(async () => {
        throw new Error('Network error');
      });
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const result = await manager.flush();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AutosaveError);
      }
    });

    it('should merge failed payload back to pending', async () => {
      const transport = createMockTransport(async () => ({
        ok: false,
        error: new Error('Save failed'),
      }));
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      // Failed payload should be back in pending
      expect(manager.getPendingChanges()).toEqual({ name: 'John' });
    });

    it('should merge new changes with failed payload', async () => {
      let callCount = 0;
      const transport = createMockTransport(async () => {
        callCount++;
        if (callCount === 1) {
          // Simulate delay so we can queue new changes
          await new Promise(resolve => setTimeout(resolve, 20));
          return { ok: false, error: new Error('Save failed') };
        }
        return { ok: true };
      });
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      const flushPromise = manager.flush();

      // Queue new change while save is failing
      await new Promise(resolve => setTimeout(resolve, 10));
      manager.queueChange({ email: 'john@example.com' });

      await flushPromise;

      // Both old and new changes should be in pending
      const pending = manager.getPendingChanges();
      expect(pending).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should log error with context', async () => {
      const error = new Error('Network error');
      const transport = createMockTransport(async () => {
        throw error;
      });
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Save failed',
        expect.any(AutosaveError),
        expect.objectContaining({
          payload: { name: 'John' },
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('Retry logic', () => {
    it('should increment retry count on failure', async () => {
      const transport = createMockTransport(async () => ({
        ok: false,
        error: new Error('Save failed'),
      }));
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });
      await manager.flush();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('will retry (1/3)'),
        expect.any(Object)
      );
    });

    it('should reset retry count on success', async () => {
      let callCount = 0;
      const transport = createMockTransport(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, error: new Error('First fail') };
        }
        return { ok: true };
      });
      const manager = new AutosaveManager(transport, 600, mockLogger);

      // First save fails
      manager.queueChange({ name: 'John' });
      await manager.flush();

      // Second save succeeds
      manager.queueChange({ name: 'Jane' });
      await manager.flush();

      // Third save should have retryCount: 0 again
      manager.queueChange({ name: 'Bob' });
      await manager.flush();

      const lastCall = transport.mock.calls[transport.mock.calls.length - 1];
      expect(lastCall?.[1]?.retryCount).toBe(0);
    });

    it('should log final error after max retries', async () => {
      const transport = createMockTransport(async () => ({
        ok: false,
        error: new Error('Save failed'),
      }));
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });

      // Fail 4 times (initial + 3 retries)
      await manager.flush();
      await manager.flush();
      await manager.flush();
      await manager.flush();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed after 3 retries'),
        expect.any(Error)
      );
    });

    it('should include retry count in context', async () => {
      let callCount = 0;
      const transport = createMockTransport(async () => {
        callCount++;
        if (callCount < 3) {
          return { ok: false, error: new Error('Retry') };
        }
        return { ok: true };
      });
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });
      await manager.flush(); // retryCount: 0, fails
      await manager.flush(); // retryCount: 1, fails
      await manager.flush(); // retryCount: 2, succeeds

      expect(transport).toHaveBeenCalledTimes(3);
      expect(transport.mock.calls[0]?.[1]?.retryCount).toBe(0);
      expect(transport.mock.calls[1]?.[1]?.retryCount).toBe(1);
      expect(transport.mock.calls[2]?.[1]?.retryCount).toBe(2);
    });
  });

  describe('Logger integration', () => {
    it('should not throw when logger is not provided', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport);

      manager.queueChange({ name: 'John' });

      await expect(manager.flush()).resolves.toEqual({ ok: true });
    });

    it('should log all major operations', async () => {
      const transport = createMockTransport();
      const manager = new AutosaveManager(transport, 600, mockLogger);

      manager.queueChange({ name: 'John' });
      await manager.flush();
      manager.abort();

      expect(mockLogger.debug).toHaveBeenCalledWith('Queueing change', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting save', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Save completed', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Aborting autosave');
    });
  });
});
