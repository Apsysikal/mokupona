import z from "zod";
import { BaseFieldData } from "../base";

export const TextareaFieldSchema = z.object({
  type: z.literal("textarea"),
  version: z.literal(1),
  data: BaseFieldData,
});
