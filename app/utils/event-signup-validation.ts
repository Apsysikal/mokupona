// Legacy signup schemas, kept only as the regression anchor for
// app/features/signup-form/parity.test.ts (its sole consumer).
//
// Review marker (architecture review 2026-07-18): keep this file and the parity
// suite until the signup-form rewrite has ~3 months of production mileage without
// signup regressions (review ~2026-10). Owner: Benedikt. Delete both together.

import { z } from "zod";

export const SignupPersonSchema = z.object({
  name: z.string({ error: "Name is required" }).trim(),
  email: z.email({ error: "Email is required" }),
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
