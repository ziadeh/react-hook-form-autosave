"use client";

import { useFormData } from "@/hooks/useFormData";
import React, { useState, useEffect, Suspense } from "react";
import { FormProvider } from "react-hook-form";
import { DemoFormFields } from "./DemoFormFields";
import { DemoHeader } from "./DemoHeader";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Dynamically import NestedFormFields with no SSR to avoid hydration issues
const NestedFormFields = dynamic(
  () => import("./NestedFormFields").then((mod) => mod.NestedFormFields),
  { 
    ssr: false,
    loading: () => <div className="p-8 text-center text-muted-foreground">Loading nested fields...</div>
  }
);

/**
 * AutosaveDemo - Comprehensive demonstration of react-hook-form-autosave capabilities
 *
 * Features demonstrated:
 * - Auto-save with debounce
 * - Undo/Redo with keyboard shortcuts
 * - diffMap for array operations
 * - Nested field support (NEW!)
 * - mapNestedKeys for field transformation
 * - detectNestedArrayChanges for array tracking
 * - shouldSave for conditional saving
 * - validateBeforeSave with Zod
 * - Metrics collection
 * - Debug mode
 */
export function AutosaveDemo() {
  const { form, options, autosave, isLoading } = useFormData();
  const [activeTab, setActiveTab] = useState<"nested" | "legacy">("nested");
  const [mounted, setMounted] = useState(false);

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render form until data is loaded and component is mounted
  if (!mounted || isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center">
        <p className="text-muted-foreground">Loading form data...</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form className="w-full max-w-4xl mx-auto">
        <div className="space-y-6">
          <DemoHeader autosave={autosave} />

          {/* Tab Navigation */}
          <Card className="p-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={activeTab === "nested" ? "default" : "outline"}
                onClick={() => setActiveTab("nested")}
              >
                🎯 Nested Fields (NEW!)
              </Button>
              <Button
                type="button"
                variant={activeTab === "legacy" ? "default" : "outline"}
                onClick={() => setActiveTab("legacy")}
              >
                📋 Legacy Demo
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {activeTab === "nested" 
                ? "Demonstrates nested field support: profile.firstName, address.city, teamMembers[0].name"
                : "Original demo with flat fields, diffMap, and keyMap"}
            </p>
          </Card>

          {/* Content */}
          {activeTab === "nested" ? (
            <NestedFormFields />
          ) : (
            <DemoFormFields options={options} />
          )}
        </div>
      </form>
    </FormProvider>
  );
}
