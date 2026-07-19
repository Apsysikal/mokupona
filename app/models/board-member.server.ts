import type { BoardMember } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { BoardMember };

export interface BoardMemberData {
  name: string;
  position: string;
  image?: ImageCreateData;
}

// the admin tab bar shows a count pill per section
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

// The portrait cascades (Image.boardMemberId is onDelete: Cascade), so its
// storageKey is captured inside the transaction before the delete erases it
// (capture-and-destroy, design §3.4) — the CALLER destroys the provider
// asset strictly after commit.
export async function deleteBoardMember(
  id: string,
): Promise<{ boardMember: BoardMember; imageKey: string | null }> {
  return prisma.$transaction(async (tx) => {
    const portrait = await tx.image.findUnique({
      where: { boardMemberId: id },
      select: { storageKey: true },
    });
    const boardMember = await tx.boardMember.delete({ where: { id } });

    return { boardMember, imageKey: portrait?.storageKey ?? null };
  });
}

// Replaces the portrait iff a new image is provided: the old image row is
// deleted and the new one created in the same transaction as the update.
// The replaced portrait's storageKey comes back for the caller's post-commit
// provider destroy; null when nothing was replaced.
export async function updateBoardMember(
  id: string,
  data: BoardMemberData,
): Promise<{ boardMember: BoardMember; replacedImageKey: string | null }> {
  const { name, position, image } = data;

  return prisma.$transaction(async (tx) => {
    let replacedImageKey: string | null = null;

    if (image) {
      const replaced = await tx.image.findUnique({
        where: { boardMemberId: id },
        select: { storageKey: true },
      });
      replacedImageKey = replaced?.storageKey ?? null;
      await tx.image.deleteMany({ where: { boardMemberId: id } });
    }

    const boardMember = await tx.boardMember.update({
      where: { id },
      data: {
        name,
        position,
        ...(image && { image: { create: image } }),
      },
    });

    return { boardMember, replacedImageKey };
  });
}
