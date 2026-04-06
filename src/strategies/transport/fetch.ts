import type { Transport, SavePayload, SaveResult, SaveContext } from "../../core/types";
import { TransportError } from "../../core/errors";

export interface FetchTransportOptions {
  /** HTTP method. Default: 'POST' */
  method?: string;
  /** Extra headers, merged with Content-Type: application/json */
  headers?: Record<string, string>;
  /** Fetch credentials mode. Default: 'same-origin' */
  credentials?: RequestCredentials;
  /** Transform payload before JSON.stringify */
  mapBody?: (payload: SavePayload) => unknown;
}

export function fetchTransport(
  url: string,
  options: FetchTransportOptions = {}
): Transport {
  const {
    method = "POST",
    headers: userHeaders = {},
    credentials = "same-origin",
    mapBody,
  } = options;

  return async (
    payload: SavePayload,
    ctx?: SaveContext
  ): Promise<SaveResult> => {
    const body = mapBody ? mapBody(payload) : payload;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...userHeaders,
        },
        credentials,
        body: JSON.stringify(body),
        signal: ctx?.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new TransportError(
            `HTTP ${response.status}: ${response.statusText}`
          ),
        };
      }

      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: new TransportError(message, error instanceof Error ? error : undefined),
      };
    }
  };
}
