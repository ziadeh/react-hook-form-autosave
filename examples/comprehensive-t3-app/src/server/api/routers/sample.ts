import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  type FormData,
  FormDataUpdateSchema,
  type IdLabel,
} from "@/types/formData.type";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const formData: FormData = {
  fullName: "John Smith",
  email: "mail@domain.com",
  skills: [],
  bio: "This is a sample bio",
  role: undefined,
  notifications: false,
  newsletter: false,
  yearsOfExperience: undefined,
  availableFrom: undefined,
  country: undefined,
  hobbies: [],
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
  getData: publicProcedure.input(z.object({ id: z.string() })).query(() => {
    sleep(500);
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

      // Log keyMap transformation
      if ("country_code" in updateData) {
        console.log("✨ keyMap transformation detected:");
        console.log("  Frontend field: 'country'");
        console.log(
          "  Backend received: 'country_code' =",
          updateData.country_code,
        );
      }

      console.log("📦 Full update payload:", updateData);
      sleep(500);
      // throw new Error("errorMessage");
      return { id, ...updateData };
    }),
  getSkillsOptions: publicProcedure.query(() => {
    return skillsOptions;
  }),
  addSkill: publicProcedure
    .input(SkillInputSchema)
    .mutation(async ({ input }) => {
      try {
        sleep(500);
        // throw new Error("errorMessage");
        return { ok: true };
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Failed to add skill";
        throw new Error(errorMessage);
      }
    }),
  removeSkill: publicProcedure
    .input(SkillInputSchema)
    .mutation(async ({ input }) => {
      try {
        sleep(500);
        // throw new Error("errorMessage");
        return { ok: true };
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Failed to remove skill";
        throw new Error(errorMessage);
      }
    }),
});
