import { z } from "zod";

export type IdLabel = { id: number; label: string };

// Nested field schemas
const ProfileSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  bio: z.string().min(5),
  email: z.string().email(),
});

const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
});

const SocialLinksSchema = z.object({
  github: z.string().url().optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  twitter: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

const SettingsSchema = z.object({
  notifications: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

const TeamMemberSchema = z.object({
  id: z.number(),
  name: z.string().min(2),
  role: z.string(),
  email: z.string().email().optional().or(z.literal("")),
});

export const FormDataSchema = z.object({
  // Nested profile object (NEW!)
  profile: ProfileSchema,

  // Nested address (NEW!)
  address: AddressSchema.optional(),

  // Nested social links (NEW!)
  socialLinks: SocialLinksSchema.optional(),

  // Nested settings (NEW!)
  settings: SettingsSchema.optional(),

  // Array of nested objects (NEW!)
  teamMembers: z.array(TeamMemberSchema).optional(),

  // Legacy fields (kept for backwards compatibility)
  skills: z.array(z.object({ id: z.number() })).min(1, {
    message: "At least one skill is required",
  }),

  role: z.enum(["developer", "designer", "manager", "other"]).optional(),

  yearsOfExperience: z.number().min(0).max(50).optional(),

  availableFrom: z.string().optional(),

  hobbies: z.array(z.string()).optional(),

  // Internal field
  isAnyInputFocused: z.boolean().optional(),
});

export type FormData = z.infer<typeof FormDataSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type SocialLinks = z.infer<typeof SocialLinksSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;

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
