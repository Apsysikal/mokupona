import { z } from "zod";

export const PersonSchema = z.object({
  name: z.string({ error: "Name is required" }).trim(),
  alternativeMenu: z.boolean().default(false),
  student: z.boolean().default(false),
  dietaryRestrictions: z.string().trim().optional(),
});

export const SignupPersonSchema = PersonSchema.extend({
  email: z.email({ error: "Email is required" }),
  phone: z.string({ error: "Phone number is required" }).trim(),
});
