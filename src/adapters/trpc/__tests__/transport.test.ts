/**
 * Tests for tRPC transport adapter
 * Covers trpcTransport wrapper functionality
 */

import { trpcTransport } from '../transport';
import type { SavePayload, SaveContext } from '../../../core/types';

describe('trpcTransport', () => {
  describe('successful mutations', () => {
    it('should wrap tRPC mutation and return success result', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({ version: 'v1' }),
      };

      const transport = trpcTransport(mockMutation);
      const payload: SavePayload = { name: 'test', value: 123 };
      const result = await transport(payload);

      expect(result).toEqual({
        ok: true,
        version: 'v1',
      });
      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(payload, {
        signal: undefined,
      });
    });

    it('should pass payload to mutation', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const payload: SavePayload = { field1: 'value1', field2: 'value2' };
      await transport(payload);

      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(payload, expect.any(Object));
    });

    it('should handle mutation without version in response', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({ data: 'some data' }),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result).toEqual({
        ok: true,
        version: undefined,
      });
    });

    it('should extract version from response', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({ version: '2.0', data: 'test' }),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result).toEqual({
        ok: true,
        version: '2.0',
      });
    });

    it('should handle empty response', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue(undefined),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(true);
    });
  });

  describe('context handling', () => {
    it('should pass abort signal to mutation', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const abortController = new AbortController();
      const ctx: SaveContext = { signal: abortController.signal };
      
      await transport({ field: 'value' }, ctx);

      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(
        { field: 'value' },
        { signal: abortController.signal }
      );
    });

    it('should work without context', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      await transport({ field: 'value' });

      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(
        { field: 'value' },
        { signal: undefined }
      );
    });

    it('should pass undefined signal when context has no signal', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const ctx: SaveContext = { timestamp: Date.now() };
      
      await transport({ field: 'value' }, ctx);

      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(
        { field: 'value' },
        { signal: undefined }
      );
    });

    it('should handle aborted signal', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(new Error('Operation aborted')),
      };

      const transport = trpcTransport(mockMutation);
      const abortController = new AbortController();
      abortController.abort();
      const ctx: SaveContext = { signal: abortController.signal };
      
      const result = await transport({ field: 'value' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Operation aborted');
      }
    });
  });

  describe('error handling', () => {
    it('should return error result when mutation fails with Error', async () => {
      const error = new Error('Mutation failed');
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(error),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result).toEqual({
        ok: false,
        error,
      });
    });

    it('should convert non-Error to Error', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue('String error'),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('String error');
      }
    });

    it('should handle tRPC error objects', async () => {
      const trpcError = {
        message: 'TRPC_ERROR',
        code: 'BAD_REQUEST',
        data: { zodError: {} },
      };
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(trpcError),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        // Non-Error objects get stringified, so we get "[object Object]"
        expect(result.error.message).toBe('[object Object]');
      }
    });

    it('should handle null error', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(null),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('null');
      }
    });

    it('should handle undefined error', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(undefined),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('undefined');
      }
    });

    it('should preserve Error instance properties', async () => {
      const error = new Error('Custom error');
      error.name = 'CustomError';
      const mockMutation = {
        mutateAsync: jest.fn().mockRejectedValue(error),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.name).toBe('CustomError');
      }
    });
  });

  describe('type casting', () => {
    it('should handle custom input types', async () => {
      interface CustomInput {
        id: number;
        data: string;
      }

      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({ version: 'v1' }),
      };

      const transport = trpcTransport<CustomInput>(mockMutation);
      const payload: SavePayload = { id: 1, data: 'test' };
      await transport(payload);

      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(
        payload,
        expect.any(Object)
      );
    });

    it('should work with generic SavePayload', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const payload: SavePayload = { anyField: 'anyValue' };
      const result = await transport(payload);

      expect(result.ok).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should work with typical tRPC mutation', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({
          id: 1,
          version: 'v2',
          updatedAt: new Date().toISOString(),
        }),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({
        title: 'Updated Title',
        content: 'Updated Content',
      });

      expect(result).toEqual({
        ok: true,
        version: 'v2',
      });
    });

    it('should handle multiple calls', async () => {
      const mockMutation = {
        mutateAsync: jest.fn()
          .mockResolvedValueOnce({ version: 'v1' })
          .mockResolvedValueOnce({ version: 'v2' })
          .mockResolvedValueOnce({ version: 'v3' }),
      };

      const transport = trpcTransport(mockMutation);
      
      const result1 = await transport({ data: 'first' });
      const result2 = await transport({ data: 'second' });
      const result3 = await transport({ data: 'third' });

      expect(result1).toEqual({ ok: true, version: 'v1' });
      expect(result2).toEqual({ ok: true, version: 'v2' });
      expect(result3).toEqual({ ok: true, version: 'v3' });
      expect(mockMutation.mutateAsync).toHaveBeenCalledTimes(3);
    });

    it('should handle success after failure', async () => {
      const mockMutation = {
        mutateAsync: jest.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ version: 'v1' }),
      };

      const transport = trpcTransport(mockMutation);
      
      const result1 = await transport({ data: 'first' });
      expect(result1.ok).toBe(false);

      const result2 = await transport({ data: 'second' });
      expect(result2).toEqual({ ok: true, version: 'v1' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty payload', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({});

      expect(result.ok).toBe(true);
      expect(mockMutation.mutateAsync).toHaveBeenCalledWith({}, { signal: undefined });
    });

    it('should handle large payloads', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({}),
      };

      const transport = trpcTransport(mockMutation);
      const largePayload = {
        data: 'x'.repeat(10000),
        array: Array(100).fill({ nested: 'value' }),
      };
      
      const result = await transport(largePayload);

      expect(result.ok).toBe(true);
    });

    it('should handle complex nested payloads', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue({ version: 'v1' }),
      };

      const transport = trpcTransport(mockMutation);
      const payload = {
        user: {
          profile: {
            name: 'John',
            settings: {
              notifications: {
                email: true,
                sms: false,
              },
            },
          },
        },
      };
      
      const result = await transport(payload);

      expect(result).toEqual({ ok: true, version: 'v1' });
      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(payload, { signal: undefined });
    });

    it('should handle mutation that returns null', async () => {
      const mockMutation = {
        mutateAsync: jest.fn().mockResolvedValue(null),
      };

      const transport = trpcTransport(mockMutation);
      const result = await transport({ field: 'value' });

      expect(result.ok).toBe(true);
      // Version may or may not exist depending on SaveResult union type
      expect(result).toHaveProperty('ok', true);
    });
  });
});
