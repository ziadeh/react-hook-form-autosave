import type {
  Transport,
  SaveResult,
  SavePayload,
  SaveContext,
} from "../../core/types";

export function composeTransports(...transports: Transport[]): Transport {
  if (transports.length === 0) {
    throw new Error("At least one transport is required");
  }

  if (transports.length === 1) {
    return transports[0];
  }

  return async (
    payload: SavePayload,
    ctx?: SaveContext
  ): Promise<SaveResult> => {
    for (const transport of transports) {
      const result = await transport(payload, ctx);
      if (!result.ok) {
        return result;
      }
    }
    return { ok: true };
  };
}

export function parallelTransports(...transports: Transport[]): Transport {
  return async (
    payload: SavePayload,
    ctx?: SaveContext
  ): Promise<SaveResult> => {
    const results = await Promise.allSettled(
      transports.map((transport) => transport(payload, ctx))
    );

    const failures: Error[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        failures.push(result.reason);
      } else if (!result.value.ok) {
        failures.push(result.value.error);
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        error: new Error(
          `${failures.length} transports failed: ${failures
            .map((e) => e.message)
            .join(", ")}`
        ),
      };
    }

    return { ok: true };
  };
}
