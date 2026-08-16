import { parseWithZod } from "@conform-to/zod/v4";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AdminEventRouteForm } from "~/features/events/components/admin-event-route-form";
import { EventEditSchema } from "~/features/events/event-schema";
import type { FieldDescriptor } from "~/features/forms/fields";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  SignupFormBuilderSchema,
  type BuilderRow,
} from "~/features/signup-form/builder";

const SIGNER_LABEL = "Dietary restrictions";
const SIGNER_DESCRIPTION = "Allergies, intolerances, anything we cook around.";
const STALE_FRIEND_LABEL = "Whatever the friend once typed";

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Text area",
  email: "Email",
  phone: "Phone",
  checkbox: "Checkbox",
  select: "Select",
};

function linkedPairRows(): BuilderRow[] {
  const rows = defaultBuilderRows().map((row): BuilderRow => {
    if (row.type !== "list" && row.name === "restrictions") {
      return {
        ...row,
        type: "textarea",
        label: SIGNER_LABEL,
        required: true,
        description: SIGNER_DESCRIPTION,
      };
    }

    if (row.type !== "list") return row;

    return {
      ...row,
      itemFields: [
        ...(row.itemFields ?? []).map((item) =>
          item.name === "restrictions"
            ? {
                ...item,
                label: STALE_FRIEND_LABEL,
                description: "help text from before the link",
              }
            : item,
        ),
        {
          type: "text" as const,
          name: "nickname",
          label: "Nickname",
          required: false,
        },
      ],
    };
  });

  return rows;
}

function renderEditScreen(rows: BuilderRow[]) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <AdminEventRouteForm
          schema={EventEditSchema}
          defaultValue={{ signupForm: rows }}
          addressOptions={[]}
          submitText="Save dinner"
          pageTitle="Edit dinner"
          cancelHref="/admin/dinners/dinner-1"
        />
      ),
    },
  ]);

  const html = renderToString(<Stub initialEntries={["/"]} />);

  return { document: new DOMParser().parseFromString(html, "text/html") };
}

function friendRowPrefix(rows: BuilderRow[]): string {
  const listIndex = rows.findIndex((row) => row.type === "list");
  const itemIndex = (rows[listIndex].itemFields ?? []).findIndex(
    (item) => item.name === "restrictions",
  );

  return `signupForm[${listIndex}].itemFields[${itemIndex}]`;
}

function scriptlessPayload(document: Document): FormData {
  const form = document.querySelector("form");
  if (!form) throw new Error("the edit screen rendered no form");

  const payload = new FormData();
  for (const [name, value] of new FormData(form).entries()) {
    if (name.startsWith("signupForm")) payload.append(name, value);
  }

  return payload;
}

function descriptorsFromPayload(payload: FormData): FieldDescriptor[] {
  const submission = parseWithZod(payload, {
    schema: z.object({ signupForm: SignupFormBuilderSchema }),
  });

  if (submission.status !== "success") {
    throw new Error(
      `the rendered form does not validate: ${submission.status}`,
    );
  }

  return builderRowsToDescriptors(submission.value.signupForm);
}

function friendDescriptor(descriptors: FieldDescriptor[], name: string) {
  const list = descriptors.find((descriptor) => descriptor.type === "list");
  if (!list) throw new Error("no friends list in the stored descriptors");

  const field = list.data.itemFields.find((item) => item.data.name === name);
  if (!field) throw new Error(`no friend field named ${name}`);

  return field;
}

