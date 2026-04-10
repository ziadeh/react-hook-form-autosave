/**
 * Capturing logger for the matrix test harness.
 *
 * Mirrors the `Logger` interface from `src/utils/logger.ts` but redirects every
 * call into an in-memory `LogEntry[]` buffer instead of writing to `console.*`.
 * The harness (Task 3) uses a console-interception strategy for capturing
 * library logs since `useRhfAutosave` does not accept a logger injection —
 * this file still provides the canonical `LogEntry` shape that
 * `harness.getLogs()` returns, and can be used directly by any helper that
 * does want an injectable capturing logger.
 *
 * Dev-only: lives under `tests/helpers/`, type-only import from `src/` so no
 * runtime value crosses the boundary.
 */

import type { Logger } from "../../src/utils/logger";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  namespace: string;
  message: string;
  meta?: unknown;
  error?: Error;
  timestamp: number;
}

export interface CapturingLogger {
  logger: Logger;
  getLogs(): readonly LogEntry[];
  clear(): void;
}

export function createCapturingLogger(namespace: string): CapturingLogger {
  const entries: LogEntry[] = [];
  const logger: Logger = {
    debug(message: string, meta?: unknown) {
      entries.push({
        level: "debug",
        namespace,
        message,
        meta,
        timestamp: Date.now(),
      });
    },
    info(message: string, meta?: unknown) {
      entries.push({
        level: "info",
        namespace,
        message,
        meta,
        timestamp: Date.now(),
      });
    },
    warn(message: string, meta?: unknown) {
      entries.push({
        level: "warn",
        namespace,
        message,
        meta,
        timestamp: Date.now(),
      });
    },
    error(message: string, error?: Error, meta?: unknown) {
      entries.push({
        level: "error",
        namespace,
        message,
        error,
        meta,
        timestamp: Date.now(),
      });
    },
  };
  return {
    logger,
    getLogs: () => entries.slice(),
    clear: () => {
      entries.length = 0;
    },
  };
}
