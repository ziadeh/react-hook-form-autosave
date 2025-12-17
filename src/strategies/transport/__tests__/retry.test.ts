/**
 * Tests for retry transport strategy
 * Covers retry logic, backoff, and error handling
 */

import { withRetry, type RetryConfig } from '../retry';
import type { Transport, SaveResult, SavePayload, SaveContext } from '../../../core/types';
import { TransportError } from '../../../core/errors';

describe('withRetry', () => {
  let mockTransport: jest.MockedFunction<Transport>;
  let mockLogger: any;

  beforeEach(() => {
    mockTransport = jest.fn();
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful transport', () => {
    it('should return result on first successful attempt', async () => {
      const successResult: SaveResult = { ok: true };
      mockTransport.mockResolvedValue(successResult);

      const retryTransport = withRetry(mockTransport);
      const promise = retryTransport({ field: 'value' });

      const result = await promise;

      expect(result).toEqual(successResult);
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });

    it('should not log info on first successful attempt', async () => {
      mockTransport.mockResolvedValue({ ok: true });

      const retryTransport = withRetry(mockTransport, {}, mockLogger);
      await retryTransport({ field: 'value' });

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should pass payload and context to transport', async () => {
      mockTransport.mockResolvedValue({ ok: true });

      const payload: SavePayload = { name: 'test', value: 123 };
      const ctx: SaveContext = { timestamp: Date.now() };

      const retryTransport = withRetry(mockTransport);
      await retryTransport(payload, ctx);

      expect(mockTransport).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ timestamp: ctx.timestamp })
      );
    });
  });

  describe('retry behavior', () => {
    it('should retry on failed result', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport);
      const promise = retryTransport({ field: 'value' });

      // Advance past retry delay
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(mockTransport).toHaveBeenCalledTimes(2);
    });

    it('should retry on thrown error', async () => {
      mockTransport
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport);
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(mockTransport).toHaveBeenCalledTimes(2);
    });

    it('should retry up to maxRetries times', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 2 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      await promise;

      // 1 initial + 2 retries = 3 total attempts
      expect(mockTransport).toHaveBeenCalledTimes(3);
    });

    it('should log info on successful retry', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport, {}, mockLogger);
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      await promise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('succeeded after 1 retries')
      );
    });

    it('should log debug on each retry attempt', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport, {}, mockLogger);
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      await promise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('attempt 1 failed')
      );
    });
  });

  describe('backoff strategy', () => {
    it('should use exponential backoff', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const baseDelayMs = 100;
      const backoffFactor = 2;
      const retryTransport = withRetry(mockTransport, {
        maxRetries: 2,
        baseDelayMs,
        backoffFactor,
      });

      const promise = retryTransport({ field: 'value' });

      // Run all timers and let it complete
      await jest.runAllTimersAsync();
      await promise;

      // Should have made 3 attempts total (initial + 2 retries)
      expect(mockTransport).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelayMs', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        backoffFactor: 10,
      });

      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();
      await promise;

      // Should have used delays: 1000, 2000 (capped), 2000 (capped)
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('10000ms')
      );
    });

    it('should use custom baseDelayMs', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport, { baseDelayMs: 500 }, mockLogger);
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('500ms')
      );
    });
  });

  describe('abort handling', () => {
    it('should stop retrying when aborted', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const abortController = new AbortController();
      const retryTransport = withRetry(mockTransport, { maxRetries: 5 });

      const promise = retryTransport({ field: 'value' }, { signal: abortController.signal });

      // Wait for first attempt
      await Promise.resolve();

      // Abort before first retry
      abortController.abort();
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual({
        ok: false,
        error: expect.any(TransportError),
      });
      expect(result.ok === false && result.error.message).toBe('Operation aborted');
      // Should have stopped after detecting abort
      expect(mockTransport).toHaveBeenCalled();
      expect(mockTransport.mock.calls.length).toBeLessThan(5);
    });

    it('should check abort signal between retries', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const abortController = new AbortController();
      const retryTransport = withRetry(mockTransport, { maxRetries: 3 });

      const promise = retryTransport({ field: 'value' }, { signal: abortController.signal });

      // First attempt
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Abort after first retry
      abortController.abort();
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.ok).toBe(false);
      expect(mockTransport).toHaveBeenCalledTimes(2);
    });
  });

  describe('final error handling', () => {
    it('should return TransportError after all retries fail', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Persistent failure') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 2 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual({
        ok: false,
        error: expect.any(TransportError),
      });
      expect(result.ok === false && result.error.message).toContain(
        'failed after 3 attempts'
      );
    });

    it('should include original error in TransportError', async () => {
      const originalError = new Error('Original failure');
      mockTransport.mockResolvedValue({ ok: false, error: originalError });

      const retryTransport = withRetry(mockTransport, { maxRetries: 1 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockTransport.mockRejectedValue('String error');

      const retryTransport = withRetry(mockTransport, { maxRetries: 0 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
      }
    });
  });

  describe('retry count tracking', () => {
    it('should track retry count in context', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 2 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockTransport).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ retryCount: 0 })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ retryCount: 1 })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        expect.objectContaining({ retryCount: 2 })
      );
    });

    it('should add to existing retry count', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport);
      const promise = retryTransport({ field: 'value' }, { retryCount: 5 });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockTransport).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ retryCount: 5 })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ retryCount: 6 })
      );
    });
  });

  describe('default configuration', () => {
    it('should use default maxRetries of 3', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport);
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockTransport).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });

    it('should accept partial config', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 1 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockTransport).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero maxRetries', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 0 });
      const result = await retryTransport({ field: 'value' });

      expect(result.ok).toBe(false);
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });

    it('should handle immediate success after failures', async () => {
      mockTransport
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed 1') })
        .mockResolvedValueOnce({ ok: false, error: new Error('Failed 2') })
        .mockResolvedValueOnce({ ok: true });

      const retryTransport = withRetry(mockTransport, { maxRetries: 3 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(mockTransport).toHaveBeenCalledTimes(3);
    });

    it('should work without logger', async () => {
      mockTransport.mockResolvedValue({ ok: false, error: new Error('Failed') });

      const retryTransport = withRetry(mockTransport, { maxRetries: 1 });
      const promise = retryTransport({ field: 'value' });

      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBeDefined();
    });
  });
});
