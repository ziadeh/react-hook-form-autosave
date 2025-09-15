import {
  Transport,
  SaveResult,
  SavePayload,
} from "../../core/useAutosaveEngine";

/**
 * Wrap a tRPC mutation as an autosave `Transport`.
 *
 * This lets you pass a tRPC mutation directly into `useRhfAutosave` or `useAutosaveEngine`.
 *
 * @example
 * ```ts
 * const mutation = api.regulation.update.useMutation();
 * const transport = trpcTransport(mutation);
 *
 * useRhfAutosave({
 *   form,
 *   transport,
 * });
 * ```
 *
 * @typeParam TInput - Input shape expected by the tRPC mutation.
 */
export function trpcTransport<TInput extends object = SavePayload>(mutation: {
  /** Any object exposing `mutateAsync` in the standard tRPC client form. */
  mutateAsync: (input: TInput, opts?: any) => Promise<any>;
}): Transport {
  return async (payload, ctx) => {
    try {
      // Call the tRPC mutation with the payload
      // Cast payload to TInput so the mutation gets strongly typed input
      const res = await mutation.mutateAsync(payload as TInput, {
        /**
         * If supported by your tRPC link (e.g., fetch link),
         * you can pass an AbortSignal to cancel inflight requests.
         */
        signal: ctx?.signal,
      });

      // Mark as successful; optionally propagate a version if returned by API
      return { ok: true, version: (res as any)?.version } as SaveResult;
    } catch (e: any) {
      // Wrap any thrown error into a standardized SaveResult
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      } as SaveResult;
    }
  };
}
