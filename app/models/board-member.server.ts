import type { BoardMember } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  releaseImagesIfUnreferenced,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { BoardMember };

export interface BoardMemberData {
  name: string;
  position: string;
  image?: ImageCreateData;
}

export async function countBoardMembers(): Promise<number> {
  return prisma.boardMember.count();
}

export async function listBoardMembers(): Promise<
  {
    id: string;
    name: string;
    position: string;
    image: ImageMetadata | null;
  }[]
> {
  const boardMembers = await prisma.boardMember.findMany({
    include: { image: { select: IMAGE_METADATA_SELECT } },
  });

  return boardMembers.map(({ id, name, position, image }) => ({
    id,
    name,
    position,
    image,
  }));
}

export async function getBoardMemberById(
  id: string,
): Promise<BoardMember | null> {
  return prisma.boardMember.findUnique({ where: { id } });
}

export async function createBoardMember(
  data: BoardMemberData,
): Promise<BoardMember> {
  const { name, position, image } = data;

  return prisma.boardMember.create({
    data: {
      name,
      position,
      ...(image && { image: { create: image } }),
    },
  });
}

export async function deleteBoardMember(
  id: string,
): Promise<{ boardMember: BoardMember; imageKey: string | null }> {
  return prisma.$transaction(async (tx) => {
    const boardMember = await tx.boardMember.delete({ where: { id } });

    // released only after the member is gone, so the portrait survives when
    // a gallery still shows it
    let imageKey: string | null = null;
    if (boardMember.imageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        boardMember.imageId,
      ]);
      imageKey = storageKeys[0] ?? null;
    }

    return { boardMember, imageKey };
  });
}

// Replaces the portrait iff a new image is provided: the new row is created
// in the same transaction as the update, and the old one released — deleted
// only when no gallery still shows it. A destroyed portrait's storageKey
// comes back for the caller's post-commit provider destroy; null otherwise.
export async function updateBoardMember(
  id: string,
  data: BoardMemberData,
): Promise<{ boardMember: BoardMember; replacedImageKey: string | null }> {
  const { name, position, image } = data;

  return prisma.$transaction(async (tx) => {
    let previousImageId: string | null = null;

    if (image) {
      const current = await tx.boardMember.findUnique({
        where: { id },
        select: { imageId: true },
      });
      previousImageId = current?.imageId ?? null;
    }

    const boardMember = await tx.boardMember.update({
      where: { id },
      data: {
        name,
        position,
        ...(image && { image: { create: image } }),
      },
    });

    let replacedImageKey: string | null = null;
    if (previousImageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        previousImageId,
      ]);
      replacedImageKey = storageKeys[0] ?? null;
    }

    return { boardMember, replacedImageKey };
  });
}
