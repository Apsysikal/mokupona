import z from "zod";

// The one definition of a valid machine key; consumers (e.g. the builder's
// row schema) import it instead of restating the rule.
export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export const BaseFieldData = z.object({
  // machine key: input name path, answers key, CSV column key, cross-scope
  // merge key. IMMUTABLE once submissions exist — renaming orphans stored
  // answers.
  name: z.string().regex(FIELD_KEY_REGEX),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
});
