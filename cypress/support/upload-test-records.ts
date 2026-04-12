import { readFile } from "node:fs/promises";
import path from "node:path";

import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { prisma } from "~/db.server";
import { getUserByEmail } from "~/models/user.server";

const defaultImagePath = path.resolve(process.cwd(), "prisma/default.jpg");
const moderatorEmail = "moderator@mokupona.ch";

type CommandInput =
  | {
      action: "create-dinner";
      payload: {
        title: string;
        description?: string;
        menuDescription?: string;
        donationDescription?: string;
        date?: string;
        slots?: number;
        price?: number;
        discounts?: string;
      };
    }
  | {
      action: "get-dinner";
      payload: {
        id: string;
      };
    }
  | {
      action: "delete-dinner";
      payload: {
        id: string;
        extraImageIds?: string[];
      };
    }
  | {
      action: "delete-image";
      payload: {
        id: string;
      };
    }
  | {
      action: "delete-page";
      payload: {
        pageKey: string;
      };
    }
  | {
      action: "seed-invalid-page";
      payload: {
        pageKey: "home";
      };
    }
  | {
      action: "save-page-meta";
      payload: {
        pageKey: "home";
        title: string;
        description: string;
      };
    }
  | {
      action: "create-board-member";
      payload: {
        name: string;
        position?: string;
      };
    }
  | {
      action: "get-board-member";
      payload: {
        id: string;
      };
    }
  | {
      action: "get-board-member-by-name";
      payload: {
        name: string;
      };
    }
  | {
      action: "delete-board-member";
      payload: {
        id: string;
      };
    };

type DinnerResult = {
  id: string;
  title: string;
  description: string;
  menuDescription: string | null;
  donationDescription: string | null;
  date: string;
  slots: number;
  price: number;
  discounts: string | null;
  addressId: string;
  imageId: string;
};

type BoardMemberResult = {
  id: string;
  name: string;
  position: string;
  imageId: string | null;
  imageCount: number;
};

async function getDefaultImageInput() {
  const blob = await readFile(defaultImagePath);

  return {
    contentType: "image/jpeg",
    blob: Buffer.from(blob),
  };
}

async function requireModeratorId() {
  const moderator = await getUserByEmail(moderatorEmail);

  if (!moderator) {
    throw new Error(
      "Seeded moderator user not found. Run the seed script before Cypress tests.",
    );
  }

  return moderator.id;
}

async function requireAddressId() {
  const address = await prisma.address.findFirst({
    orderBy: { id: "asc" },
  });

  if (!address) {
    throw new Error(
      "No address found. Run the seed script before Cypress tests.",
    );
  }

  return address.id;
}

async function createDinner(
  payload: Extract<CommandInput, { action: "create-dinner" }>,
) {
  const [moderatorId, addressId, imageData] = await Promise.all([
    requireModeratorId(),
    requireAddressId(),
    getDefaultImageInput(),
  ]);

  const image = await prisma.image.create({
    data: imageData,
  });

  const event = await prisma.event.create({
    data: {
      title: payload.payload.title,
      description:
        payload.payload.description ?? `${payload.payload.title} description`,
      menuDescription:
        payload.payload.menuDescription ?? `${payload.payload.title} menu`,
      donationDescription:
        payload.payload.donationDescription ??
        `${payload.payload.title} donation`,
      date: payload.payload.date
        ? new Date(payload.payload.date)
        : new Date("2035-01-01T18:30:00.000Z"),
      slots: payload.payload.slots ?? 16,
      price: payload.payload.price ?? 25,
      discounts:
        payload.payload.discounts ?? `${payload.payload.title} discounts`,
      addressId,
      createdById: moderatorId,
      imageId: image.id,
    },
  });

  return outputJson<DinnerResult>({
    id: event.id,
    title: event.title,
    description: event.description,
    menuDescription: event.menuDescription,
    donationDescription: event.donationDescription,
    date: event.date.toISOString(),
    slots: event.slots,
    price: event.price,
    discounts: event.discounts,
    addressId: event.addressId,
    imageId: event.imageId,
  });
}

async function getDinner(
  payload: Extract<CommandInput, { action: "get-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
  });

  if (!event) {
    return outputJson<null>(null);
  }

  return outputJson<DinnerResult>({
    id: event.id,
    title: event.title,
    description: event.description,
    menuDescription: event.menuDescription,
    donationDescription: event.donationDescription,
    date: event.date.toISOString(),
    slots: event.slots,
    price: event.price,
    discounts: event.discounts,
    addressId: event.addressId,
    imageId: event.imageId,
  });
}

async function deleteDinner(
  payload: Extract<CommandInput, { action: "delete-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
    select: { id: true, imageId: true },
  });

  const imageIds = [
    event?.imageId,
    ...(payload.payload.extraImageIds ?? []),
  ].filter((imageId): imageId is string => Boolean(imageId));

  if (event) {
    await prisma.event.delete({ where: { id: event.id } });
  }

  if (imageIds.length > 0) {
    await prisma.image.deleteMany({
      where: { id: { in: imageIds } },
    });
  }

  return outputJson({
    deleted: Boolean(event),
    deletedImageIds: imageIds,
  });
}

async function deleteImage(
  payload: Extract<CommandInput, { action: "delete-image" }>,
) {
  await prisma.image.deleteMany({
    where: { id: payload.payload.id },
  });

  return outputJson({ deleted: true, id: payload.payload.id });
}

