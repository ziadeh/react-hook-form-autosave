import { useCallback, useEffect } from "react";
import { 
  type Transport, 
  useRhfAutosave,
  mapNestedKeys,
  detectNestedArrayChanges,
  findArrayFields,
  getByPath,
} from "react-hook-form-autosave";
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

  // Create stable transport function with nested field support
  const transport: Transport = useCallback(
    async (payload: any, context: any) => {
      console.log("🚀 TRANSPORT CALLED - Sending to API:", payload);
      console.log("📊 Context:", context);

      try {
        const { skills, isAnyInputFocused, teamMembers, ...rest } = payload;

        // Demonstrate nested key mapping for API
        const apiPayload = mapNestedKeys(rest, {
          'profile.firstName': 'first_name',
          'profile.lastName': 'last_name',
          'profile.email': 'email_address',
          'address.zipCode': 'address.postal_code',
          'socialLinks.github': 'github_url',
          'socialLinks.linkedin': 'linkedin_url',
        }, { preserveUnmapped: true });

        console.log("🔄 Transformed payload for API:", apiPayload);

        // Auto-detect array changes in nested fields
        const baseline = form.getValues();
        const arrayPaths = findArrayFields(payload);
        console.log("📋 Array fields detected:", arrayPaths);

        if (arrayPaths.length > 0) {
          const arrayChanges = detectNestedArrayChanges(
            baseline,
            payload,
            arrayPaths
          );
          console.log("🔍 Array changes detected:", arrayChanges);

          // Show toast for array changes
          Object.keys(arrayChanges).forEach(path => {
            const change = arrayChanges[path];
            if (change?.hasChanges) {
              toast.info(`${path}: +${change.added.length} -${change.removed.length} ~${change.modified.length}`);
            }
          });
        }

        // Example: Get nested values safely
        const firstName = getByPath(payload, 'profile.firstName');
        const city = getByPath(payload, 'address.city');
        console.log("✅ Extracted values:", { firstName, city });

        await updateMutation.mutateAsync({
          id: userId,
          data: apiPayload,
        });
        return { ok: true };
      } catch (error) {
        console.error("❌ Save error:", error);
        return {
          ok: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    [userId, updateMutation, form],
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
    // Note: keyMap is handled inside transport with mapNestedKeys for more flexibility
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
