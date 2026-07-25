import { z } from "zod";

import { DEFAULT_FORM } from "./default-form";
import { SignupFormSchema } from "./schema";

import type { FieldDescriptor } from "~/features/forms/fields";
import { FIELD_KEY_REGEX } from "~/features/forms/fields/base";
import {
  NON_LIST_FIELD_TYPES,
  type NonListFieldDescriptor,
} from "~/features/forms/fields/non-list";

// The admin builder's value model: one flat row shape for every field so
// Conform's field arrays need no union handling. `maxCount`/`itemFields`
// only carry data for the pinned friends list row; the profile rules run on
// the transformed descriptors via SignupFormSchema, so builder and public
// endpoint can never disagree.

// Button labels are not exposed in the builder (v1); they stay DEFAULT_FORM's.
const FRIENDS_ADD_LABEL = "Add a friend";
const FRIENDS_REMOVE_LABEL = "Remove this person";

const FIELD_KEY_ERROR =
  "Field keys start with a letter and contain only lowercase letters, digits and underscores";

const BuilderItemRowSchema = z.object({
  type: z.enum(NON_LIST_FIELD_TYPES, { error: "Choose a field type" }),
  name: z
    .string({ error: "Field key is required" })
    .regex(FIELD_KEY_REGEX, { error: FIELD_KEY_ERROR }),
  label: z.string({ error: "Label is required" }).trim().min(1),
  required: z.boolean().default(false),
  // select only: one option per line; SelectFieldSchema bounds the parsed
  // list via the profile validation below
  options: z.string().optional(),
});

const BuilderRowSchema = BuilderItemRowSchema.extend({
  type: z.enum([...NON_LIST_FIELD_TYPES, "list"], {
    error: "Choose a field type",
  }),
  maxCount: z
    .number({ error: "Friend count must be a number" })
    .int()
    .optional(),
  itemFields: z.array(BuilderItemRowSchema).optional(),
});

export type BuilderRow = z.infer<typeof BuilderRowSchema>;
export type BuilderItemRow = z.infer<typeof BuilderItemRowSchema>;
// the pre-coercion shapes Conform's field metadata carries
export type BuilderRowInput = z.input<typeof BuilderRowSchema>;
export type BuilderItemRowInput = z.input<typeof BuilderItemRowSchema>;

// Rows validate by transforming to descriptors and running the same profile
// schema the server persists with; issue paths are mapped back onto the rows
// (descriptor paths carry an extra "data" segment).
export const SignupFormBuilderSchema = z
  .array(BuilderRowSchema)
  .superRefine((rows, ctx) => {
    // maxCount is optional in the shared row shape (non-list rows have none)
    // but a list row must state it — a cleared input must not silently
    // become "friends disabled"
    for (const [index, row] of rows.entries()) {
      if (row.type === "list" && row.maxCount === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Friend count is required (0 disables friends)",
          path: [index, "maxCount"],
        });
      }
    }

    const result = SignupFormSchema.safeParse(builderRowsToDescriptors(rows));

    for (const issue of result.success ? [] : result.error.issues) {
      const path = issue.path.filter((segment) => segment !== "data");
      // per-element option issues ([i, "options", 3]) have no rendered field;
      // collapse them onto the row's options textarea
      const optionsIndex = path.indexOf("options");

      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: optionsIndex === -1 ? path : path.slice(0, optionsIndex + 1),
      });
    }
  });

export function builderRowsToDescriptors(
  rows: BuilderRow[],
): FieldDescriptor[] {
  return rows.map((row): FieldDescriptor => {
    if (row.type === "list") {
      return {
        type: "list",
        version: 1,
        data: {
          name: row.name,
          label: row.label,
          required: false,
          maxCount: row.maxCount ?? 0,
          addLabel: FRIENDS_ADD_LABEL,
          removeLabel: FRIENDS_REMOVE_LABEL,
          itemFields: (row.itemFields ?? []).map(itemRowToDescriptor),
        },
      };
    }

    // row.type is narrowed past "list" here, but the object type is not —
    // rebuild the item row explicitly
    return itemRowToDescriptor({
      type: row.type,
      name: row.name,
      label: row.label,
      required: row.required,
      options: row.options,
    });
  });
}

function itemRowToDescriptor(row: BuilderItemRow): NonListFieldDescriptor {
  if (row.type === "select") {
    return {
      type: "select",
      version: 1,
      data: {
        name: row.name,
        label: row.label,
        required: row.required,
        options: splitOptions(row.options ?? ""),
      },
    };
  }

  return {
    type: row.type,
    version: 1,
    data: { name: row.name, label: row.label, required: row.required },
  };
}

// The builder edits options as one-per-line text; descriptors store them as
// an array. Options are trimmed and non-empty, so the mapping round-trips.
function splitOptions(text: string): string[] {
  return text
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function descriptorsToBuilderRows(
  descriptors: FieldDescriptor[],
): BuilderRow[] {
  return descriptors.map((descriptor): BuilderRow => {
    if (descriptor.type === "list") {
      return {
        type: "list",
        name: descriptor.data.name,
        label: descriptor.data.label,
        required: false,
        maxCount: descriptor.data.maxCount,
        itemFields: descriptor.data.itemFields.map(descriptorToItemRow),
      };
    }

    return descriptorToItemRow(descriptor);
  });
}

function descriptorToItemRow(
  descriptor: NonListFieldDescriptor,
): BuilderItemRow {
  return {
    type: descriptor.type,
    name: descriptor.data.name,
    label: descriptor.data.label,
    required: descriptor.data.required,
    ...(descriptor.type === "select"
      ? { options: descriptor.data.options.join("\n") }
      : {}),
  };
}

export function defaultBuilderRows(): BuilderRow[] {
  return descriptorsToBuilderRows(DEFAULT_FORM);
}

// "Field key" values are machine keys; new fields derive one from the label.
export function slugifyFieldKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "");

  return slug || "field";
}
