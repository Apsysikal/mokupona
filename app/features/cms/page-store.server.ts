import type { BlockInstance } from "./catalog";
import type { CmsPageStore, PersistedPageRecord } from "./page-service.server";

import { planBlockOperations, type BlockOperation } from "./block-operations";
import { Prisma } from "~/db.server";
import { prisma as defaultPrisma } from "~/db.server";

type PageStoreClient = Pick<
  typeof defaultPrisma,
  "$transaction" | "page" | "pageBlock"
>;

type PageStoreReader = Pick<typeof defaultPrisma, "page">;
type PageBlockWriter = Pick<typeof defaultPrisma, "pageBlock">;

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
    async updatePage({
      pageKey,
      expectedRevision,
      title,
      description,
      blocks,
    }) {
      return prisma.$transaction(async (tx) => {
        const existingPage = await tx.page.findUnique({
          where: { pageKey },
          select: { id: true, revision: true },
        });

        if (!existingPage) {
          return { status: "conflict" as const, persistedPage: null };
        }

        if (existingPage.revision !== expectedRevision) {
          return {
            status: "conflict" as const,
            persistedPage: await requirePersistedPage(tx, pageKey),
          };
        }

        await tx.page.update({
          where: { id: existingPage.id },
          data: { title, description, revision: { increment: 1 } },
        });

        const existingBlocks = await tx.pageBlock.findMany({
          where: { pageId: existingPage.id },
          select: { id: true },
        });
        const operations = planBlockOperations(
          existingBlocks,
          blocks,
          existingPage.id,
        );

        await executeBlockOperations(tx, operations);

        return {
          status: "saved" as const,
          materialization: "updated" as const,
          persistedPage: await requirePersistedPage(tx, pageKey),
        };
      });
    },
    async deletePage(pageKey) {
      await prisma.page.delete({ where: { pageKey } });
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

async function executeBlockOperations(
  tx: PageBlockWriter,
  operations: readonly BlockOperation[],
) {
  for (const operation of operations) {
    switch (operation.op) {
      case "delete":
        await tx.pageBlock.deleteMany({
          where: { id: { in: [operation.id] } },
        });
        break;
      case "shift":
        await tx.pageBlock.updateMany({
          where: { id: { in: operation.ids } },
          data: {
            position: {
              increment: operation.by,
            },
          },
        });
        break;
      case "update":
        await tx.pageBlock.update({
          where: { id: operation.id },
          data: {
            definitionKey: operation.block.definitionKey ?? null,
            type: operation.block.type,
            version: operation.block.version,
            position: operation.position,
            data: JSON.stringify(operation.block.data),
          },
        });
        break;
      case "create":
        await tx.pageBlock.create({
          data: {
            pageId: operation.pageId,
            definitionKey: operation.block.definitionKey ?? null,
            type: operation.block.type,
            version: operation.block.version,
            position: operation.position,
            data: JSON.stringify(operation.block.data),
          },
        });
        break;
    }
  }
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
  id: string;
  definitionKey: string | null;
  type: string;
  version: number;
  data: string;
}): BlockInstance {
  return {
    ...(block.definitionKey ? { definitionKey: block.definitionKey } : {}),
    pageBlockId: block.id,
    type: block.type as BlockInstance["type"],
    version: block.version as BlockInstance["version"],
    data: JSON.parse(block.data),
  };
}
