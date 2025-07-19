import { z } from "zod";

export const SignupPersonSchema = z.object({
  name: z.string({ error: "Name is required" }).trim(),
  email: z.string({ error: "Email is required" }).email("Invalid email").trim(),
  phone: z.string({ error: "Phone number is required" }).trim(),
  alternativeMenu: z.boolean().default(false),
  student: z.boolean().default(false),
  dietaryRestrictions: z.string().trim().optional(),
});

export const PersonSchema = z.object({
  name: z.string({ error: "Name is required" }).trim(),
  alternativeMenu: z.boolean().default(false),
  student: z.boolean().default(false),
  dietaryRestrictions: z.string().trim().optional(),
});
