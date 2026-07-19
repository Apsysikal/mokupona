import { z } from "zod";

export const displayNameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required");

export const emailSchema = z.email({ error: "Email is required" });
