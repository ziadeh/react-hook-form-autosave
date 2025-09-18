export const mockApi = {
  updateProject: async (id: string, data: any) => {
    console.log(`🌐 Updating project ${id}:`, data);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 1000 + 500)
    );

    // Simulate occasional failures for demo
    if (Math.random() < 0.1) {
      throw new Error("Network error - please try again");
    }

    return { success: true, updatedAt: new Date().toISOString() };
  },

  addTag: async (tag: any) => {
    console.log("🏷️ Adding tag:", tag);
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  removeTag: async (tag: any) => {
    console.log("🗑️ Removing tag:", tag);
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  assignUser: async (user: any) => {
    console.log("👤 Assigning user:", user);
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  unassignUser: async (user: any) => {
    console.log("👤 Unassigning user:", user);
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  logAnalytics: async (payload: any) => {
    console.log("📊 Analytics logged:", Object.keys(payload));
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
