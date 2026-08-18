import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "~/db.server";
import {
  storeImage,
  type ImageFolder,
} from "~/features/images/image-storage.server";
import { deleteBoardMember as deleteBoardMemberRecord } from "~/models/board-member.server";
import { createEvent, deleteEvent } from "~/models/event.server";
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
      };
    }
  | {
      action: "get-image";
      payload: {
        id: string;
      };
    }
  | {
      action: "delete-image";
      payload: {
        id: string;
      };
    }
  | {
      action: "create-legacy-response";
      payload: {
        eventId: string;
        name: string;
        email?: string;
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
  imageId: string | null;
  imageStorageKey: string | null;
};

type BoardMemberResult = {
  id: string;
  name: string;
  position: string;
  imageId: string | null;
  imageStorageKey: string | null;
  imageCount: number;
};

type ImageResult = {
  id: string;
  contentType: string;
  storageKey: string | null;
} | null;

function toDinnerResult(
  event: {
    id: string;
    title: string;
    description: string;
    menuDescription: string | null;
    donationDescription: string | null;
    date: Date;
    slots: number;
    price: number;
    discounts: string | null;
    addressId: string;
  },
  // the cover arrives via the Event.imageId relation
  image: { id: string; storageKey: string | null } | null,
): DinnerResult {
  return {
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
    imageId: image?.id ?? null,
    imageStorageKey: image?.storageKey ?? null,
  };
}

function toBoardMemberResult(
  boardMember: {
    id: string;
    name: string;
    position: string;
    image: { id: string; storageKey: string | null } | null;
  },
  imageCount: number,
): BoardMemberResult {
  return {
    id: boardMember.id,
    name: boardMember.name,
    position: boardMember.position,
    imageId: boardMember.image?.id ?? null,
    imageStorageKey: boardMember.image?.storageKey ?? null,
    imageCount,
  };
}

async function getDefaultImageInput(folder: ImageFolder) {
  const bytes = await readFile(defaultImagePath);
  const file = new File([bytes], "default.jpg", { type: "image/jpeg" });

  return {
    contentType: "image/jpeg",
    ...(await storeImage(file, folder)),
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
    getDefaultImageInput("dinners"),
  ]);

  const event = await createEvent({
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
    image: imageData,
  });

  const { image: cover } = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
    select: { image: { select: { id: true, storageKey: true } } },
  });

  return outputJson<DinnerResult>(toDinnerResult(event, cover));
}

async function getDinner(
  payload: Extract<CommandInput, { action: "get-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
    include: { image: { select: { id: true, storageKey: true } } },
  });

  if (!event) {
    return outputJson<null>(null);
  }

  return outputJson<DinnerResult>(toDinnerResult(event, event.image));
}

async function deleteDinner(
  payload: Extract<CommandInput, { action: "delete-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
    select: { id: true },
  });

  if (event) {
    await deleteEvent(event.id);
  }

  return outputJson({ deleted: Boolean(event) });
}

async function getImage(
  payload: Extract<CommandInput, { action: "get-image" }>,
) {
  const image = await prisma.image.findUnique({
    where: { id: payload.payload.id },
    select: { id: true, contentType: true, storageKey: true },
  });

  return outputJson<ImageResult>(image);
}

async function deleteImage(
  payload: Extract<CommandInput, { action: "delete-image" }>,
) {
  await prisma.image.deleteMany({
    where: { id: payload.payload.id },
  });

  return outputJson({ deleted: true, id: payload.payload.id });
}

async function createLegacyResponse(
  payload: Extract<CommandInput, { action: "create-legacy-response" }>,
) {
  const response = await prisma.eventResponse.create({
    data: {
      eventId: payload.payload.eventId,
      name: payload.payload.name,
      email: payload.payload.email ?? "legacy@example.com",
      phone: "000",
    },
  });

  return outputJson({ id: response.id, name: response.name });
}

async function createBoardMember(
  payload: Extract<CommandInput, { action: "create-board-member" }>,
) {
  const imageData = await getDefaultImageInput("board-members");

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
        select: { id: true, storageKey: true },
      },
    },
  });

  return outputJson<BoardMemberResult>(
    toBoardMemberResult(boardMember, boardMember.image ? 1 : 0),
  );
}

async function getBoardMember(
  payload: Extract<CommandInput, { action: "get-board-member" }>,
) {
  const boardMember = await prisma.boardMember.findUnique({
    where: { id: payload.payload.id },
    include: {
      image: {
        select: { id: true, storageKey: true },
      },
    },
  });

  if (!boardMember) {
    return outputJson<null>(null);
  }

  const imageCount = await prisma.image.count({
    where: { boardMember: { id: boardMember.id } },
  });

  return outputJson<BoardMemberResult>(
    toBoardMemberResult(boardMember, imageCount),
  );
}

async function getBoardMemberByName(
  payload: Extract<CommandInput, { action: "get-board-member-by-name" }>,
) {
  const boardMember = await prisma.boardMember.findFirst({
    where: { name: payload.payload.name },
    orderBy: { createdAt: "desc" },
    include: {
      image: {
        select: { id: true, storageKey: true },
      },
    },
  });

  if (!boardMember) {
    return outputJson<null>(null);
  }

  const imageCount = await prisma.image.count({
    where: { boardMember: { id: boardMember.id } },
  });

  return outputJson<BoardMemberResult>(
    toBoardMemberResult(boardMember, imageCount),
  );
}

async function deleteBoardMember(
  payload: Extract<CommandInput, { action: "delete-board-member" }>,
) {
  const boardMember = await prisma.boardMember.findUnique({
    where: { id: payload.payload.id },
    select: { id: true },
  });

  if (boardMember) {
    // through the model so the portrait image row goes with the member
    await deleteBoardMemberRecord(boardMember.id);
  }

  return outputJson({ deleted: Boolean(boardMember), id: payload.payload.id });
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
    case "get-image":
    case "delete-image":
    case "create-legacy-response":
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
    case "get-image":
      return getImage(command);
    case "delete-image":
      return deleteImage(command);
    case "create-legacy-response":
      return createLegacyResponse(command);
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
