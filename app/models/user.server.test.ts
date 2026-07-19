import { describe, expect, it } from "vitest";

import { buildEventData, createTestUser } from "../../test/factories";

import { createEvent } from "./event.server";
import { deleteNonAdminUserById } from "./user.server";

import { prisma } from "~/db.server";

describe("deleteNonAdminUserById", () => {
  it("deletes a non-admin user", async () => {
    const user = await createTestUser("user");

    await expect(deleteNonAdminUserById(user.id)).resolves.toMatchObject({
      id: user.id,
    });
    await expect(
      prisma.user.findUnique({ where: { id: user.id } }),
    ).resolves.toBeNull();
  });

  it("does not delete an admin user", async () => {
    const admin = await createTestUser("admin");

    await expect(deleteNonAdminUserById(admin.id)).resolves.toBeNull();
    await expect(
      prisma.user.findUnique({ where: { id: admin.id } }),
    ).resolves.not.toBeNull();
  });

  it("cleans up an owned event's form and image before deleting the user", async () => {
    const event = await createEvent(await buildEventData());

    await deleteNonAdminUserById(event.createdById);

    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.form.findUnique({ where: { id: event.formId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.toBeNull();
  });

  it("treats a missing user as an idempotent no-op", async () => {
    await expect(deleteNonAdminUserById("does-not-exist")).resolves.toBeNull();
  });
});
