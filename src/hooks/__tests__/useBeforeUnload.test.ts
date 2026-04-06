import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from '../useBeforeUnload';

describe('useBeforeUnload', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should register beforeunload when shouldBlock is true', () => {
    renderHook(() => useBeforeUnload(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('should not register beforeunload when shouldBlock is false', () => {
    renderHook(() => useBeforeUnload(false));

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('should unregister on unmount', () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('should unregister when shouldBlock changes to false', () => {
    const { rerender } = renderHook(
      ({ block }) => useBeforeUnload(block),
      { initialProps: { block: true } }
    );

    rerender({ block: false });

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('should call preventDefault on the beforeunload event', () => {
    renderHook(() => useBeforeUnload(true));

    const handler = addEventListenerSpy.mock.calls.find(
      (call: any[]) => call[0] === 'beforeunload'
    )?.[1];

    const event = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

    handler(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
