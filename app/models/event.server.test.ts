import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { deleteAddress } from "./address.server";
import {
  createEvent,
  deleteEvent,
  getEventWithCurrentFormVersion,
  getNextEvent,
  updateEvent,
} from "./event.server";
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

// duplicate field names violate FormSchema's unique-name rule, making any
// transaction that saves the schema throw mid-flight
function duplicateNameFields(): FieldDescriptor[] {
  return [
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
}

/** The event's cover row; the FK lives on Image (eventId, unique). */
function findCover(eventId: string) {
  return prisma.image.findUnique({ where: { eventId } });
}

/** Asserts the event with its form, versions, submissions, and image is gone. */
async function expectEventGraphDeleted(event: { id: string; formId: string }) {
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
  await expect(
    prisma.image.count({ where: { eventId: event.id } }),
  ).resolves.toBe(0);
}

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
    await expect(
      createEvent(await buildEventData(), duplicateNameFields()),
    ).rejects.toThrow();
  });
});

describe("event read projections", () => {
  it("returns the event address with its latest form version", async () => {
    const event = await createEvent(await buildEventData());
    const firstVersion = await getCurrentFormVersion(event.formId);
    await createFormSubmission({
      formVersionId: firstVersion.id,
      answers: { name: "Versioned signer" },
    });
    const editedFields: FieldDescriptor[] = DEFAULT_FORM.map((field) =>
      field.type === "textarea" && field.data.name === "comment"
        ? { ...field, data: { ...field.data, label: "Updated comment" } }
        : field,
    );
    await updateEvent(event.id, {}, editedFields);

    const result = await getEventWithCurrentFormVersion(event.id);

    expect(result?.event).toMatchObject({
      id: event.id,
      formId: event.formId,
      address: { id: event.addressId },
    });
    expect(result?.version).toMatchObject({
      formId: event.formId,
      version: 2,
      schema: editedFields,
    });
  });

  it("returns one not-found result for an unknown event", async () => {
    await expect(
      getEventWithCurrentFormVersion("does-not-exist"),
    ).resolves.toBeNull();
  });

  it("includes an event exactly on the upcoming boundary with its address", async () => {
    const boundary = new Date("2200-01-01T12:00:00.000Z");
    const event = await createEvent({
      ...(await buildEventData()),
      date: boundary,
    });
    await createEvent({
      ...(await buildEventData()),
      date: new Date(boundary.getTime() + 60_000),
    });

    const next = await getNextEvent(boundary);

    expect(next).toMatchObject({
      id: event.id,
      date: boundary,
      address: { id: event.addressId },
    });
  });
});

describe("event image lifecycle", () => {
  it("creates the image row pointing at the event", async () => {
    const data = await buildEventData();

    const event = await createEvent(data);

    const image = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    expect(image.contentType).toBe(data.image.contentType);
    expect(image.blob && Buffer.from(image.blob)).toEqual(data.image.blob);
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

  it("cover swap: deletes the old image and creates the new one", async () => {
    const event = await createEvent(await buildEventData());
    const oldImage = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    const newImage = {
      contentType: "image/png",
      blob: Buffer.from("swapped-cover"),
    };

    await updateEvent(event.id, { image: newImage });

    const image = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    expect(image.id).not.toBe(oldImage.id);
    expect(image.contentType).toBe("image/png");
    await expect(
      prisma.image.findUnique({ where: { id: oldImage.id } }),
    ).resolves.toBeNull();
    // the event survived the old image's deletion (the FK is on Image)
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
    // the schema failure inside saveFormSchemaInTx happens AFTER the new
    // image was created and the event repointed, so the whole swap must
    // roll back
    const before = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });

    await expect(
      updateEvent(event.id, { image: newImage }, duplicateNameFields()),
    ).rejects.toThrow();

    const after = await findCover(event.id);
    expect(after?.id).toBe(before.id);
    await expect(
      prisma.image.count({ where: { blob: newImage.blob } }),
    ).resolves.toBe(0);
  });

  it("leaves the image untouched when updating without one", async () => {
    const event = await createEvent(await buildEventData());
    const before = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });

    await updateEvent(event.id, { title: "No Cover Change" });

    const after = await findCover(event.id);
    expect(after?.id).toBe(before.id);
  });

  it("deletes the image with the event", async () => {
    const event = await createEvent(await buildEventData());
    const cover = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });

    await deleteEvent(event.id);

    await expect(
      prisma.image.findUnique({ where: { id: cover.id } }),
    ).resolves.toBeNull();
  });

  it("deleting an image never deletes the event", async () => {
    const event = await createEvent(await buildEventData());
    const cover = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });

    await prisma.image.delete({ where: { id: cover.id } });

    // the event stands, coverless — the UI renders the fallback artwork
    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.not.toBeNull();
    await expect(findCover(event.id)).resolves.toBeNull();
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

    await expect(
      updateEvent(
        event.id,
        { title: "Should Not Persist" },
        duplicateNameFields(),
      ),
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

    await expectEventGraphDeleted(event);
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

describe("events outlive their supporting entities", () => {
  it("deleting a user keeps their events, clearing authorship", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    // Event.createdById is SetNull — the event, its form data and cover stay
    await deleteUserById(data.createdById);

    const after = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(after.createdById).toBeNull();
    await expect(
      prisma.form.findUnique({ where: { id: event.formId } }),
    ).resolves.not.toBeNull();
    await expect(findCover(event.id)).resolves.not.toBeNull();
  });

  it("refuses to delete an address that still hosts events", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    await expect(deleteAddress(data.addressId)).resolves.toBeNull();

    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.address.findUnique({ where: { id: data.addressId } }),
    ).resolves.not.toBeNull();
  });

  it("deletes an address once its events are gone", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);
    await deleteEvent(event.id);

    await expect(deleteAddress(data.addressId)).resolves.toMatchObject({
      id: data.addressId,
    });
    await expect(
      prisma.address.findUnique({ where: { id: data.addressId } }),
    ).resolves.toBeNull();
  });
});
