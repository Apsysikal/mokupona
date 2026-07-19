import { parseWithZod } from "@conform-to/zod/v4";
import { z } from "zod";

/** The shared conform action prologue: read the form data and parse it. */
export async function parseRequestForm<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
) {
  return parseWithZod(await request.formData(), { schema });
}

export const displayNameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required");

export const emailSchema = z.email({ error: "Email is required" });
