/**
 * Tests for debounce utility
 * Covers debounce behavior, cancel, flush, pending methods
 */

import { debounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic debounce behavior', () => {
    it('should delay function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(99);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call function after wait period', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);

      debounced();
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call function once after multiple rapid calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();
      debounced();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should work with zero delay', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 0);

      debounced();
      jest.advanceTimersByTime(0);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('arguments handling', () => {
    it('should pass arguments to debounced function', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2', 'arg3');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should use latest arguments when called multiple times', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      jest.advanceTimersByTime(50);

      debounced('second');
      jest.advanceTimersByTime(50);

      debounced('third');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('should handle different argument types', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      const obj = { key: 'value' };
      const arr = [1, 2, 3];

      debounced(123, 'string', true, obj, arr, null, undefined);
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith(123, 'string', true, obj, arr, null, undefined);
    });
  });

  describe('cancel()', () => {
    it('should prevent pending function call', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      jest.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should clear timeout', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(debounced.pending()).toBe(true);

      debounced.cancel();
      expect(debounced.pending()).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      debounced.cancel();
      debounced.cancel();

      expect(debounced.pending()).toBe(false);
    });

    it('should work when no call is pending', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      expect(() => debounced.cancel()).not.toThrow();
      expect(debounced.pending()).toBe(false);
    });

    it('should clear stored arguments', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('test');
      debounced.cancel();

      // Call again after cancel
      debounced('new');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('new');
    });
  });

  describe('flush()', () => {
    it('should execute pending function immediately', () => {
      const fn = jest.fn(() => 'result');
      const debounced = debounce(fn, 100);

      debounced();
      const result = debounced.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should return undefined when no call is pending', () => {
      const fn = jest.fn(() => 'result');
      const debounced = debounce(fn, 100);

      const result = debounced.flush();

      expect(fn).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should clear the timeout', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.flush();

      expect(debounced.pending()).toBe(false);
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      debounced.flush();

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should return function result', () => {
      const fn = jest.fn((x: number, y: number) => x + y);
      const debounced = debounce(fn, 100);

      debounced(5, 3);
      const result = debounced.flush();

      expect(result).toBe(8);
    });

    it('should work after cancel', () => {
      const fn = jest.fn(() => 'result');
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      const result = debounced.flush();

      expect(fn).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('pending()', () => {
    it('should return false initially', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      expect(debounced.pending()).toBe(false);
    });

    it('should return true when call is pending', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(debounced.pending()).toBe(true);
    });

    it('should return false after timeout completes', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(100);

      expect(debounced.pending()).toBe(false);
    });

    it('should return false after cancel', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();

      expect(debounced.pending()).toBe(false);
    });

    it('should return false after flush', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.flush();

      expect(debounced.pending()).toBe(false);
    });

    it('should be true again after new call', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(100);
      expect(debounced.pending()).toBe(false);

      debounced();
      expect(debounced.pending()).toBe(true);
    });
  });

  describe('custom timer', () => {
    it('should use custom setTimeout', () => {
      const fn = jest.fn();
      const customSetTimeout = jest.fn((callback: () => void, delay: number) => 
        setTimeout(callback, delay)
      ) as unknown as typeof setTimeout;
      const customTimer = {
        setTimeout: customSetTimeout,
        clearTimeout: clearTimeout,
      };

      const debounced = debounce(fn, 100, customTimer);
      debounced();

      expect(customSetTimeout).toHaveBeenCalledTimes(1);
      expect(customSetTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    it('should use custom clearTimeout', () => {
      const fn = jest.fn();
      const customClearTimeout = jest.fn((id: any) => clearTimeout(id)) as unknown as typeof clearTimeout;
      const customTimer = {
        setTimeout: setTimeout,
        clearTimeout: customClearTimeout,
      };

      const debounced = debounce(fn, 100, customTimer);
      debounced();
      debounced.cancel();

      expect(customClearTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple debounced functions', () => {
    it('should work independently', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      const debounced1 = debounce(fn1, 100);
      const debounced2 = debounce(fn2, 200);

      debounced1();
      debounced2();

      jest.advanceTimersByTime(100);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle function that throws error', () => {
      const fn = jest.fn(() => {
        throw new Error('Test error');
      });
      const debounced = debounce(fn, 100);

      debounced();

      expect(() => {
        jest.advanceTimersByTime(100);
      }).toThrow('Test error');
    });

    it('should handle async functions', () => {
      const fn = jest.fn(async () => 'async result');
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should work with very long delays', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 10000);

      debounced();
      jest.advanceTimersByTime(9999);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
