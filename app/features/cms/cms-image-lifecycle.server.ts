import {
  type BlockInstance,
  type CmsCatalog,
  UnknownBlockTypeError,
} from "./catalog";

export type CmsImageLifecyclePrisma = {
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

export function collectUploadedImageIds(
  blocks: readonly BlockInstance[],
  catalog: CmsCatalog,
): Set<string> {
  const imageIds = new Set<string>();

  for (const block of blocks) {
    try {
      const ids = catalog
        .getBlockDefinition(block.type)
        .getUploadedImageIds?.(block.data);
      for (const imageId of ids ?? []) {
        if (imageId.length > 0) {
          imageIds.add(imageId);
        }
      }
    } catch (error) {
      if (!(error instanceof UnknownBlockTypeError)) {
        throw error;
      }
    }
  }

  return imageIds;
}

function getRemovedUploadedImageIds(
  previousBlocks: readonly BlockInstance[],
  nextBlocks: readonly BlockInstance[],
  catalog: CmsCatalog,
): string[] {
  const nextImageIds = collectUploadedImageIds(nextBlocks, catalog);

  return [...collectUploadedImageIds(previousBlocks, catalog)].filter((id) => {
    return !nextImageIds.has(id);
  });
}

export async function reconcileCmsImageLifecycle({
  previousBlocks,
  nextBlocks,
  prisma,
  catalog,
}: {
  previousBlocks: readonly BlockInstance[];
  nextBlocks: readonly BlockInstance[];
  prisma: CmsImageLifecyclePrisma;
  catalog: CmsCatalog;
}) {
  const removedImageIds = getRemovedUploadedImageIds(
    previousBlocks,
    nextBlocks,
    catalog,
  );

  if (removedImageIds.length === 0) {
    return;
  }

  await deleteCmsImagesIfUnreferenced({
    imageIds: removedImageIds,
    prisma,
  });
}

export async function discardOrphanedUploadedImage({
  imageId,
  prisma,
}: {
  imageId: string;
  prisma: CmsImageLifecyclePrisma;
}) {
  if (imageId.length === 0) {
    return;
  }

  await deleteCmsImagesIfUnreferenced({
    imageIds: [imageId],
    prisma,
  });
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
