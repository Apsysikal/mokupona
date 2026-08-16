import type { Image, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Image };

export interface ImageMetadata {
  id: string;
  storageKey: string;
  version: number | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

export const IMAGE_METADATA_SELECT = {
  id: true,
  storageKey: true,
  version: true,
  width: true,
  height: true,
  blurDataUrl: true,
} satisfies Prisma.ImageSelect;

export interface ImageCreateData {
  contentType: string;
  storageKey: string;
  version?: number | null;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
}

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}
