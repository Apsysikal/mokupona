import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { deleteAddress } from "./address.server";
import { createEvent, deleteEvent, updateEvent } from "./event.server";
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

describe("event image lifecycle", () => {
  it("creates the image row with the event pointing at it", async () => {
    const data = await buildEventData();

    const event = await createEvent(data);

    const image = await prisma.image.findUniqueOrThrow({
      where: { id: event.imageId },
    });
    expect(image.contentType).toBe(data.image.contentType);
    expect(Buffer.from(image.blob)).toEqual(data.image.blob);
  });

  it("leaves no image row when the create transaction fails after the image write", async () => {
    const data = await buildEventData();

    // the invalid address FK makes tx.event.create throw AFTER the image was
    // created inside the transaction — the rollback must take the image too
    await expect(
      createEvent({ ...data, addressId: "does-not-exist" }),
    ).rejects.toThrow();

    // the factory blob is unique per call, so it identifies the leaked row
    await expect(
      prisma.image.count({ where: { blob: data.image.blob } }),
    ).resolves.toBe(0);
  });

  it("cover swap: creates the new image, repoints the event, deletes the old one", async () => {
    const event = await createEvent(await buildEventData());
    const oldImageId = event.imageId;
    const newImage = {
      contentType: "image/png",
      blob: Buffer.from("swapped-cover"),
    };

    const updated = await updateEvent(event.id, { image: newImage });

    expect(updated.imageId).not.toBe(oldImageId);
    const image = await prisma.image.findUniqueOrThrow({
      where: { id: updated.imageId },
    });
    expect(image.contentType).toBe("image/png");
    await expect(
      prisma.image.findUnique({ where: { id: oldImageId } }),
    ).resolves.toBeNull();
    // the event survived the old image's deletion (Image -> Event cascade)
    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.not.toBeNull();
  });

  it("cover swap failure: keeps the old image and leaves no new image row", async () => {
    const event = await createEvent(await buildEventData());
    const newImage = {
      contentType: "image/png",
      blob: Buffer.from("never-persisted-cover"),
    };
    // duplicate field names fail FormSchema inside saveFormSchemaInTx — the
    // throw happens AFTER the new image was created and the event repointed,
    // so the whole swap must roll back
    const invalid: FieldDescriptor[] = [
      {
        type: "text",
        version: 1,
        data: { name: "dup", label: "One", required: false },
      },
      {
        type: "text",
        version: 1,
        data: { name: "dup", label: "Two", required: false },
      },
    ];

    await expect(
      updateEvent(event.id, { image: newImage }, invalid),
    ).rejects.toThrow();

    const after = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(after.imageId).toBe(event.imageId);
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.image.count({ where: { blob: newImage.blob } }),
    ).resolves.toBe(0);
  });

  it("leaves the image untouched when updating without one", async () => {
    const event = await createEvent(await buildEventData());

    const updated = await updateEvent(event.id, { title: "No Cover Change" });

    expect(updated.imageId).toBe(event.imageId);
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.not.toBeNull();
  });

  it("deletes the image with the event", async () => {
    const event = await createEvent(await buildEventData());

    await deleteEvent(event.id);

    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.toBeNull();
  });

  it("deleting an address removes its events' images too", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    await deleteAddress(data.addressId);

    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.toBeNull();
  });
});

describe("updateEvent", () => {
  it("persists event data and form schema together", async () => {
    const event = await createEvent(await buildEventData());
    const edited: FieldDescriptor[] = DEFAULT_FORM.map((field) =>
      field.type === "textarea" && field.data.name === "comment"
        ? { ...field, data: { ...field.data, label: "Anything else?" } }
        : field,
    );

    const updated = await updateEvent(event.id, { title: "New Title" }, edited);

    expect(updated.title).toBe("New Title");
    const version = await getCurrentFormVersion(event.formId);
    expect(version.schema).toEqual(edited);
  });

  it("rolls the event data back when the form save fails", async () => {
    const event = await createEvent(await buildEventData());
    const invalid: FieldDescriptor[] = [
      {
        type: "text",
        version: 1,
        data: { name: "dup", label: "One", required: false },
      },
      {
        type: "text",
        version: 1,
        data: { name: "dup", label: "Two", required: false },
      },
    ];

    await expect(
      updateEvent(event.id, { title: "Should Not Persist" }, invalid),
    ).rejects.toThrow();

    const after = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(after.title).not.toBe("Should Not Persist");
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
  it("deleting a user removes their events' form data and images too", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    // the DB cascades User -> Event; the model must pair that with the
    // app-level form and image cascades or those rows are orphaned
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
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.toBeNull();
  });
});
