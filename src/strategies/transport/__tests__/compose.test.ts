/**
 * Tests for transport composition strategies
 * Covers composeTransports and parallelTransports
 */

import { composeTransports, parallelTransports } from '../compose';
import type { Transport, SavePayload, SaveContext, SaveResult } from '../../../core/types';

describe('composeTransports', () => {
  describe('basic composition', () => {
    it('should execute single transport', async () => {
      const transport = jest.fn().mockResolvedValue({ ok: true });
      const composed = composeTransports(transport);

      const result = await composed({ field: 'value' });

      expect(result).toEqual({ ok: true });
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple transports in order', async () => {
      const executionOrder: number[] = [];
      const transport1 = jest.fn().mockImplementation(async () => {
        executionOrder.push(1);
        return { ok: true };
      });
      const transport2 = jest.fn().mockImplementation(async () => {
        executionOrder.push(2);
        return { ok: true };
      });
      const transport3 = jest.fn().mockImplementation(async () => {
        executionOrder.push(3);
        return { ok: true };
      });

      const composed = composeTransports(transport1, transport2, transport3);
      await composed({ field: 'value' });

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should pass payload to all transports', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });

      const payload: SavePayload = { name: 'test', value: 123 };
      const composed = composeTransports(transport1, transport2);

      await composed(payload);

      expect(transport1).toHaveBeenCalledWith(payload, undefined);
      expect(transport2).toHaveBeenCalledWith(payload, undefined);
    });

    it('should pass context to all transports', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });

      const payload: SavePayload = { field: 'value' };
      const ctx: SaveContext = { timestamp: Date.now(), retryCount: 1 };
      const composed = composeTransports(transport1, transport2);

      await composed(payload, ctx);

      expect(transport1).toHaveBeenCalledWith(payload, ctx);
      expect(transport2).toHaveBeenCalledWith(payload, ctx);
    });
  });

  describe('error handling', () => {
    it('should throw error when no transports provided', () => {
      expect(() => composeTransports()).toThrow('At least one transport is required');
    });

    it('should stop execution on first failure', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Failed'),
      });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const composed = composeTransports(transport1, transport2, transport3);
      const result = await composed({ field: 'value' });

      expect(result).toEqual({
        ok: false,
        error: expect.any(Error),
      });
      expect(transport1).toHaveBeenCalledTimes(1);
      expect(transport2).toHaveBeenCalledTimes(1);
      expect(transport3).not.toHaveBeenCalled();
    });

    it('should return first failure result', async () => {
      const error = new Error('Transport failed');
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error,
        code: 'TRANSPORT_ERROR',
      });

      const composed = composeTransports(transport1, transport2);
      const result = await composed({ field: 'value' });

      expect(result).toEqual({
        ok: false,
        error,
        code: 'TRANSPORT_ERROR',
      });
    });

    it('should handle first transport failure', async () => {
      const transport1 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('First failed'),
      });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });

      const composed = composeTransports(transport1, transport2);
      const result = await composed({ field: 'value' });

      expect(result.ok).toBe(false);
      expect(transport2).not.toHaveBeenCalled();
    });
  });

  describe('success scenarios', () => {
    it('should return success when all transports succeed', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true, version: '1' });
      const transport2 = jest.fn().mockResolvedValue({ ok: true, version: '2' });
      const transport3 = jest.fn().mockResolvedValue({ ok: true, version: '3' });

      const composed = composeTransports(transport1, transport2, transport3);
      const result = await composed({ field: 'value' });

      expect(result).toEqual({ ok: true });
    });

    it('should execute all transports when all succeed', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const composed = composeTransports(transport1, transport2, transport3);
      await composed({ field: 'value' });

      expect(transport1).toHaveBeenCalledTimes(1);
      expect(transport2).toHaveBeenCalledTimes(1);
      expect(transport3).toHaveBeenCalledTimes(1);
    });
  });

  describe('optimization', () => {
    it('should return single transport directly when only one provided', () => {
      const transport = jest.fn().mockResolvedValue({ ok: true });
      const composed = composeTransports(transport);

      expect(composed).toBe(transport);
    });
  });
});

