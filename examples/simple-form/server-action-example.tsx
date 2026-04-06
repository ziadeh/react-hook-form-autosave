"use client";

/**
 * Example: Using serverActionTransport with Next.js Server Actions
 *
 * This shows how to use autosave with a Next.js Server Action instead of
 * a REST endpoint. The server action handles auth, validation, and DB writes
 * on the server — the client just passes data through.
 */

import { useForm } from "react-hook-form";
import {
  useRhfAutosave,
  useBeforeUnload,
  serverActionTransport,
} from "react-hook-form-autosave";
import { saveProfile } from "./actions"; // Your server action

interface ProfileData {
  name: string;
  email: string;
  bio: string;
}

export default function ServerActionForm() {
  const form = useForm<ProfileData>({
    defaultValues: { name: "", email: "", bio: "" },
  });

  const { isSaving, hasPendingChanges } = useRhfAutosave({
    form,
    // One line — calls the server action directly
    transport: serverActionTransport(saveProfile),
    config: { debounceMs: 800 },
    onStatusChange: (status) => {
      if (status.state === "saved") console.log("Saved!");
      if (status.state === "error") console.error(status.error);
    },
  });

  useBeforeUnload(hasPendingChanges);

  return (
    <form>
      <input {...form.register("name")} placeholder="Name" />
      <input {...form.register("email")} placeholder="Email" />
      <textarea {...form.register("bio")} placeholder="Bio" />
      <div>
        {isSaving
          ? "Saving..."
          : hasPendingChanges
            ? "Unsaved changes"
            : "All saved"}
      </div>
    </form>
  );
}
