import z from "zod";

import { BaseFieldData } from "../base";

export const TextFieldSchema = z.object({
  type: z.literal("text"),
  version: z.literal(1),
  data: BaseFieldData,
});
