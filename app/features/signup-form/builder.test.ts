import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
  linkedFieldKeys,
  SignupFormBuilderSchema,
  slugifyFieldKey,
  syncChangedFieldKeys,
  syncLinkedRows,
} from "./builder";
import type { BuilderItemRow, BuilderRow } from "./builder";
import { DEFAULT_FORM } from "./default-form";

import { MAX_FIELD_DESCRIPTION_LENGTH } from "~/features/forms/bounds";

function friendsRow(itemFields: BuilderItemRow[]): BuilderRow {
  return {
    type: "list",
    name: "friends",
    label: "Friends",
    required: false,
    maxCount: 3,
    itemFields,
  };
}

function itemFieldsOf(rows: BuilderRow[]): BuilderItemRow[] {
  return rows.find((row) => row.type === "list")?.itemFields ?? [];
}

describe("builder row transforms", () => {
  it("round-trips DEFAULT_FORM exactly (deep-equal skip must keep working)", () => {
    const rows = descriptorsToBuilderRows(DEFAULT_FORM);

    expect(builderRowsToDescriptors(rows)).toEqual(DEFAULT_FORM);
  });

  it("round-trips a select field's one-per-line options", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: true,
        options: "Meat\nVegan",
      },
    ];

    const descriptors = builderRowsToDescriptors(rows);

    expect(descriptors.at(-1)).toEqual({
      type: "select",
      version: 1,
      data: {
        name: "menu",
        label: "Menu choice",
        required: true,
        options: ["Meat", "Vegan"],
      },
    });
    expect(descriptorsToBuilderRows(descriptors)).toEqual(rows);
    expect(SignupFormBuilderSchema.safeParse(rows).success).toBe(true);
  });

  it("rejects duplicate select options, anchored on the options field", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: false,
        options: "Meat\nMeat ",
      },
    ];

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("unique"),
    );
    expect(issue?.path).toEqual([rows.length - 1, "options"]);
  });

  it("rejects a select field without options, with the issue on the row", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: false,
        options: "",
      },
    ];

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("at least one option"),
    );
    expect(issue?.path).toEqual([rows.length - 1, "options"]);
  });

  it("maps custom rows to versioned descriptors", () => {
    const descriptors = builderRowsToDescriptors([
      { type: "checkbox", name: "newsletter", label: "News?", required: true },
    ]);

    expect(descriptors).toEqual([
      {
        type: "checkbox",
        version: 1,
        data: { name: "newsletter", label: "News?", required: true },
      },
    ]);
  });
});

describe("SignupFormBuilderSchema", () => {
  it("accepts the default rows", () => {
    const result = SignupFormBuilderSchema.safeParse(defaultBuilderRows());

    expect(result.success).toBe(true);
  });

  it("rejects duplicate field keys with the issue on the row", () => {
    const rows = defaultBuilderRows();
    rows.push({
      type: "text",
      name: "email",
      label: "Second email",
      required: false,
    });

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("Duplicate"),
    );
    expect(issue?.path).toEqual([rows.length - 1]);
  });

  it("rejects removing the pinned identity fields", () => {
    const rows = defaultBuilderRows().filter((row) => row.name !== "email");

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
  });

  it("rejects a missing friend count instead of silently disabling friends", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list" ? { ...row, maxCount: undefined } : row,
    );

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("Friend count is required"),
    );
    expect(issue?.path?.at(-1)).toBe("maxCount");
  });

  it("rejects a friends count above the profile ceiling", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list" ? { ...row, maxCount: 11 } : row,
    );

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
  });
});

