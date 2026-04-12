import type { BlockInstance } from "./catalog";
import type { CmsPageStore, PersistedPageRecord } from "./page-service.server";

import { Prisma } from "~/db.server";
import { prisma as defaultPrisma } from "~/db.server";

type PageStoreClient = Pick<
  typeof defaultPrisma,
  "$transaction" | "page" | "pageBlock"
>;

type PageStoreReader = Pick<typeof defaultPrisma, "page">;

export function createPrismaCmsPageStore({
  prisma = defaultPrisma,
}: {
  prisma?: PageStoreClient;
} = {}): CmsPageStore {
  return {
    async readPage(pageKey) {
      return readPersistedPage(prisma, pageKey);
    },
    async materializePage({ page }) {
      try {
        return await prisma.$transaction(async (tx) => {
          const existingPage = await tx.page.findUnique({
            where: { pageKey: page.pageKey },
            select: { id: true },
          });

          if (existingPage) {
            return {
              status: "conflict" as const,
              persistedPage: await requirePersistedPage(tx, page.pageKey),
            };
          }

          const createdPage = await tx.page.create({
            data: {
              pageKey: page.pageKey,
              title: page.title,
              description: page.description,
              revision: 1,
            },
          });

          if (page.blocks.length > 0) {
            await tx.pageBlock.createMany({
              data: serializeBlocks(createdPage.id, page.blocks),
            });
          }

          return {
            status: "saved" as const,
            materialization: "created" as const,
            persistedPage: await requirePersistedPage(tx, page.pageKey),
          };
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return {
            status: "conflict" as const,
            persistedPage: await readPersistedPage(prisma, page.pageKey),
          };
        }

        throw error;
      }
    },
    async updatePageMeta({ pageKey, expectedRevision, title, description }) {
      return prisma.$transaction(async (tx) => {
        const existingPage = await tx.page.findUnique({
          where: { pageKey },
          select: { id: true, revision: true },
        });

        if (!existingPage) {
          return {
            status: "conflict" as const,
            persistedPage: null,
          };
        }

        if (existingPage.revision !== expectedRevision) {
          return {
            status: "conflict" as const,
            persistedPage: await requirePersistedPage(tx, pageKey),
          };
        }

        await tx.page.update({
          where: { id: existingPage.id },
          data: {
            title,
            description,
            revision: { increment: 1 },
          },
        });

        return {
          status: "saved" as const,
          materialization: "updated" as const,
          persistedPage: await requirePersistedPage(tx, pageKey),
        };
      });
    },
  };
}

async function readPersistedPage(
  prisma: PageStoreReader,
  pageKey: string,
): Promise<PersistedPageRecord | null> {
  const page = await prisma.page.findUnique({
    where: { pageKey },
    include: {
      blocks: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!page) {
    return null;
  }

  return {
    pageKey: page.pageKey,
    revision: page.revision,
    title: page.title,
    description: page.description,
    blocks: page.blocks.map(deserializeBlock),
  };
}

async function requirePersistedPage(prisma: PageStoreReader, pageKey: string) {
  const page = await readPersistedPage(prisma, pageKey);

  if (!page) {
    throw new Error(`Persisted page missing after write: ${pageKey}`);
  }

  return page;
}

function serializeBlocks(pageId: string, blocks: readonly BlockInstance[]) {
  return blocks.map((block, position) => ({
    pageId,
    definitionKey: block.definitionKey ?? null,
    type: block.type,
    version: block.version,
    position,
    data: JSON.stringify(block.data),
  }));
}

function deserializeBlock(block: {
  definitionKey: string | null;
  type: string;
  version: number;
  data: string;
}): BlockInstance {
  return {
    ...(block.definitionKey ? { definitionKey: block.definitionKey } : {}),
    type: block.type as BlockInstance["type"],
    version: block.version as BlockInstance["version"],
    data: JSON.parse(block.data),
  };
}
