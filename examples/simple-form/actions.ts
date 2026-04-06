"use server";

/**
 * Example Next.js Server Action for autosave.
 * In a real app, this would validate input and write to your database.
 */
export async function saveProfile(data: unknown) {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300));

  console.log("Server action received:", data);

  // In production you'd do something like:
  // const validated = profileSchema.parse(data);
  // await db.profile.update({ where: { id: userId }, data: validated });
}
