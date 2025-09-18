import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  useRhfAutosave,
  composeTransports,
  withRetry,
} from "react-hook-form-autosave";
import { ProjectFormData } from "../types";
import { createMainTransport, createAnalyticsTransport } from "../transports";
import { mockApi } from "../api";

export function useAutosaveConfig(
  form: UseFormReturn<ProjectFormData>,
  projectId: string
) {
  // Create composed transport
  const composedTransport = composeTransports(
    withRetry(createMainTransport(projectId), {
      maxRetries: 3,
      baseDelayMs: 1000,
    }),
    createAnalyticsTransport()
  );

  // Configure autosave
  const autosaveResult = useRhfAutosave({
    form: form as any, // Type assertion to bypass strict type checking
    transport: composedTransport,
    config: {
      debounceMs: 800,
      maxRetries: 3,
      enableMetrics: true,
      enableCache: true,
      cacheSize: 50,
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      enableDebugLogs: process.env.NODE_ENV === "development",
    },
    shouldSave: ({ isDirty, isValid, values }) => {
      return isDirty && isValid && values.title.length >= 3;
    },
    keyMap: {
      priority: ["priority_level", (val) => val.toUpperCase()],
      budget: ["budget_cents", (val) => (val ? Math.round(val * 100) : null)],
    },
    diffMap: {
      tags: {
        idOf: (tag) => tag.id,
        onAdd: mockApi.addTag,
        onRemove: mockApi.removeTag,
      },
      assignees: {
        idOf: (user) => user.id,
        onAdd: mockApi.assignUser,
        onRemove: mockApi.unassignUser,
      },
    },
    validateBeforeSave: "payload",
    onSaved: (result, payload) => {
      if (result.ok) {
        console.log("✅ Successfully saved:", Object.keys(payload));
        form.reset(form.getValues(), {
          keepValues: true,
          keepDirty: false,
        });
      } else {
        console.error("❌ Save failed:", result.error?.message);
      }
    },
  });

  // Monitor metrics
  useEffect(() => {
    if (!autosaveResult.config.enableMetrics) return;

    const interval = setInterval(() => {
      const metrics = autosaveResult.getMetrics();
      const cacheStats = autosaveResult.getCacheStats();

      console.log("📊 Autosave Metrics:", {
        saves: `${metrics.successfulSaves}/${metrics.totalSaves}`,
        successRate: `${Math.round(
          (metrics.successfulSaves / metrics.totalSaves) * 100
        )}%`,
        avgTime: `${Math.round(metrics.averageSaveTime)}ms`,
        cacheHits: cacheStats.validationCacheSize,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [
    autosaveResult.config.enableMetrics,
    autosaveResult.getMetrics,
    autosaveResult.getCacheStats,
  ]);

  return autosaveResult;
}
