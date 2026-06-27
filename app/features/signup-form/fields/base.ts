import z from "zod";

export const BaseFieldData = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  scope: z.enum(["primary", "per-attendee", "group"]).default("primary"),
});
