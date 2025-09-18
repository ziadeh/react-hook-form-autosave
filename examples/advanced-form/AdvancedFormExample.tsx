import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, ProjectFormData } from "./types";
import { defaultFormValues } from "./constants";
import { useAutosaveConfig } from "./hooks/useAutosaveConfig";
import { AutosaveStatus } from "./components/AutosaveStatus";
import { TagsSection } from "./components/TagsSection";
import { DebugPanel } from "./components/DebugPanel";

export function AdvancedFormExample() {
  const [projectId] = useState("project-123");
  const [showMetrics, setShowMetrics] = useState(false);

  // Initialize form
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: defaultFormValues,
    mode: "onChange",
  });

  // Configure autosave
  const autosave = useAutosaveConfig(form, projectId);

  const currentValues = form.watch();
  const pendingChanges = autosave.getPendingChanges();

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>

        <AutosaveStatus
          isSaving={autosave.isSaving}
          lastError={autosave.lastError}
          onShowMetrics={() => setShowMetrics(!showMetrics)}
          showMetrics={showMetrics}
        />
      </div>

      {/* Error Display */}
      {autosave.lastError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">
            <strong>Error:</strong> {autosave.lastError.message}
          </p>
          <button
            onClick={autosave.flush}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Retry Save
          </button>
        </div>
      )}

      <form className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title *
            </label>
            <input
              {...form.register("title")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter project title"
            />
            {form.formState.errors.title && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              {...form.register("status")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            {...form.register("description")}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Project description..."
          />
          {form.formState.errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              {...form.register("priority")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget ($)
            </label>
            <input
              {...form.register("budget", { valueAsNumber: true })}
              type="number"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Tags Section */}
        <TagsSection
          currentTags={currentValues.tags}
          setValue={form.setValue}
        />

        {/* Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                {...form.register("settings.notifications")}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Enable notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                {...form.register("settings.publicVisible")}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Make project publicly visible
              </span>
            </label>
          </div>
        </div>
      </form>

      {/* Debug Panel */}
      {showMetrics && (
        <DebugPanel
          form={form}
          config={autosave.config}
          pendingChanges={pendingChanges}
          isEmpty={autosave.isEmpty}
          getMetrics={autosave.getMetrics}
          flush={autosave.flush}
          abort={autosave.abort}
        />
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">🎯 Try This Demo:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Type in the title field - autosave triggers after 800ms</li>
          <li>• Add/remove tags to see diffMap in action</li>
          <li>• Toggle the metrics panel to see performance data</li>
          <li>• Watch the console for detailed logging</li>
          <li>• Try the Force Save and Abort buttons</li>
        </ul>
      </div>
    </div>
  );
}
