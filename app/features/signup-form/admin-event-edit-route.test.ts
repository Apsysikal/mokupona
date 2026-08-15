import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { defaultBuilderRows } from "./builder";
import type { BuilderItemRow, BuilderRow } from "./builder";

import { prisma } from "~/db.server";
import type { ValidatedUser } from "~/features/auth/guards.server";
import { userContext } from "~/features/auth/middleware.server";
import { parseStoredFormSchema } from "~/features/forms/serialization";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";
import { action } from "~/routes/admin.dinners.$dinnerId_.edit";

const SIGNER_LABEL = "Allergies";
const FRIEND_LABEL = "Dietary restrictions";

async function createDinner() {
  const data = await buildEventData();
  const event = await createEvent(data);

  return { dinnerId: event.id, addressId: data.addressId };
}

async function moderator(): Promise<ValidatedUser> {
  const user = await createTestUser("moderator");

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { role: true },
  }) as Promise<ValidatedUser>;
}

// Serializes one builder row the way the server-rendered form's inputs do —
// this is the request a browser with JavaScript switched off produces, mirror
// hidden inputs and all.
function appendRow(
  body: URLSearchParams,
  prefix: string,
  row: BuilderRow | BuilderItemRow,
) {
  body.append(`${prefix}.type`, row.type);
  body.append(`${prefix}.name`, row.name);
  body.append(`${prefix}.label`, row.label);
  if (row.required) body.append(`${prefix}.required`, "on");
  if (row.description) body.append(`${prefix}.description`, row.description);
  if (row.options) body.append(`${prefix}.options`, row.options);

  if (row.type !== "list") return;

  body.append(`${prefix}.maxCount`, String(row.maxCount ?? 0));
  (row.itemFields ?? []).forEach((item, index) =>
    appendRow(body, `${prefix}.itemFields[${index}]`, item),
  );
}

function editBody(addressId: string, rows: BuilderRow[]): URLSearchParams {
  const body = new URLSearchParams({
    title: "A dinner with a linked question",
    description: "Every seat comes with a question asked twice.",
    date: "2026-09-01T18:30",
    slots: "10",
    price: "20",
    addressId,
  });

  rows.forEach((row, index) => appendRow(body, `signupForm[${index}]`, row));

  return body;
}

// The pair a scriptless client can post: the signer's row was relabelled, the
// friend's copy still carries the wording it was stored with.
function disagreeingRows(): BuilderRow[] {
  return defaultBuilderRows().map((row): BuilderRow => {
    if (row.type !== "list" && row.name === "restrictions") {
      return { ...row, label: SIGNER_LABEL };
    }

    if (row.type !== "list") return row;

    return {
      ...row,
      itemFields: (row.itemFields ?? []).map((item) =>
        item.name === "restrictions" ? { ...item, label: FRIEND_LABEL } : item,
      ),
    };
  });
}

async function submit(
  dinnerId: string,
  body: URLSearchParams,
  user: ValidatedUser,
) {
  const context = new RouterContextProvider();
  context.set(userContext, user);

  return action({
    params: { dinnerId },
    request: new Request(
      `http://localhost:3000/admin/dinners/${dinnerId}/edit`,
      { method: "POST", body },
    ),
    context,
  } as unknown as Parameters<typeof action>[0]);
}

async function storedFields(dinnerId: string) {
  const version = await getCurrentFormVersionForEvent(dinnerId);
  const parsed = parseStoredFormSchema(version?.schema);
  if (!parsed.success) throw new Error("the stored form schema does not parse");

  return parsed.data;
}

describe("admin dinner edit action", () => {
  it("stores the signer's wording on both sides of a linked pair", async () => {
    const { dinnerId, addressId } = await createDinner();

    const result = await submit(
      dinnerId,
      editBody(addressId, disagreeingRows()),
      await moderator(),
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);

    const fields = await storedFields(dinnerId);
    const signer = fields.find(
      (field) => field.type !== "list" && field.data.name === "restrictions",
    );
    const friends = fields.find((field) => field.type === "list");
    const friend = friends?.data.itemFields.find(
      (item) => item.data.name === "restrictions",
    );

    // the server's normalization is the authority: no client code ran, and
    // the friend's disagreeing label never reached storage
    expect(signer?.data.label).toBe(SIGNER_LABEL);
    expect(friend?.data.label).toBe(SIGNER_LABEL);
    expect(fields).not.toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ label: FRIEND_LABEL }),
      }),
    );
  });

  it("splits the pair into two questions once the friend's key differs", async () => {
    const { dinnerId, addressId } = await createDinner();
    const rows = disagreeingRows().map((row): BuilderRow => {
      if (row.type !== "list") return row;

      return {
        ...row,
        itemFields: (row.itemFields ?? []).map((item) =>
          item.name === "restrictions"
            ? { ...item, name: "restrictions_2" }
            : item,
        ),
      };
    });

    await submit(dinnerId, editBody(addressId, rows), await moderator());

    const fields = await storedFields(dinnerId);
    const friends = fields.find((field) => field.type === "list");
    const unlinked = friends?.data.itemFields.find(
      (item) => item.data.name === "restrictions_2",
    );

    expect(unlinked?.data.label).toBe(FRIEND_LABEL);
  });
});
