import { z } from "zod/v4";

export const ActionSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(["primary", "secondary"]).optional(),
});

export const ImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});
