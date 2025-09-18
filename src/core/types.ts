export type SavePayload = Record<string, unknown>;

export type SaveResult =
  | { ok: true; version?: string; metadata?: Record<string, any> }
  | { ok: false; error: Error; code?: string };

export interface SaveContext {
  signal?: AbortSignal;
  timestamp?: number;
  retryCount?: number;
}

export type Transport = (
  payload: SavePayload,
  ctx?: SaveContext
) => Promise<SaveResult>;

export interface Timer {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

export interface AutosaveConfig {
  debounceMs: number;
  maxRetries: number;
  enableMetrics: boolean;
  enableCache: boolean;
  cacheSize: number;
  cacheTtlMs: number;
}
