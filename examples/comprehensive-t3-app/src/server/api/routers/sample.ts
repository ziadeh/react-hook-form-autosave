import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  type FormData,
  FormDataUpdateSchema,
  type IdLabel,
} from "@/types/formData.type";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const formData: FormData = {
  profile: {
    firstName: "John",
    lastName: "Smith",
    email: "mail@domain.com",
    bio: "This is a sample bio with nested fields!",
  },
  address: {
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    country: "United States",
  },
  socialLinks: {
    github: "https://github.com/johndoe",
    linkedin: "https://linkedin.com/in/johndoe",
    twitter: "",
    website: "",
  },
  settings: {
    notifications: true,
    newsletter: false,
    theme: "dark",
  },
  teamMembers: [
    {
      id: 1,
      name: "Alice Johnson",
      role: "Lead Developer",
      email: "alice@example.com",
    },
    {
      id: 2,
      name: "Bob Williams",
      role: "Designer",
      email: "bob@example.com",
    },
  ],
  skills: [],
  role: "developer",
  yearsOfExperience: 5,
  availableFrom: undefined,
  hobbies: ["coding", "reading"],
  isAnyInputFocused: false,
};

const skillsOptions: IdLabel[] = [
  { id: 1, label: "JavaScript" },
  { id: 2, label: "TypeScript" },
  { id: 3, label: "React" },
  { id: 4, label: "Node.js" },
];

export const SkillInputSchema = z.object({
  userId: z.number(),
  skillId: z.number(),
});

function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export const sampleRouter = createTRPCRouter({
  getData: publicProcedure.input(z.object({ id: z.string() })).query(async () => {
    await sleep(500);
    return formData;
  }),
  updateForm: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: FormDataUpdateSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const { id, data } = input;
      const updateData = pruneUndefined(data);

      // Log nested field transformations
      console.log("📦 Full update payload:", updateData);
      
      // Check for mapNestedKeys transformations
      if ("first_name" in updateData) {
        console.log("✨ Nested key transformation detected:");
        console.log("  Frontend: profile.firstName → Backend: first_name");
      }
      if ("email_address" in updateData) {
        console.log("✨ Nested key transformation detected:");
        console.log("  Frontend: profile.email → Backend: email_address");
      }
      if ("address" in updateData && typeof updateData.address === "object") {
        const addr = updateData.address as Record<string, unknown>;
        if ("postal_code" in addr) {
          console.log("✨ Nested key transformation detected:");
          console.log("  Frontend: address.zipCode → Backend: address.postal_code");
        }
      }
      await sleep(500);
      // throw new Error("errorMessage");
      return { id, ...updateData };
    }),
  getSkillsOptions: publicProcedure.query(() => {
    return skillsOptions;
  }),
  addSkill: publicProcedure
    .input(SkillInputSchema)
    .mutation(async () => {
      try {
        await sleep(500);
        // throw new Error("errorMessage");
        return { ok: true };
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to add skill";
        throw new Error(errorMessage);
      }
    }),
  removeSkill: publicProcedure
    .input(SkillInputSchema)
    .mutation(async () => {
      try {
        await sleep(500);
        // throw new Error("errorMessage");
        return { ok: true };
      } catch (error: unknown) {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to remove skill";
        throw new Error(errorMessage);
      }
    }),
});
