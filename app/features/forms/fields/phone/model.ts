import z from "zod";

import { BaseFieldData } from "../base";

export const PhoneFieldSchema = z.object({
  type: z.literal("phone"),
  version: z.literal(1),
  data: BaseFieldData,
});
