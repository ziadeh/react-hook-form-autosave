"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRhfAutosave, type Transport } from "react-hook-form-autosave";
import { useProfileMutation } from "./useProfileMutation";

// Form schema
const profileSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  bio: z.string().optional(),
  skills: z.array(z.object({ id: z.number(), label: z.string() })),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

interface UseProfileFormProps {
  userId: string;
  initialData?: Partial<ProfileFormData>;
}

export const useProfileForm = ({
  userId,
  initialData,
}: UseProfileFormProps) => {
  const { updateProfile, onAddSkill, onRemoveSkill } =
    useProfileMutation(userId);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      email: "",
      bio: "",
      skills: [],
      ...initialData,
    },
    mode: "onChange",
  });

  const transport: Transport = useMemo(() => {
    return async (payload) => {
      const { skills: _omit, ...rest } = payload as any;
      await updateProfile(rest);
      return { ok: true, version: Date.now().toString() };
    };
  }, [updateProfile]);

  const { isSaving, lastError } = useRhfAutosave<ProfileFormData>({
    form,
    transport,
    debounceMs: 600,
    shouldSave: ({ isDirty }) => !!isDirty,
    keyMap: {
      fullName: "full_name",
      email: "email_address",
    },
    validateBeforeSave: "payload",
    diffMap: {
      skills: {
        idOf: (x: { id: number }) => x.id,
        onAdd: onAddSkill,
        onRemove: onRemoveSkill,
      },
    },
    onSaved: (res) => {
      if (res.ok) {
        form.reset(form.getValues(), { keepValues: true, keepDirty: false });
      }
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData, { keepDirty: false });
    }
  }, [initialData, form]);

  return { form, isSaving, lastError };
};
