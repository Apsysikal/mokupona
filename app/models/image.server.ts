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

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}

// An image is an orphan iff neither owner FK holds: no board member and no
// event. Both FKs live on Image, so deleting an image row — owned or not —
// can never touch its owner; owned images are still skipped because covers
// and portraits are current, not garbage.
const ORPHAN_IMAGE_WHERE = {
  boardMemberId: null,
  eventId: null,
} satisfies Prisma.ImageWhereInput;

export async function countOrphanImages(): Promise<number> {
  return prisma.image.count({ where: ORPHAN_IMAGE_WHERE });
}

export async function deleteOrphanImages(): Promise<{ count: number }> {
  return prisma.image.deleteMany({ where: ORPHAN_IMAGE_WHERE });
}