describe('parallelTransports', () => {
  describe('parallel execution', () => {
    it('should execute all transports in parallel', async () => {
      const delays: number[] = [];
      const createDelayedTransport = (id: number, delayMs: number): Transport => {
        return jest.fn().mockImplementation(async () => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delays.push(Date.now() - start);
          return { ok: true };
        });
      };

      const transport1 = createDelayedTransport(1, 100);
      const transport2 = createDelayedTransport(2, 50);
      const transport3 = createDelayedTransport(3, 75);

      const parallel = parallelTransports(transport1, transport2, transport3);
      await parallel({ field: 'value' });

      // All should have been called
      expect(transport1).toHaveBeenCalled();
      expect(transport2).toHaveBeenCalled();
      expect(transport3).toHaveBeenCalled();
    });

    it('should pass payload to all transports', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const payload: SavePayload = { name: 'test', value: 123 };
      const parallel = parallelTransports(transport1, transport2, transport3);

      await parallel(payload);

      expect(transport1).toHaveBeenCalledWith(payload, undefined);
      expect(transport2).toHaveBeenCalledWith(payload, undefined);
      expect(transport3).toHaveBeenCalledWith(payload, undefined);
    });

    it('should pass context to all transports', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });

      const payload: SavePayload = { field: 'value' };
      const ctx: SaveContext = { timestamp: Date.now() };
      const parallel = parallelTransports(transport1, transport2);

      await parallel(payload, ctx);

      expect(transport1).toHaveBeenCalledWith(payload, ctx);
      expect(transport2).toHaveBeenCalledWith(payload, ctx);
    });
  });

  describe('success scenarios', () => {
    it('should return success when all transports succeed', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({ ok: true });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const parallel = parallelTransports(transport1, transport2, transport3);
      const result = await parallel({ field: 'value' });

      expect(result).toEqual({ ok: true });
    });

    it('should execute all transports even if one is slow', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { ok: true };
      });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const parallel = parallelTransports(transport1, transport2, transport3);
      await parallel({ field: 'value' });

      expect(transport1).toHaveBeenCalledTimes(1);
      expect(transport2).toHaveBeenCalledTimes(1);
      expect(transport3).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should continue executing all transports even if one fails', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Failed'),
      });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const parallel = parallelTransports(transport1, transport2, transport3);
      await parallel({ field: 'value' });

      expect(transport1).toHaveBeenCalledTimes(1);
      expect(transport2).toHaveBeenCalledTimes(1);
      expect(transport3).toHaveBeenCalledTimes(1);
    });

    it('should return error when any transport fails', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Transport 2 failed'),
      });
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const parallel = parallelTransports(transport1, transport2, transport3);
      const result = await parallel({ field: 'value' });

      expect(result).toEqual({
        ok: false,
        error: expect.any(Error),
      });
      expect(result.ok === false && result.error.message).toContain('1 transports failed');
    });

    it('should include all failure messages', async () => {
      const transport1 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Error 1'),
      });
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Error 2'),
      });
      const transport3 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Error 3'),
      });

      const parallel = parallelTransports(transport1, transport2, transport3);
      const result = await parallel({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('3 transports failed');
        expect(result.error.message).toContain('Error 1');
        expect(result.error.message).toContain('Error 2');
        expect(result.error.message).toContain('Error 3');
      }
    });

    it('should handle rejected promises', async () => {
      const transport1 = jest.fn().mockResolvedValue({ ok: true });
      const transport2 = jest.fn().mockRejectedValue(new Error('Rejected'));
      const transport3 = jest.fn().mockResolvedValue({ ok: true });

      const parallel = parallelTransports(transport1, transport2, transport3);
      const result = await parallel({ field: 'value' });

      expect(result).toEqual({
        ok: false,
        error: expect.any(Error),
      });
      expect(result.ok === false && result.error.message).toContain('1 transports failed');
      expect(result.ok === false && result.error.message).toContain('Rejected');
    });

    it('should handle multiple rejections and failures', async () => {
      const transport1 = jest.fn().mockRejectedValue(new Error('Rejected 1'));
      const transport2 = jest.fn().mockResolvedValue({
        ok: false,
        error: new Error('Failed 2'),
      });
      const transport3 = jest.fn().mockRejectedValue(new Error('Rejected 3'));

      const parallel = parallelTransports(transport1, transport2, transport3);
      const result = await parallel({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('3 transports failed');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty transports array', async () => {
      const parallel = parallelTransports();
      const result = await parallel({ field: 'value' });

      expect(result).toEqual({ ok: true });
    });

    it('should handle single transport', async () => {
      const transport = jest.fn().mockResolvedValue({ ok: true });
      const parallel = parallelTransports(transport);

      const result = await parallel({ field: 'value' });

      expect(result).toEqual({ ok: true });
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it('should not fail-fast', async () => {
      let transport2Called = false;
      const transport1 = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Failed early');
      });
      const transport2 = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        transport2Called = true;
        return { ok: true };
      });

      const parallel = parallelTransports(transport1, transport2);
      await parallel({ field: 'value' });

      expect(transport2Called).toBe(true);
    });
  });
});
