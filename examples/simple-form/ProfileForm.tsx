"use client";

import React from "react";
import { FormProvider } from "react-hook-form";
import { useProfileForm } from "./useProfileForm";

export default function ProfileForm() {
  const { form, isSaving, lastError } = useProfileForm({
    userId: "123",
    initialData: {
      fullName: "Jane Doe",
      email: "jane@example.com",
      bio: "Engineer, open-source contributor",
      skills: [{ id: 1, label: "React" }],
    },
  });

  return (
    <FormProvider {...form}>
      <form className="space-y-4 p-4">
        <input
          {...form.register("fullName")}
          placeholder="Full name"
          className="border p-2"
        />
        <input
          {...form.register("email")}
          placeholder="Email"
          className="border p-2"
        />
        <textarea
          {...form.register("bio")}
          placeholder="Short bio"
          className="border p-2"
        />

        <div className="text-sm text-gray-500">
          {isSaving ? "Saving…" : "Saved"}
          {lastError && <span className="text-red-500">Error!</span>}
        </div>
      </form>
    </FormProvider>
  );
}
