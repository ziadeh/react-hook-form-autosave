import { SavePayload, SaveResult, Transport } from "../../core/types";

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
  mutateAsync: (input: TInput, opts?: any) => Promise<any>;
}): Transport {
  return async (payload, ctx) => {
    try {
      const res = await mutation.mutateAsync(payload as TInput, {
        signal: ctx?.signal,
      });

      // TypeScript infers this matches SaveResult
      return { ok: true, version: (res as any)?.version };
    } catch (e: any) {
      // TypeScript infers this matches SaveResult
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  };
}
