import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().max(500, "Description too long"),
  status: z.enum(["draft", "active", "completed"]),
  priority: z.enum(["low", "medium", "high"]),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        color: z.string(),
      })
    )
    .default([]),
  assignees: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      })
    )
    .default([]),
  budget: z.number().optional(),
  deadline: z.string().optional(),
  settings: z.object({
    notifications: z.boolean().default(true),
    publicVisible: z.boolean().default(false),
  }),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}
