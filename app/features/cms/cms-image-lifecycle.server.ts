import type { BlockInstance } from "./catalog";

type CmsImageLifecyclePrisma = {
  pageBlock: {
    count(args: { where: { data: { contains: string } } }): Promise<number>;
  };
  event: {
    count(args: { where: { imageId: string } }): Promise<number>;
  };
  image: {
    count(args: {
      where: { id: string; boardMemberId: { not: null } };
    }): Promise<number>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
};

export function collectUploadedHeroImageIdsFromBlocks(
  blocks: readonly BlockInstance[],
): Set<string> {
  const imageIds = new Set<string>();

  for (const block of blocks) {
    if (block.type !== "hero") continue;

    const data = block.data as {
      image?: {
        kind?: string;
        imageId?: string;
      };
    };

    if (
      data.image?.kind === "uploaded" &&
      typeof data.image.imageId === "string"
    ) {
      imageIds.add(data.image.imageId);
    }
  }

  return imageIds;
}

export function getRemovedUploadedHeroImageIds(
  previousBlocks: readonly BlockInstance[],
  nextBlocks: readonly BlockInstance[],
): string[] {
  const nextImageIds = collectUploadedHeroImageIdsFromBlocks(nextBlocks);

  return [...collectUploadedHeroImageIdsFromBlocks(previousBlocks)].filter(
    (imageId) => !nextImageIds.has(imageId),
  );
}

export async function deleteCmsImagesIfUnreferenced({
  imageIds,
  prisma,
}: {
  imageIds: readonly string[];
  prisma: CmsImageLifecyclePrisma;
}) {
  const uniqueIds = [...new Set(imageIds.filter((id) => id.length > 0))];

  for (const imageId of uniqueIds) {
    const [pageReferences, eventReferences, boardMemberReferences] =
      await Promise.all([
        prisma.pageBlock.count({
          where: { data: { contains: `"imageId":"${imageId}"` } },
        }),
        prisma.event.count({
          where: { imageId },
        }),
        prisma.image.count({
          where: { id: imageId, boardMemberId: { not: null } },
        }),
      ]);

    if (
      pageReferences > 0 ||
      eventReferences > 0 ||
      boardMemberReferences > 0
    ) {
      continue;
    }

    try {
      await prisma.image.delete({ where: { id: imageId } });
    } catch {
      // best-effort cleanup
    }
  }
}
