import type { Image, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Image };

export interface ImageData {
  contentType: string;
  // Buffer's bare form is Buffer<ArrayBufferLike>, which Prisma's Bytes input rejects
  blob: Buffer<ArrayBuffer>;
}

// The one place upload bytes become persistable ImageData.
export async function fileToImageData(file: File): Promise<ImageData> {
  return {
    contentType: file.type,
    blob: Buffer.from(await file.arrayBuffer()),
  };
}

// Image rows are only ever created inside their owner's transaction (event
// create/update) so bytes and ownership commit or roll back together — a
// standalone create would leave an orphan row if the owner write failed.
export async function createImageInTx(
  tx: Prisma.TransactionClient,
  data: ImageData,
): Promise<{ id: string }> {
  return tx.image.create({ data, select: { id: true } });
}

// The DB cascades Image -> Event: deleting an image an event still points at
// deletes the event (skipping the app-level form cleanup). Callers must
// repoint or delete the event first, in the same transaction.
export async function deleteImageInTx(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  await tx.image.delete({ where: { id } });
}

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}

// An image is an orphan iff neither owner relation holds: no board member
// (boardMemberId null) and no event pointing at it. Owned images are never
// touched — deleting an event-owned image would cascade-delete its event.
const ORPHAN_IMAGE_WHERE = {
  boardMemberId: null,
  event: null,
} satisfies Prisma.ImageWhereInput;

export async function countOrphanImages(): Promise<number> {
  return prisma.image.count({ where: ORPHAN_IMAGE_WHERE });
}

export async function deleteOrphanImages(): Promise<{ count: number }> {
  return prisma.image.deleteMany({ where: ORPHAN_IMAGE_WHERE });
}
