import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createEvent, deleteEvent } from "./event.server";
import {
  createFormSubmission,
  FormVersionChangedError,
  getFormSubmissionsForEvent,
} from "./form-submission.server";
import { getCurrentFormVersion } from "./form.server";
import { deleteUserById } from "./user.server";

import { prisma } from "~/db.server";
import type { FieldDescriptor } from "~/features/forms/fields";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";

describe("createEvent", () => {
  it("creates the form and its first version with the event", async () => {
    const event = await createEvent(await buildEventData());

    const form = await prisma.form.findUniqueOrThrow({
      where: { id: event.formId },
      include: { versions: true },
    });
    expect(form.versions).toHaveLength(1);
    expect(form.versions[0].version).toBe(1);
    expect(form.versions[0].schema).toEqual(DEFAULT_FORM);
  });

  it("stores custom form fields when provided", async () => {
    const fields: FieldDescriptor[] = [
      {
        type: "text",
        version: 1,
        data: { name: "name", label: "Name", required: true },
      },
    ];

    const event = await createEvent(await buildEventData(), fields);

    const version = await getCurrentFormVersion(event.formId);
    expect(version.schema).toEqual(fields);
  });

  it("rejects descriptors that violate FormSchema", async () => {
    const duplicateNames: FieldDescriptor[] = [
      {
        type: "text",
        version: 1,
        data: { name: "name", label: "Name", required: true },
      },
      {
        type: "text",
        version: 1,
        data: { name: "name", label: "Also Name", required: false },
      },
    ];

    await expect(
      createEvent(await buildEventData(), duplicateNames),
    ).rejects.toThrow();
  });
});

describe("deleteEvent", () => {
  it("round-trips: removes the event with its form, versions, and submissions", async () => {
    const event = await createEvent(await buildEventData());
    const version = await getCurrentFormVersion(event.formId);
    await createFormSubmission({
      formVersionId: version.id,
      answers: { name: "Solo Signer", email: "solo@example.com", friends: [] },
    });

    const submissions = await getFormSubmissionsForEvent(event.id);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].formVersion.id).toBe(version.id);

    await deleteEvent(event.id);

    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.form.findUnique({ where: { id: event.formId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.formVersion.count({ where: { formId: event.formId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.formSubmission.count({
        where: { formVersion: { formId: event.formId } },
      }),
    ).resolves.toBe(0);
  });

  it("rejects for an unknown event id", async () => {
    await expect(deleteEvent("does-not-exist")).rejects.toThrow();
  });
});

describe("createFormSubmission version guard", () => {
  it("rejects the write when the pinned version changed after validation", async () => {
    const event = await createEvent(await buildEventData());
    const version = await getCurrentFormVersion(event.formId);

    // simulate an in-place schema update racing the signup request
    await prisma.formVersion.update({
      where: { id: version.id },
      data: { updatedAt: new Date(version.updatedAt.getTime() + 5_000) },
    });

    await expect(
      createFormSubmission({
        formVersionId: version.id,
        answers: { name: "Raced Signer" },
        expectedVersionUpdatedAt: version.updatedAt,
      }),
    ).rejects.toBeInstanceOf(FormVersionChangedError);

    await expect(
      prisma.formSubmission.count({ where: { formVersionId: version.id } }),
    ).resolves.toBe(0);
  });

  it("writes when the pinned version is unchanged", async () => {
    const event = await createEvent(await buildEventData());
    const version = await getCurrentFormVersion(event.formId);

    await expect(
      createFormSubmission({
        formVersionId: version.id,
        answers: { name: "Safe Signer" },
        expectedVersionUpdatedAt: version.updatedAt,
      }),
    ).resolves.toMatchObject({ formVersionId: version.id });
  });
});

describe("cascade paths into Event", () => {
  it("deleting a user removes their events' form data too", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    // the DB cascades User -> Event; the model must pair that with the
    // app-level form cascade or the form rows are orphaned
    await deleteUserById(data.createdById);

    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.form.findUnique({ where: { id: event.formId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.formVersion.count({ where: { formId: event.formId } }),
    ).resolves.toBe(0);
  });
});