describe("signup form builder markup", () => {
  it("renders every collapsed row body for visitors without JavaScript", () => {
    const { document } = renderEditScreen(linkedPairRows());

    const fallback = [...document.querySelectorAll("noscript")]
      .map((element) => element.textContent ?? "")
      .find((text) => text.includes("data-row-body"));

    expect(fallback).toContain("[data-row-body]{display:block");
  });

  it("submits the signer's wording from the friend's mirrored row", () => {
    const rows = linkedPairRows();
    const { document } = renderEditScreen(rows);
    const prefix = friendRowPrefix(rows);

    const hiddenLabel = document.querySelector(
      `input[type="hidden"][name="${prefix}.label"]`,
    );

    expect(hiddenLabel?.getAttribute("value")).toBe(SIGNER_LABEL);
  });

  it("makes the mirrored controls decoration: no name, no interaction", () => {
    const rows = linkedPairRows();
    const { document } = renderEditScreen(rows);
    const mirror = document
      .querySelector(
        `input[type="hidden"][name="${friendRowPrefix(rows)}.label"]`,
      )
      ?.closest("fieldset");

    const controls = [
      ...(mirror?.querySelectorAll(
        'input:not([type="hidden"]), select, textarea',
      ) ?? []),
    ];

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.hasAttribute("name")).toBe(false);
      expect(control.hasAttribute("disabled")).toBe(true);
    }
  });

  it("carries the linkage in the meta prose of both rows", () => {
    const { document } = renderEditScreen(linkedPairRows());
    const text = document.body.textContent ?? "";

    expect(text).toContain("linked to friends");
    expect(text).toContain("linked to the signer's");
  });

  it("opens its dialogs without submitting the form", () => {
    const { document } = renderEditScreen(linkedPairRows());

    const triggers = [...document.querySelectorAll("[commandfor]")];

    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger.getAttribute("type")).toBe("button");
    }
  });

  it("offers the next free key in the unlink dialog", () => {
    const { document } = renderEditScreen(linkedPairRows());
    const dialog = document.querySelector("#unlink-dialog-restrictions");
    const keyInput = dialog?.querySelector('input[type="text"]');

    expect(dialog?.textContent).toContain("Unlink from the signer's question?");
    expect(keyInput?.getAttribute("value")).toBe("restrictions_2");
    expect(keyInput?.hasAttribute("name")).toBe(false);
  });

  it("stores exactly what the mirrored row displays", () => {
    const rows = linkedPairRows();
    const { document } = renderEditScreen(rows);
    const mirror = document
      .querySelector(
        `input[type="hidden"][name="${friendRowPrefix(rows)}.label"]`,
      )
      ?.closest("fieldset");
    if (!mirror) throw new Error("the friend's row rendered no mirror");

    const [typeSelect] = mirror.querySelectorAll("select");
    const [labelInput, keyInput] =
      mirror.querySelectorAll('input[type="text"]');
    const [descriptionArea] = mirror.querySelectorAll("textarea");
    const [requiredBox] = mirror.querySelectorAll('input[type="checkbox"]');

    const displayed = {
      type: typeSelect.textContent,
      label: labelInput.getAttribute("value"),
      name: keyInput.getAttribute("value"),
      description: descriptionArea.textContent,
      required: requiredBox.hasAttribute("checked"),
    };

    const stored = friendDescriptor(
      descriptorsFromPayload(scriptlessPayload(document)),
      displayed.name ?? "",
    );

    expect(displayed.name).toBe("restrictions");
    expect(displayed.type).toBe("Text area");
    expect(displayed.required).toBe(true);
    expect(TYPE_LABELS[stored.type]).toBe(displayed.type);
    expect(stored.data.label).toBe(displayed.label);
    expect(stored.data.required).toBe(displayed.required);
    expect(stored.data.description ?? "").toBe(displayed.description);
    expect(stored.data.label).toBe(SIGNER_LABEL);
    expect(stored.data.description).toBe(SIGNER_DESCRIPTION);
  });

  it("offers no unlink for the identity pair", () => {
    const { document } = renderEditScreen(linkedPairRows());

    expect(document.querySelector("#unlink-dialog-name")).toBeNull();
    expect(
      document.querySelector('[commandfor="unlink-dialog-name"]'),
    ).toBeNull();
    expect(
      document.querySelector("#unlink-dialog-restrictions"),
    ).not.toBeNull();
  });

  it("names the no-JS behaviour inside both dialogs", () => {
    const { document } = renderEditScreen(linkedPairRows());

    const noscriptText = (selector: string) =>
      [
        ...(document.querySelector(selector)?.querySelectorAll("noscript") ??
          []),
      ]
        .map((element) => element.textContent ?? "")
        .join(" ");

    expect(noscriptText("#link-dialog-comment")).toContain(
      "Without JavaScript, confirming applies the default option.",
    );
    expect(noscriptText("#unlink-dialog-restrictions")).toContain(
      "Without JavaScript, the prefilled key applies.",
    );
  });

  it("leaves an unlinked friend question editable and independent", () => {
    const rows = linkedPairRows();
    const { document } = renderEditScreen(rows);
    const listIndex = rows.findIndex((row) => row.type === "list");
    const items = rows[listIndex].itemFields ?? [];
    const prefix = `signupForm[${listIndex}].itemFields[${items.length - 1}]`;

    const labelInput = document.querySelector(`input[name="${prefix}.label"]`);

    expect(labelInput?.getAttribute("type")).toBe("text");
    expect(labelInput?.hasAttribute("disabled")).toBe(false);

    const stored = friendDescriptor(
      descriptorsFromPayload(scriptlessPayload(document)),
      "nickname",
    );

    expect(stored.data.label).toBe("Nickname");
  });
});
