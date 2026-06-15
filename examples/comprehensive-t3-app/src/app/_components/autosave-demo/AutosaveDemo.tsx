"use client";

import { useEffect, useState } from "react";
import { FormProvider } from "react-hook-form";
import dynamic from "next/dynamic";

import { useFormData } from "@/hooks/useFormData";
import { DemoHeader } from "./DemoHeader";
import { SaveLog } from "./SaveLog";
import { Card, CardContent } from "@/components/ui/card";

// Render the field-array form on the client only to avoid hydration mismatches.
const NestedFormFields = dynamic(
  () => import("./NestedFormFields").then((m) => m.NestedFormFields),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Loading fields…
      </div>
    ),
  },
);

function Loading() {
  return (
    <Card className="w-full max-w-5xl">
      <CardContent className="text-muted-foreground p-12 text-center text-sm">
        Loading form data…
      </CardContent>
    </Card>
  );
}

/**
 * AutosaveDemo — comprehensive, working demonstration of react-hook-form-autosave:
 * nested fields, an editable array, autosave (real tRPC), undo/redo, payload
 * validation, metrics, and a live save log.
 */
export function AutosaveDemo() {
  const { form, autosave, isLoading, saveLog, clearSaveLog } = useFormData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || isLoading) return <Loading />;

  return (
    <FormProvider {...form}>
      <div className="w-full max-w-5xl space-y-6">
        <DemoHeader autosave={autosave} />

        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]"
        >
          <div className="space-y-6">
            <NestedFormFields />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <SaveLog entries={saveLog} onClear={clearSaveLog} />
          </aside>
        </form>
      </div>
    </FormProvider>
  );
}
