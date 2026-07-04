import z from "zod";

import { MAX_SELECT_OPTION_LENGTH, MAX_SELECT_OPTIONS } from "../../bounds";
import { BaseFieldData } from "../base";

export const SelectFieldSchema = z.object({
  type: z.literal("select"),
  version: z.literal(1),
  data: BaseFieldData.extend({
    // option strings double as stored answer values (label === value, v1)
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(MAX_SELECT_OPTION_LENGTH, {
            error: `Options can have at most ${MAX_SELECT_OPTION_LENGTH} characters`,
          })
          // the builder edits options as one-per-line text; an embedded line
          // break would silently split the option on its next round-trip
          .refine((option) => !/[\r\n]/.test(option), {
            error: "Options cannot contain line breaks",
          }),
      )
      .min(1, { error: "A select field needs at least one option" })
      .max(MAX_SELECT_OPTIONS, {
        error: `A select field can have at most ${MAX_SELECT_OPTIONS} options`,
      })
      // options are answer values and rendering keys — duplicates would be
      // indistinguishable choices
      .refine((options) => new Set(options).size === options.length, {
        error: "Options must be unique",
      }),
  }),
});
