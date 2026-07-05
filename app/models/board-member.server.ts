import type { BoardMember } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import type { ImageData } from "~/models/image.server";

export type { BoardMember };

export interface BoardMemberData {
  name: string;
  position: string;
  image?: ImageData;
}

// the admin tab bar shows a count pill per section
export async function countBoardMembers(): Promise<number> {
  return prisma.boardMember.count();
}

export async function listBoardMembers(): Promise<
  { id: string; name: string; position: string; imageId: string | null }[]
> {
  const boardMembers = await prisma.boardMember.findMany({
    include: { image: { select: { id: true } } },
  });

  return boardMembers.map(({ id, name, position, image }) => ({
    id,
    name,
    position,
    imageId: image?.id ?? null,
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

// the portrait cascades (Image.boardMemberId is onDelete: Cascade)
export async function deleteBoardMember(id: string): Promise<BoardMember> {
  return prisma.boardMember.delete({ where: { id } });
}

// Replaces the portrait iff a new image is provided: the old image row is
// deleted and the new one created in the same transaction as the update.
export async function updateBoardMember(
  id: string,
  data: BoardMemberData,
): Promise<BoardMember> {
  const { name, position, image } = data;

  return prisma.$transaction(async (tx) => {
    if (image) {
      await tx.image.deleteMany({ where: { boardMemberId: id } });
    }

    return tx.boardMember.update({
      where: { id },
      data: {
        name,
        position,
        ...(image && { image: { create: image } }),
      },
    });
  });
}
