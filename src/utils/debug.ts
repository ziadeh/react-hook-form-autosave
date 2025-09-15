/**
 * Create a namespaced debug logger for autosave.
 *
 * By default:
 * - Enabled in development (NODE_ENV !== "production" or `window.__DEV__` is true).
 * - Disabled in production unless explicitly enabled via the `enabled` argument.
 *
 * @param ns - Namespace for this logger (appears in the log prefix).
 * @param enabled - Force-enable/disable logs. If omitted, defaults to "on in dev".
 *
 * @returns A logging function with `.info`, `.warn`, and `.error` helpers.
 *
 * @example
 * const dbg = makeDebug("rhf");
 * dbg("This is a debug log");
 * dbg.warn("This is a warning");
 * dbg.error("This is an error");
 */
export function makeDebug(ns: string, enabled?: boolean) {
  // Detect if we're running in a dev environment
  const isDev =
    (typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production") ||
    (typeof window !== "undefined" && (window as any).__DEV__ === true);

  // Use explicit `enabled` flag if provided, otherwise fall back to dev check
  const on = enabled ?? isDev;

  // Prefix every log with [autosave:namespace]
  const prefix = `[autosave:${ns}]`;

  /**
   * Base logging function.
   * Uses console.debug if available, otherwise falls back to console.log.
   */
  const log = (...args: any[]) => {
    if (!on) return;
    (console.debug ?? console.log)(prefix, ...args);
  };

  // Convenience wrappers (all no-ops if disabled)
  log.info = log;
  log.warn = (...args: any[]) => {
    if (!on) return;
    console.warn(prefix, ...args);
  };
  log.error = (...args: any[]) => {
    if (!on) return;
    console.error(prefix, ...args);
  };

  return log as ((...args: any[]) => void) & {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}
