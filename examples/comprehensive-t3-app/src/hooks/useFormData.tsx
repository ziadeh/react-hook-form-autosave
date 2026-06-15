import { useCallback, useEffect, useRef, useState } from "react";
import {
  type SavePayload,
  useRhfAutosave,
  pickChanged,
} from "react-hook-form-autosave";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormDataSchema, type FormData } from "@/types/formData.type";
import { DefaultFormValues } from "@/utils/formData.utils";
import { api } from "@/trpc/react";

const userId = "123";

export type SaveLogEntry = {
  id: number;
  at: string;
  keys: string[];
  ok: boolean;
};

/**
 * Clean payload selection for a mixed nested/array form:
 *  - nested objects (profile/address/socialLinks/settings) → only changed leaves
 *    (via the library's `pickChanged`)
 *  - arrays (teamMembers)                                  → the whole array,
 *    because per-item dirty tracking would otherwise yield a partial
 *    `{ "0": { ... } }` object instead of a real array.
 */
function selectChangedPayload(
  values: FormData,
  dirtyFields: Record<string, unknown>,
): Partial<FormData> {
  const payload: SavePayload = {};

  for (const key of Object.keys(dirtyFields ?? {})) {
    const dirty = (dirtyFields as Record<string, unknown>)[key];
    const value = (values as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      payload[key] = value;
    } else if (dirty === true) {
      payload[key] = value;
    } else if (dirty && typeof dirty === "object") {
      const nested = pickChanged(
        (value ?? {}) as Record<string, unknown>,
        dirty,
      );
      if (Object.keys(nested).length > 0) payload[key] = nested;
    }
  }

  return payload as Partial<FormData>;
}

export const useFormData = () => {
  const form = useForm<FormData>({
    defaultValues: DefaultFormValues(),
    resolver: zodResolver(FormDataSchema),
    mode: "onChange",
  });

  const { data, isLoading } = api.sample.getData.useQuery(
    { id: userId },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const { mutateAsync } = api.sample.updateForm.useMutation();

  // Hydrate the form from the server exactly once. The autosave hook detects
  // the reset (autoHydrate) and snapshots it as the baseline.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (data && !hydratedRef.current) {
      hydratedRef.current = true;
      form.reset(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Visible save log — proves the API actually fires on autosave.
  const [saveLog, setSaveLog] = useState<SaveLogEntry[]>([]);
  const logCounter = useRef(0);
  const pushLog = useCallback((keys: string[], ok: boolean) => {
    logCounter.current += 1;
    const entry: SaveLogEntry = {
      id: logCounter.current,
      at: new Date().toLocaleTimeString(),
      keys,
      ok,
    };
    setSaveLog((prev) => [entry, ...prev].slice(0, 25));
  }, []);
  const clearSaveLog = useCallback(() => setSaveLog([]), []);

  // Real tRPC transport, wrapped to record each save in the log.
  const transport = useCallback(
    async (payload: SavePayload) => {
      const keys = Object.keys(payload);
      try {
        await mutateAsync({ id: userId, data: payload });
        pushLog(keys, true);
        return { ok: true as const };
      } catch (error) {
        pushLog(keys, false);
        return {
          ok: false as const,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    [mutateAsync, pushLog],
  );

  const selectPayload = useCallback(
    (values: FormData, dirtyFields: Record<string, unknown>) =>
      selectChangedPayload(values, dirtyFields),
    [],
  );

  const autosave = useRhfAutosave<FormData>({
    form,
    transport,
    selectPayload,
    undo: { enabled: true, hotkeys: true, captureInInputs: true },
    validateBeforeSave: "payload",
    config: { debounceMs: 800 },
    onSaved: (result: { ok: boolean }) => {
      if (result.ok) toast.success("Saved");
      else toast.error("Save failed");
    },
  });

  return { form, autosave, isLoading, saveLog, clearSaveLog };
};
