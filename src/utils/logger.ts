export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

export class ConsoleLogger implements Logger {
  constructor(
    private readonly namespace: string,
    private readonly enabled = true
  ) {}

  debug(message: string, meta?: any): void {
    if (!this.enabled) return;
    const log = console.debug ?? console.log;
    log(`[autosave:${this.namespace}]`, message, meta ? meta : "");
  }

  info(message: string, meta?: any): void {
    if (!this.enabled) return;
    console.info(`[autosave:${this.namespace}]`, message, meta ? meta : "");
  }

  warn(message: string, meta?: any): void {
    if (!this.enabled) return;
    console.warn(`[autosave:${this.namespace}]`, message, meta ? meta : "");
  }

  error(message: string, error?: Error, meta?: any): void {
    if (!this.enabled) return;
    console.error(
      `[autosave:${this.namespace}]`,
      message,
      error,
      meta ? meta : ""
    );
  }
}

export function createLogger(namespace: string, enabled?: boolean): Logger {
  const isDev =
    (typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production") ||
    (typeof window !== "undefined" && (window as any).__DEV__ === true);

  return new ConsoleLogger(namespace, enabled ?? isDev);
}
