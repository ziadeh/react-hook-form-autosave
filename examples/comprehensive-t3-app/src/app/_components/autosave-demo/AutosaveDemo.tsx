"use client";

import { useFormData } from "@/hooks/useFormData";
import React from "react";
import { FormProvider } from "react-hook-form";
import { DemoFormFields } from "./DemoFormFields";
import { DemoHeader } from "./DemoHeader";

/**
 * AutosaveDemo - Comprehensive demonstration of react-hook-form-autosave capabilities
 *
 * Features demonstrated:
 * - Auto-save with debounce
 * - Undo/Redo with keyboard shortcuts
 * - diffMap for array operations
 * - keyMap for field name transformation
 * - shouldSave for conditional saving
 * - validateBeforeSave with Zod
 * - Metrics collection
 * - Debug mode
 */
export function AutosaveDemo() {
  const { form, options, autosave } = useFormData();

  return (
    <FormProvider {...form}>
      <form className="w-full max-w-4xl mx-auto">
        <div className="space-y-6">
          <DemoHeader autosave={autosave} />
          <DemoFormFields options={options} />
        </div>
      </form>
    </FormProvider>
  );
}