describe("syncLinkedRows", () => {
  it("copies the signer row's linked props onto the friend's copy", () => {
    const rows = [
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: true,
        description: "Pick one",
        options: "Meat\nVegan",
      },
      friendsRow([
        { type: "text", name: "menu", label: "Their menu", required: false },
      ]),
    ];

    expect(itemFieldsOf(syncLinkedRows(rows))).toEqual([
      {
        type: "select",
        name: "menu",
        label: "Menu choice",
        required: true,
        description: "Pick one",
        options: "Meat\nVegan",
      },
    ]);
  });

  it("never links the friends list on its own name", () => {
    const rows = [
      {
        type: "text" as const,
        name: "friends",
        label: "Best friend",
        required: false,
      },
      friendsRow([
        { type: "text", name: "name", label: "Name", required: true },
      ]),
    ];

    const synced = syncLinkedRows(rows);

    expect(synced[0]).toEqual(rows[0]);
    expect(synced[1]).toEqual(rows[1]);
  });

  it("leaves a key that only exists in itemFields untouched", () => {
    const seat: BuilderItemRow = {
      type: "select",
      name: "seat",
      label: "Seat",
      required: false,
      options: "Aisle\nWindow",
    };
    const rows = [
      { type: "text" as const, name: "name", label: "Name", required: true },
      friendsRow([
        { type: "text", name: "name", label: "Name", required: true },
        seat,
      ]),
    ];

    expect(isDeepStrictEqual(itemFieldsOf(syncLinkedRows(rows))[1], seat)).toBe(
      true,
    );
  });

  it("mirrors the first of two itemFields sharing a key, duplicate and all", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list"
        ? {
            ...row,
            itemFields: [
              ...(row.itemFields ?? []),
              {
                type: "select" as const,
                name: "seat",
                label: "Seat",
                required: false,
                options: "Aisle\nWindow",
              },
              {
                type: "text" as const,
                name: "seat",
                label: "Where?",
                required: true,
              },
            ],
          }
        : row,
    );

    const itemFields = itemFieldsOf(syncLinkedRows(rows));

    expect(itemFields.at(-1)).toEqual({
      type: "select",
      name: "seat",
      label: "Seat",
      required: false,
      options: "Aisle\nWindow",
    });

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes('Duplicate field name "seat"'),
    );
    expect(issue?.path).toEqual([
      rows.findIndex((row) => row.type === "list"),
      "itemFields",
      itemFields.length - 1,
    ]);
  });

  it("drops options and description the signer row does not have", () => {
    const rows = [
      {
        type: "text" as const,
        name: "menu",
        label: "Menu choice",
        required: false,
      },
      friendsRow([
        {
          type: "select",
          name: "menu",
          label: "Menu choice",
          required: false,
          description: "Pick one",
          options: "Meat\nVegan",
        },
      ]),
    ];

    const [mirrored] = itemFieldsOf(syncLinkedRows(rows));

    expect("options" in mirrored).toBe(false);
    expect("description" in mirrored).toBe(false);
    expect(
      isDeepStrictEqual(mirrored, {
        type: "text",
        name: "menu",
        label: "Menu choice",
        required: false,
      }),
    ).toBe(true);
  });

  it("is idempotent", () => {
    const rows = [
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: true,
        options: "Meat\nVegan",
      },
      {
        type: "text" as const,
        name: "comment",
        label: "Note",
        required: false,
      },
      friendsRow([
        {
          type: "text",
          name: "menu",
          label: "Their menu",
          required: false,
          description: "Stale",
        },
        { type: "text", name: "seat", label: "Seat", required: false },
      ]),
    ];

    const once = syncLinkedRows(rows);

    expect(isDeepStrictEqual(syncLinkedRows(once), once)).toBe(true);
  });

  it("normalizes on the way to descriptors, so persistence cannot drift", () => {
    const rows = [
      {
        type: "checkbox" as const,
        name: "vegetarian",
        label: "Vegan / Vegetarian",
        required: false,
        description: "Ticked means no meat",
      },
      friendsRow([
        { type: "text", name: "vegetarian", label: "Veggie?", required: true },
      ]),
    ];

    expect(builderRowsToDescriptors(rows).at(-1)).toEqual({
      type: "list",
      version: 1,
      data: {
        name: "friends",
        label: "Friends",
        required: false,
        maxCount: 3,
        addLabel: "Add a friend",
        removeLabel: "Remove this person",
        itemFields: [
          {
            type: "checkbox",
            version: 1,
            data: {
              name: "vegetarian",
              label: "Vegan / Vegetarian",
              required: false,
              description: "Ticked means no meat",
            },
          },
        ],
      },
    });
  });

  it("accepts a signer/friend type mismatch that the cross-scope check used to reject", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list"
        ? {
            ...row,
            itemFields: (row.itemFields ?? []).map((item) =>
              item.name === "vegetarian"
                ? { ...item, type: "text" as const }
                : item,
            ),
          }
        : row,
    );

    expect(SignupFormBuilderSchema.safeParse(rows).success).toBe(true);
    expect(
      itemFieldsOf(syncLinkedRows(rows)).find(
        (item) => item.name === "vegetarian",
      )?.type,
    ).toBe("checkbox");
  });
});

