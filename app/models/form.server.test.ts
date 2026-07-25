import { describe, expect, it } from "vitest";

import type { Prisma } from "#prisma/generated/client";

import { getCurrentFormVersion, saveFormSchema } from "./form.server";

import { prisma } from "~/db.server";
import type { FieldDescriptor } from "~/features/forms/fields";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";

async function createFormWithV1(fields: FieldDescriptor[] = DEFAULT_FORM) {
  return prisma.form.create({
    data: {
      versions: {
        create: { version: 1, schema: fields as Prisma.InputJsonValue },
      },
    },
    include: { versions: true },
  });
}

function withCommentLabel(label: string): FieldDescriptor[] {
  return DEFAULT_FORM.map((field) =>
    field.type === "textarea" && field.data.name === "comment"
      ? { ...field, data: { ...field.data, label } }
      : field,
  );
}

describe("getCurrentFormVersion", () => {
  it("returns the highest version", async () => {
    const form = await createFormWithV1();
    await prisma.formVersion.create({
      data: {
        formId: form.id,
        version: 2,
        schema: withCommentLabel("Anything else?") as Prisma.InputJsonValue,
      },
    });

    const current = await getCurrentFormVersion(form.id);

    expect(current.version).toBe(2);
  });
});

describe("saveFormSchema (versioning policy)", () => {
  it("does nothing when the schema is deep-equal to the current version's", async () => {
    const form = await createFormWithV1();
    const [v1] = form.versions;

    const result = await saveFormSchema(form.id, structuredClone(DEFAULT_FORM));

    expect(result.id).toBe(v1.id);
    expect(result.version).toBe(1);
    expect(result.updatedAt).toEqual(v1.updatedAt);
    await expect(
      prisma.formVersion.count({ where: { formId: form.id } }),
    ).resolves.toBe(1);
  });

  it("treats a non-normalized but semantically identical schema as unchanged", async () => {
    const form = await createFormWithV1();

    // FormSchema trims labels on parse; without input normalization this
    // padded-but-identical save would be misdetected as a change
    const result = await saveFormSchema(
      form.id,
      withCommentLabel("  Comment  "),
    );

    expect(result.id).toBe(form.versions[0].id);
    await expect(
      prisma.formVersion.count({ where: { formId: form.id } }),
    ).resolves.toBe(1);
  });

  it("updates the current version in place while it has no submissions", async () => {
    const form = await createFormWithV1();
    const [v1] = form.versions;
    const edited = withCommentLabel("Anything else?");

    const result = await saveFormSchema(form.id, edited);

    expect(result.id).toBe(v1.id);
    expect(result.version).toBe(1);
    expect(result.schema).toEqual(edited);
    await expect(
      prisma.formVersion.count({ where: { formId: form.id } }),
    ).resolves.toBe(1);
  });

  it("creates a new version once the current one has submissions", async () => {
    const form = await createFormWithV1();
    const [v1] = form.versions;
    await prisma.formSubmission.create({
      data: { formVersionId: v1.id, answers: { name: "Someone" } },
    });
    const edited = withCommentLabel("Anything else?");

    const result = await saveFormSchema(form.id, edited);

    expect(result.id).not.toBe(v1.id);
    expect(result.version).toBe(2);
    expect(result.schema).toEqual(edited);

    // the submitted-against version is immutable and still referenced
    const v1After = await prisma.formVersion.findUniqueOrThrow({
      where: { id: v1.id },
      include: { _count: { select: { submissions: true } } },
    });
    expect(v1After.schema).toEqual(DEFAULT_FORM);
    expect(v1After._count.submissions).toBe(1);

    await expect(getCurrentFormVersion(form.id)).resolves.toMatchObject({
      version: 2,
    });
  });

  it("skips when deep-equal even after a prior new-version save", async () => {
    const form = await createFormWithV1();
    await prisma.formSubmission.create({
      data: { formVersionId: form.versions[0].id, answers: {} },
    });
    const edited = withCommentLabel("Anything else?");
    const v2 = await saveFormSchema(form.id, edited);

    const result = await saveFormSchema(form.id, structuredClone(edited));

    expect(result.id).toBe(v2.id);
    await expect(
      prisma.formVersion.count({ where: { formId: form.id } }),
    ).resolves.toBe(2);
  });
});
