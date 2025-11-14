import { z } from "zod";

export type IdLabel = { id: number; label: string };

export const FormDataSchema = z.object({
  // Basic text fields
  fullName: z.string().min(5),
  email: z.string().email(),
  bio: z.string().min(5),

  // Array field with diffMap
  skills: z.array(z.object({ id: z.number() })).min(1, {
    message: "At least one skill is required",
  }),

  // Radio button
  role: z.enum(["developer", "designer", "manager", "other"]).optional(),

  // Checkboxes
  notifications: z.boolean().optional(),
  newsletter: z.boolean().optional(),

  // Number field
  yearsOfExperience: z.number().min(0).max(50).optional(),

  // Date field (stored as string)
  availableFrom: z.string().optional(),

  // Select field with keyMap example
  country: z.string().optional(),

  // Multi-line array (not diffMap)
  hobbies: z.array(z.string()).optional(),

  // Internal field
  isAnyInputFocused: z.boolean().optional(),
});

export type FormData = z.infer<typeof FormDataSchema>;

// Schema for updates - accepts both original fields and transformed fields (via keyMap)
export const FormDataUpdateSchema = FormDataSchema.partial()
  .extend({
    // Accept country_code (transformed from country via keyMap)
    country_code: z.string().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Provide at least one field to update",
  });

export type formOptions = {
  skillsOptions?: { id: number; label: string }[];
};
