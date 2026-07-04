import z from "zod";

export const BaseFieldData = z.object({
  // machine key: input name path, answers key, CSV column key, cross-scope
  // merge key. IMMUTABLE once submissions exist — renaming orphans stored
  // answers.
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
});
