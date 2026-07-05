import type { Image } from "#prisma/generated/client";

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

export async function createImage(data: ImageData): Promise<{ id: string }> {
  return prisma.image.create({ data, select: { id: true } });
}

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}
