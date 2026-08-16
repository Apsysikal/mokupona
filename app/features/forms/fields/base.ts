import z from "zod";

import { MAX_FIELD_DESCRIPTION_LENGTH } from "../bounds";

export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export const BaseFieldData = z.object({
  name: z.string().regex(FIELD_KEY_REGEX),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  description: z.string().trim().max(MAX_FIELD_DESCRIPTION_LENGTH).optional(),
});
