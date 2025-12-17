"use client";

import { useFormData } from "@/hooks/useFormData";
import React, { useState } from "react";
import { FormProvider } from "react-hook-form";
import { DemoFormFields } from "./DemoFormFields";
import { DemoHeader } from "./DemoHeader";
import { NestedFormFields } from "./NestedFormFields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const { form, options, autosave } = useFormData();
  const [activeTab, setActiveTab] = useState<"nested" | "legacy">("nested");

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