describe("syncChangedFieldKeys", () => {
  it("reports nothing when every pair already agrees", () => {
    expect(syncChangedFieldKeys(defaultBuilderRows())).toEqual([]);
  });

  it("names the keys whose rows the sync would rewrite", () => {
    const rows = [
      {
        type: "text" as const,
        name: "restrictions",
        label: "Dietary restrictions",
        required: false,
      },
      friendsRow([
        {
          type: "text",
          name: "restrictions",
          label: "Their restrictions",
          required: true,
        },
        { type: "text", name: "nickname", label: "Nickname", required: false },
      ]),
    ];

    expect(syncChangedFieldKeys(rows)).toEqual(["restrictions"]);
  });
});

describe("linkedFieldKeys", () => {
  it("links only the keys asked in both scopes", () => {
    expect(
      linkedFieldKeys(
        ["name", "friends", "comment", undefined],
        ["name", "seat", undefined],
      ),
    ).toEqual(new Set(["name"]));
  });

  it("finds the pairs DEFAULT_FORM ships", () => {
    const rows = defaultBuilderRows();

    expect(
      linkedFieldKeys(
        rows.filter((row) => row.type !== "list").map((row) => row.name),
        itemFieldsOf(rows).map((item) => item.name),
      ),
    ).toEqual(new Set(["name", "vegetarian", "student", "restrictions"]));
  });
});

describe("description round-trip", () => {
  // saveFormSchemaInTx decides whether to mint a new FormVersion with
  // isDeepStrictEqual, which — unlike vitest's toEqual — treats an absent key
  // and an undefined-valued key as different. These assertions must use it, or
  // they would pass while every save of every legacy form spawned a version.
  it("leaves no description key when the builder textarea is empty", () => {
    for (const empty of [undefined, "", "   "]) {
      const rows = defaultBuilderRows().map((row) => ({
        ...row,
        description: empty,
      }));

      const descriptors = builderRowsToDescriptors(
        SignupFormBuilderSchema.parse(rows),
      );

      expect(
        descriptors.every((d) => !("description" in d.data)),
        `empty description ${JSON.stringify(empty)} left a key behind`,
      ).toBe(true);
    }
  });

  it("round-trips DEFAULT_FORM under isDeepStrictEqual, not just toEqual", () => {
    const rows = descriptorsToBuilderRows(DEFAULT_FORM);

    expect(
      isDeepStrictEqual(builderRowsToDescriptors(rows), DEFAULT_FORM),
    ).toBe(true);
  });

  it("carries a description both ways for fields and lists", () => {
    const descriptors = DEFAULT_FORM.map((descriptor) => ({
      ...descriptor,
      data: {
        ...descriptor.data,
        description: `About ${descriptor.data.name}`,
        ...(descriptor.type === "list"
          ? {
              itemFields: descriptor.data.itemFields.map((item) => ({
                ...item,
                data: {
                  ...item.data,
                  description: `About ${item.data.name}`,
                },
              })),
            }
          : {}),
      },
    })) as typeof DEFAULT_FORM;

    const rows = descriptorsToBuilderRows(descriptors);

    expect(rows.every((row) => row.description?.startsWith("About "))).toBe(
      true,
    );
    expect(isDeepStrictEqual(builderRowsToDescriptors(rows), descriptors)).toBe(
      true,
    );
  });

  it("reports an over-long description on the row that owns it", () => {
    const rows = defaultBuilderRows().map((row, index) =>
      index === 0
        ? { ...row, description: "x".repeat(MAX_FIELD_DESCRIPTION_LENGTH + 1) }
        : row,
    );

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find(
      (candidate) => candidate.path.at(-1) === "description",
    );
    // the "data" segment is stripped so the path addresses the builder row
    expect(issue?.path).toEqual([0, "description"]);
  });
});

describe("slugifyFieldKey", () => {
  it.each([
    ["Dietary restrictions", "dietary_restrictions"],
    ["  T-Shirt size!  ", "t_shirt_size"],
    ["2nd choice", "nd_choice"],
    ["🎉🎉", "field"],
  ])("derives %j -> %j", (label, expected) => {
    expect(slugifyFieldKey(label)).toBe(expected);
  });
});
