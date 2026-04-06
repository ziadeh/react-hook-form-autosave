import { serverActionTransport } from '../serverAction';
import { TransportError } from '../../../core/errors';

describe('serverActionTransport', () => {
  describe('successful saves', () => {
    it('should call the action with the payload', async () => {
      const action = jest.fn().mockResolvedValue({ id: 1 });

      const transport = serverActionTransport(action);
      const result = await transport({ name: 'John' });

      expect(result).toEqual({ ok: true });
      expect(action).toHaveBeenCalledWith({ name: 'John' });
    });

    it('should apply mapPayload before calling the action', async () => {
      const action = jest.fn().mockResolvedValue(undefined);

      const transport = serverActionTransport(action, {
        mapPayload: (payload) => ({ formData: payload }),
      });
      await transport({ name: 'John' });

      expect(action).toHaveBeenCalledWith({ formData: { name: 'John' } });
    });

    it('should use mapResult to interpret the return value', async () => {
      const action = jest.fn().mockResolvedValue({ success: false, message: 'Invalid' });

      const transport = serverActionTransport(action, {
        mapResult: (result: any) =>
          result.success
            ? { ok: true as const }
            : { ok: false as const, error: new Error(result.message) },
      });
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid');
      }
    });

    it('should return ok: true when mapResult returns success', async () => {
      const action = jest.fn().mockResolvedValue({ success: true });

      const transport = serverActionTransport(action, {
        mapResult: (result: any) =>
          result.success ? { ok: true as const } : { ok: false as const, error: new Error('fail') },
      });
      const result = await transport({ name: 'John' });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('error handling', () => {
    it('should wrap thrown Error as TransportError', async () => {
      const action = jest.fn().mockRejectedValue(new Error('Server error'));

      const transport = serverActionTransport(action);
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
        expect(result.error.message).toContain('Server error');
      }
    });

    it('should wrap non-Error thrown values', async () => {
      const action = jest.fn().mockRejectedValue('string error');

      const transport = serverActionTransport(action);
      const result = await transport({ name: 'John' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(TransportError);
        expect(result.error.message).toContain('string error');
      }
    });

    it('should handle action returning undefined (void server actions)', async () => {
      const action = jest.fn().mockResolvedValue(undefined);

      const transport = serverActionTransport(action);
      const result = await transport({ name: 'John' });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('SaveContext', () => {
    it('should ignore signal (server actions are not cancellable)', async () => {
      const action = jest.fn().mockResolvedValue(undefined);
      const controller = new AbortController();

      const transport = serverActionTransport(action);
      const result = await transport({ name: 'John' }, { signal: controller.signal });

      expect(result).toEqual({ ok: true });
      expect(action).toHaveBeenCalledWith({ name: 'John' });
    });
  });
});
