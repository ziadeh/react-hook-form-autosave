"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useRhfAutosave,
  useBeforeUnload,
  fetchTransport,
  withRetry,
} from "react-hook-form-autosave";
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
  const { onAddSkill, onRemoveSkill } = useProfileMutation(userId);

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

  // One-line transport with retry — replaces hand-written fetch wrapper
  const transport = withRetry(
    fetchTransport(`/api/profiles/${userId}`, {
      method: "PATCH",
      credentials: "include",
    }),
    { maxRetries: 2 }
  );

  const {
    isSaving,
    lastError,
    hasPendingChanges,
  } = useRhfAutosave<ProfileFormData>({
    form,
    transport,
    config: { debounceMs: 600 },
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
    onStatusChange: (status) => {
      if (status.state === "error") {
        console.error("Autosave failed:", status.error.message);
      }
    },
    onSaved: (res) => {
      if (res.ok) {
        form.reset(form.getValues(), { keepValues: true, keepDirty: false });
      }
    },
  });

  // Warn before closing tab with unsaved changes
  useBeforeUnload(hasPendingChanges);

  useEffect(() => {
    if (initialData) {
      form.reset(initialData, { keepDirty: false });
    }
  }, [initialData, form]);

  return { form, isSaving, lastError, hasPendingChanges };
};
