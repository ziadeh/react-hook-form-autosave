import type {
  Transport,
  SaveResult,
  SavePayload,
  SaveContext,
} from "../../core/types";
import { TransportError } from "../../core/errors";
import { Logger } from "../../utils/logger";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export function withRetry(
  transport: Transport,
  config: Partial<RetryConfig> = {},
  logger?: Logger
): Transport {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2,
  } = config;

  return async (
    payload: SavePayload,
    ctx?: SaveContext
  ): Promise<SaveResult> => {
    let lastError: Error | undefined;
    const retryCount = ctx?.retryCount || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await transport(payload, {
          ...ctx,
          retryCount: retryCount + attempt,
        });

        if (result.ok) {
          if (attempt > 0) {
            logger?.info(`Transport succeeded after ${attempt} retries`);
          }
          return result;
        } else {
          lastError = result.error;
          if (attempt === maxRetries) break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries) break;
      }

      if (ctx?.signal?.aborted) {
        return { ok: false, error: new TransportError("Operation aborted") };
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(backoffFactor, attempt),
        maxDelayMs
      );

      logger?.debug(
        `Transport attempt ${attempt + 1} failed, retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return {
      ok: false,
      error: new TransportError(
        `Transport failed after ${maxRetries + 1} attempts`,
        lastError
      ),
    };
  };
}
