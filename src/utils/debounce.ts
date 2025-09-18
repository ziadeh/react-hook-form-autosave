export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
  pending(): boolean;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number,
  timer = { setTimeout, clearTimeout }
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debouncedFn = (...args: Parameters<T>): void => {
    lastArgs = args;

    if (timeoutId) {
      timer.clearTimeout(timeoutId);
    }

    timeoutId = timer.setTimeout(() => {
      timeoutId = null;
      if (lastArgs) {
        func(...lastArgs);
        lastArgs = null;
      }
    }, waitMs);
  };

  debouncedFn.cancel = (): void => {
    if (timeoutId) {
      timer.clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debouncedFn.flush = (): ReturnType<T> | undefined => {
    if (timeoutId) {
      timer.clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (lastArgs) {
      const result = func(...lastArgs);
      lastArgs = null;
      return result;
    }

    return undefined;
  };

  debouncedFn.pending = (): boolean => {
    return timeoutId !== null;
  };

  return debouncedFn;
}
