import { useCallback, useEffect } from "react";
import { type Transport, useRhfAutosave } from "react-hook-form-autosave";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  FormDataSchema,
  type FormData,
  type formOptions,
} from "@/types/formData.type";
import { DefaultFormValues } from "@/utils/formData.utils";
import { api } from "@/trpc/react";

const userId = "123";
export const useFormData = () => {
  const form = useForm<FormData>({
    defaultValues: DefaultFormValues(),
    resolver: zodResolver(FormDataSchema),
    mode: "onChange",
  });

  const { data: sampleFormData, isLoading } = api.sample.getData.useQuery(
    { id: userId },
    {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const { data: skillsOptions } = api.sample.getSkillsOptions.useQuery();
  const updateMutation = api.sample.updateForm.useMutation();
  const { mutateAsync: addSkill } = api.sample.addSkill.useMutation();
  const { mutateAsync: removeSkill } = api.sample.removeSkill.useMutation();

  // Create stable transport function
  const transport: Transport = useCallback(
    async (payload: any) => {
      console.log("🚀 TRANSPORT CALLED - Sending to API:", payload);
      try {
        const { skills, isAnyInputFocused, ...rest } = payload;

        await updateMutation.mutateAsync({
          id: userId,
          data: rest,
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    [userId, updateMutation],
  );
  const shouldSave = useCallback(
    ({
      isDirty,
      isValid,
      values,
    }: {
      isDirty: boolean;
      isValid: boolean;
      values: FormData;
    }) => {
      console.log("shouldSave", isDirty, isValid, values.isAnyInputFocused);
      return isDirty && isValid && !values.isAnyInputFocused;
    },
    [],
  );
  // Setup autosave
  const autosave = useRhfAutosave<FormData>({
    form,
    transport,
    undo: {
      enabled: true,
      ignoreHistoryOps: false,
      hotkeys: true, // enable Cmd/Ctrl+Z
      captureInInputs: false, // don't hijack while typing into inputs (default)
    },
    config: {
      debug: true,
      debounceMs: 600,
      enableMetrics: true, // Enable metrics collection
    },
    shouldSave,
    validateBeforeSave: "payload",
    keyMap: {
      // Transform "country" to "country_code" when saving to server
      country: ["country_code", String],
    },
    diffMap: {
      skills: {
        idOf: (skill) => skill.id,
        onAdd: async ({ id }) => {
          console.log("➕ diffMap: Adding skill with ID:", id);
          await addSkill({
            userId: Number(userId),
            skillId: Number(id),
          });
          toast.success("Skill added via diffMap callback");
        },
        onRemove: async ({ id }) => {
          console.log("➖ diffMap: Removing skill with ID:", id);
          await removeSkill({
            userId: Number(userId),
            skillId: Number(id),
          });
          toast.info("Skill removed via diffMap callback");
        },
      },
    },
    onSaved: async (result) => {
      console.log({ result });
      if (result.ok) {
        toast.success("Form data saved successfully");
      } else {
        toast.error("Could not save form data");
      }
    },
  });

  useEffect(() => {
    if (sampleFormData) {
      form.reset({
        ...sampleFormData,
        isAnyInputFocused: false,
      });
    }
  }, [form, sampleFormData]);

  return {
    form,
    userId,
    isLoading,
    options: {
      skillsOptions,
    } as formOptions,
    sampleFormData,
    autosave,
    addSkill,
  };
};
