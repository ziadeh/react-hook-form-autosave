import type { Transport, SavePayload, SaveResult, SaveContext } from "../../core/types";
import { TransportError } from "../../core/errors";

export interface ServerActionTransportOptions {
  /** Transform payload before calling the action */
  mapPayload?: (payload: SavePayload) => unknown;
  /** Interpret the action's return value as a SaveResult */
  mapResult?: (result: unknown) => SaveResult;
}

export function serverActionTransport(
  action: (data: any) => Promise<any>,
  options: ServerActionTransportOptions = {}
): Transport {
  const { mapPayload, mapResult } = options;

  return async (
    payload: SavePayload,
    _ctx?: SaveContext
  ): Promise<SaveResult> => {
    const data = mapPayload ? mapPayload(payload) : payload;

    try {
      const result = await action(data);

      if (mapResult) {
        return mapResult(result);
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