async function deletePage(
  payload: Extract<CommandInput, { action: "delete-page" }>,
) {
  await prisma.page.deleteMany({
    where: { pageKey: payload.payload.pageKey },
  });

  return outputJson({ deleted: true, pageKey: payload.payload.pageKey });
}

async function seedInvalidPage(
  payload: Extract<CommandInput, { action: "seed-invalid-page" }>,
) {
  await prisma.page.deleteMany({
    where: { pageKey: payload.payload.pageKey },
  });

  const page = await prisma.page.create({
    data: {
      pageKey: payload.payload.pageKey,
      title: "broken persisted title",
      description: "broken persisted description",
      revision: 1,
      blocks: {
        create: {
          type: "hero",
          version: 1,
          position: 0,
          data: JSON.stringify({}),
        },
      },
    },
    include: {
      blocks: {
        orderBy: { position: "asc" },
      },
    },
  });

  return outputJson({
    pageKey: page.pageKey,
    revision: page.revision,
    blockCount: page.blocks.length,
  });
}

async function savePageMeta(
  payload: Extract<CommandInput, { action: "save-page-meta" }>,
) {
  const result = await siteCmsPageService.applyPageCommand({
    type: "set-page-meta",
    pageKey: payload.payload.pageKey,
    baseRevision: null,
    title: payload.payload.title,
    description: payload.payload.description,
  });

  if (result.status !== "saved") {
    throw new Error(
      `Could not materialize page ${payload.payload.pageKey} for Cypress setup`,
    );
  }

  return outputJson({
    pageKey: result.editorModel.pageKey,
    revision: result.editorModel.status.revision,
    title: result.editorModel.pageSnapshot.title,
    description: result.editorModel.pageSnapshot.description,
  });
}

async function createBoardMember(
  payload: Extract<CommandInput, { action: "create-board-member" }>,
) {
  const imageData = await getDefaultImageInput();

  const boardMember = await prisma.boardMember.create({
    data: {
      name: payload.payload.name,
      position: payload.payload.position ?? "Cypress Position",
      image: {
        create: imageData,
      },
    },
    include: {
      image: {
        select: { id: true },
      },
    },
  });

  return outputJson<BoardMemberResult>({
    id: boardMember.id,
    name: boardMember.name,
    position: boardMember.position,
    imageId: boardMember.image?.id ?? null,
    imageCount: boardMember.image ? 1 : 0,
  });
}

async function getBoardMember(
  payload: Extract<CommandInput, { action: "get-board-member" }>,
) {
  const boardMember = await prisma.boardMember.findUnique({
    where: { id: payload.payload.id },
    include: {
      image: {
        select: { id: true },
      },
    },
  });

  if (!boardMember) {
    return outputJson<null>(null);
  }

  const imageCount = await prisma.image.count({
    where: { boardMemberId: boardMember.id },
  });

  return outputJson<BoardMemberResult>({
    id: boardMember.id,
    name: boardMember.name,
    position: boardMember.position,
    imageId: boardMember.image?.id ?? null,
    imageCount,
  });
}

async function getBoardMemberByName(
  payload: Extract<CommandInput, { action: "get-board-member-by-name" }>,
) {
  const boardMember = await prisma.boardMember.findFirst({
    where: { name: payload.payload.name },
    orderBy: { createdAt: "desc" },
    include: {
      image: {
        select: { id: true },
      },
    },
  });

  if (!boardMember) {
    return outputJson<null>(null);
  }

  const imageCount = await prisma.image.count({
    where: { boardMemberId: boardMember.id },
  });

  return outputJson<BoardMemberResult>({
    id: boardMember.id,
    name: boardMember.name,
    position: boardMember.position,
    imageId: boardMember.image?.id ?? null,
    imageCount,
  });
}

async function deleteBoardMember(
  payload: Extract<CommandInput, { action: "delete-board-member" }>,
) {
  await prisma.boardMember.deleteMany({
    where: { id: payload.payload.id },
  });

  return outputJson({ deleted: true, id: payload.payload.id });
}

function parseCommand(): CommandInput {
  const action = process.argv[2];
  const payload = process.argv[3]
    ? JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"))
    : {};

  switch (action) {
    case "create-dinner":
    case "get-dinner":
    case "delete-dinner":
    case "delete-image":
    case "delete-page":
    case "seed-invalid-page":
    case "save-page-meta":
    case "create-board-member":
    case "get-board-member":
    case "get-board-member-by-name":
    case "delete-board-member":
      return { action, payload } as CommandInput;
    default:
      throw new Error(`Unsupported upload test action: ${String(action)}`);
  }
}

function outputJson<T>(value: T) {
  process.stdout.write(JSON.stringify(value));
}

async function main() {
  const command = parseCommand();

  switch (command.action) {
    case "create-dinner":
      return createDinner(command);
    case "get-dinner":
      return getDinner(command);
    case "delete-dinner":
      return deleteDinner(command);
    case "delete-image":
      return deleteImage(command);
    case "delete-page":
      return deletePage(command);
    case "seed-invalid-page":
      return seedInvalidPage(command);
    case "save-page-meta":
      return savePageMeta(command);
    case "create-board-member":
      return createBoardMember(command);
    case "get-board-member":
      return getBoardMember(command);
    case "get-board-member-by-name":
      return getBoardMemberByName(command);
    case "delete-board-member":
      return deleteBoardMember(command);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
