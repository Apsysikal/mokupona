import z from "zod";

import { MAX_FIELD_DESCRIPTION_LENGTH } from "../bounds";

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
  // Optional helper text shown to guests under the label. Purely
  // informational: it never reaches validation, answers, or CSV columns.
  //
  // `.optional()` and deliberately NOT `.default("")` — saveFormSchemaInTx
  // decides whether to mint a new FormVersion with isDeepStrictEqual, which
  // distinguishes an absent key from an empty one. A default would make every
  // pre-existing form look changed on its next save. Writers must omit the
  // key entirely when there is no description.
  description: z.string().trim().max(MAX_FIELD_DESCRIPTION_LENGTH).optional(),
});
