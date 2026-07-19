import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "~/db.server";
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
};

type BoardMemberResult = {
  id: string;
  name: string;
  position: string;
  imageId: string | null;
  imageCount: number;
};

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
  // the cover FK lives on Image (eventId), so the id arrives via the relation
  imageId: string | null,
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
    imageId,
  };
}

function toBoardMemberResult(
  boardMember: {
    id: string;
    name: string;
    position: string;
    image: { id: string } | null;
  },
  imageCount: number,
): BoardMemberResult {
  return {
    id: boardMember.id,
    name: boardMember.name,
    position: boardMember.position,
    imageId: boardMember.image?.id ?? null,
    imageCount,
  };
}

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

  // createEvent (not prisma.event.create) so the event gets its form and its
  // cover image row in one transaction
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

  const cover = await prisma.image.findUnique({
    where: { eventId: event.id },
    select: { id: true },
  });

  return outputJson<DinnerResult>(toDinnerResult(event, cover?.id ?? null));
}

async function getDinner(
  payload: Extract<CommandInput, { action: "get-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
    include: { image: { select: { id: true } } },
  });

  if (!event) {
    return outputJson<null>(null);
  }

  return outputJson<DinnerResult>(
    toDinnerResult(event, event.image?.id ?? null),
  );
}

async function deleteDinner(
  payload: Extract<CommandInput, { action: "delete-dinner" }>,
) {
  const event = await prisma.event.findUnique({
    where: { id: payload.payload.id },
    include: { image: { select: { id: true } } },
  });

  const imageIds = [
    event?.image?.id,
    ...(payload.payload.extraImageIds ?? []),
  ].filter((imageId): imageId is string => Boolean(imageId));

  if (event) {
    // deleteEvent (not prisma.event.delete) so the form data goes with it;
    // the cover cascades at the DB level (Image.eventId)
    await deleteEvent(event.id);
  }

  // the event's own cover is already gone; this catches extraImageIds
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
  // The FK lives on Image, so deleting an image never touches an event —
  // an attached event simply loses its cover.
  await prisma.image.deleteMany({
    where: { id: payload.payload.id },
  });

  return outputJson({ deleted: true, id: payload.payload.id });
}

// Legacy EventResponse rows can no longer be produced through the app (the
// write path moved to FormSubmission); tests exercising the legacy merge
// insert them directly.
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

  return outputJson<BoardMemberResult>(
    toBoardMemberResult(boardMember, imageCount),
  );
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
