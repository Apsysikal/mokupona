import z from "zod";
import { BaseFieldData } from "../base";

export const CheckboxFieldSchema = z.object({
  type: z.literal("checkbox"),
  version: z.literal(1),
  data: BaseFieldData,
});
