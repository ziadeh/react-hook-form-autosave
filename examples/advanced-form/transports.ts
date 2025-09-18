import { Transport } from "react-hook-form-autosave";
import { mockApi } from "./api";

export const createMainTransport =
  (projectId: string): Transport =>
  async (payload, ctx) => {
    try {
      // Remove arrays that are handled by diffMap
      const { tags: _tags, assignees: _assignees, ...rest } = payload as any;

      if (Object.keys(rest).length === 0) {
        return { ok: true }; // Only diff operations, no main payload
      }

      await mockApi.updateProject(projectId, rest);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

export const createAnalyticsTransport = (): Transport => async (payload) => {
  try {
    await mockApi.logAnalytics(payload);
    return { ok: true };
  } catch (error) {
    // Analytics failure shouldn't fail the main save
    console.warn("Analytics failed:", error);
    return { ok: true };
  }
};
