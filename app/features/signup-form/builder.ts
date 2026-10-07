import { z } from "zod";

import { DEFAULT_FORM } from "./default-form";
import { SignupFormSchema } from "./schema";

import { MAX_FIELD_DESCRIPTION_LENGTH } from "~/features/forms/bounds";
import type { FieldDescriptor } from "~/features/forms/fields";
import { FIELD_KEY_REGEX } from "~/features/forms/fields/base";
import {
  NON_LIST_FIELD_TYPES,
  type NonListFieldDescriptor,
} from "~/features/forms/fields/non-list";

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
  description: z.string().trim().max(MAX_FIELD_DESCRIPTION_LENGTH).optional(),
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
export type BuilderRowInput = z.input<typeof BuilderRowSchema>;
export type BuilderItemRowInput = z.input<typeof BuilderItemRowSchema>;

export const SignupFormBuilderSchema = z
  .array(BuilderRowSchema)
  .superRefine((rows, ctx) => {
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
      const optionsIndex = path.indexOf("options");

      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: optionsIndex === -1 ? path : path.slice(0, optionsIndex + 1),
      });
    }
  });

// An empty description must leave NO key behind. saveFormSchemaInTx compares
// descriptors with isDeepStrictEqual to decide whether to mint a new
// FormVersion, and `{}` is not deep-equal to `{ description: undefined }` — a
// blank textarea that emitted the key would spawn a new version on every save
// of every form. Both conversion directions go through this helper.
function descriptionEntry(description: string | undefined) {
  return description ? { description } : {};
}

function optionsEntry(options: string | undefined) {
  return options ? { options } : {};
}

export const LINKED_ROW_PROPS = [
  "type",
  "label",
  "required",
  "options",
  "description",
] as const;

type LinkedProps = Pick<BuilderItemRow, (typeof LINKED_ROW_PROPS)[number]>;

export function syncLinkedRows(rows: BuilderRow[]): BuilderRow[] {
  const canonical = new Map<string, LinkedProps>();

  const claim = (
    row: BuilderRow | BuilderItemRow,
    type: LinkedProps["type"],
  ): LinkedProps | undefined => {
    const first = canonical.get(row.name);

    if (first !== undefined) return first;

    canonical.set(row.name, {
      type,
      label: row.label,
      required: row.required,
      ...optionsEntry(row.options),
      ...descriptionEntry(row.description),
    });

    return undefined;
  };

  const claimed = rows.map((row): BuilderRow => {
    if (row.type === "list") return row;

    const props = claim(row, row.type);

    return props === undefined ? row : { name: row.name, ...props };
  });

  return claimed.map((row): BuilderRow => {
    if (row.type !== "list" || row.itemFields === undefined) return row;

    return {
      ...row,
      itemFields: row.itemFields.map((item): BuilderItemRow => {
        const props = claim(item, item.type);

        return props === undefined ? item : { name: item.name, ...props };
      }),
    };
  });
}

export function linkedFieldKeys(
  topLevelKeys: Array<string | undefined>,
  itemKeys: Array<string | undefined>,
): Set<string> {
  const asked = new Set(itemKeys);
  const linked = new Set<string>();

  for (const key of topLevelKeys) {
    if (key !== undefined && asked.has(key)) linked.add(key);
  }

  return linked;
}

export function syncChangedFieldKeys(rows: BuilderRow[]): string[] {
  const synced = syncLinkedRows(rows);
  const changed = new Set<string>();

  const compare = (
    before: BuilderRow | BuilderItemRow,
    after: BuilderRow | BuilderItemRow,
  ) => {
    if (LINKED_ROW_PROPS.some((prop) => before[prop] !== after[prop])) {
      changed.add(before.name);
    }
  };

  rows.forEach((row, index) => {
    const syncedRow = synced[index];
    if (row.type === "list") {
      const syncedItems =
        syncedRow.type === "list" ? (syncedRow.itemFields ?? []) : [];
      (row.itemFields ?? []).forEach((item, itemIndex) => {
        const syncedItem = syncedItems[itemIndex];
        if (syncedItem) compare(item, syncedItem);
      });
    } else if (syncedRow.type !== "list") {
      compare(row, syncedRow);
    }
  });

  return [...changed].sort();
}

export function builderRowsToDescriptors(
  rows: BuilderRow[],
): FieldDescriptor[] {
  return syncLinkedRows(rows).map((row): FieldDescriptor => {
    if (row.type === "list") {
      return {
        type: "list",
        version: 1,
        data: {
          name: row.name,
          label: row.label,
          required: false,
          ...descriptionEntry(row.description),
          maxCount: row.maxCount ?? 0,
          addLabel: FRIENDS_ADD_LABEL,
          removeLabel: FRIENDS_REMOVE_LABEL,
          itemFields: (row.itemFields ?? []).map(itemRowToDescriptor),
        },
      };
    }

    return itemRowToDescriptor({
      type: row.type,
      name: row.name,
      label: row.label,
      required: row.required,
      description: row.description,
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
        ...descriptionEntry(row.description),
        options: splitOptions(row.options ?? ""),
      },
    };
  }

  return {
    type: row.type,
    version: 1,
    data: {
      name: row.name,
      label: row.label,
      required: row.required,
      ...descriptionEntry(row.description),
    },
  };
}

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
        ...descriptionEntry(descriptor.data.description),
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
    ...descriptionEntry(descriptor.data.description),
    ...(descriptor.type === "select"
      ? { options: descriptor.data.options.join("\n") }
      : {}),
  };
}

export function defaultBuilderRows(): BuilderRow[] {
  return descriptorsToBuilderRows(DEFAULT_FORM);
}

export function slugifyFieldKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "");

  return slug || "field";
}
