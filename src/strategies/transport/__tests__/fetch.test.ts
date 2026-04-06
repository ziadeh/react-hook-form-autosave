import { fetchTransport } from '../fetch';
import { TransportError } from '../../../core/errors';
import type { SaveContext } from '../../../core/types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchTransport', () => {
  describe('successful saves', () => {
    it('should POST JSON payload to the given URL', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const transport = fetchTransport('/api/save');
      const result = await transport({ name: 'John', age: 30 });

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: 'John', age: 30 }),
        signal: undefined,
      });
    });

    it('should use custom method', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const transport = fetchTransport('/api/save', { method: 'PATCH' });
      await transport({ name: 'John' });

      expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('should merge custom headers with Content-Type', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const transport = fetchTransport('/api/save', {
        headers: { 'Authorization': 'Bearer token123' },
      });
      await transport({ name: 'John' });

      expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123',
        },
      }));
    });

    it('should use custom credentials', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const transport = fetchTransport('/api/save', { credentials: 'include' });
      await transport({ name: 'John' });

      expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
        credentials: 'include',
      }));
    });

    it('should apply mapBody before sending', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const transport = fetchTransport('/api/save', {
        mapBody: (payload) => ({ data: payload, timestamp: 12345 }),
      });
      await transport({ name: 'John' });

      expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
        body: JSON.stringify({ data: { name: 'John' }, timestamp: 12345 }),
      }));
    });
  });

  describe('error handling', () => {
    it('should return error for non-2xx response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' });

      const transport = fetchTransport('/api/save');
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
        expect(result.error.message).toContain('400');
      }
    });

    it('should return error for network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const transport = fetchTransport('/api/save');
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
        expect(result.error.message).toContain('Failed to fetch');
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockFetch.mockRejectedValue('string error');

      const transport = fetchTransport('/api/save');
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
      }
    });
  });

  describe('abort signal', () => {
    it('should pass AbortSignal from SaveContext to fetch', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const controller = new AbortController();
      const ctx: SaveContext = { signal: controller.signal };

      const transport = fetchTransport('/api/save');
      await transport({ name: 'John' }, ctx);

      expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
        signal: controller.signal,
      }));
    });

    it('should return error when request is aborted', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      const transport = fetchTransport('/api/save');
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
      }
    });
  });
});
