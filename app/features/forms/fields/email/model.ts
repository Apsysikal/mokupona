import z from "zod";

import { BaseFieldData } from "../base";

export const EmailFieldSchema = z.object({
  type: z.literal("email"),
  version: z.literal(1),
  data: BaseFieldData,
});
