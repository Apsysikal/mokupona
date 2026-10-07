import z from "zod";

import { MAX_LIST_COUNT } from "../../bounds";
import { BaseFieldData } from "../base";
import { NonListFieldDescriptorSchema } from "../non-list";

export const ListFieldSchema = z.object({
  type: z.literal("list"),
  version: z.literal(1),
  data: BaseFieldData.extend({
    maxCount: z.number().int().min(0).max(MAX_LIST_COUNT),
    addLabel: z.string().trim().min(1),
    removeLabel: z.string().trim().min(1),
    itemFields: z.array(NonListFieldDescriptorSchema).min(1),
  }),
});
