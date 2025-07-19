import { parseWithZod } from "@conform-to/zod/v4";
import { parseFormData, type FileUpload } from "@mjackson/form-data-parser";
import type { MetaFunction } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { getClientHints } from "~/utils/client-hints.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { EventSchema } from "~/utils/event-validation";
import { offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];
const EVENT_TIMEZONE = "Europe/Zurich";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const addresses = await getAddresses();

  return {
    validImageTypes,
    addresses,
  };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Create Dinner" }];
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const { userTimezone, userTimezoneOffset } = getClientHints(request);

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  const submission = parseWithZod(formData, {
    schema: EventSchema,
  });

  if (
    submission.status !== "success" &&
    submission.payload &&
    submission.payload.cover
  ) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await fileStorage.remove(getStorageKey("temporary-key"));
  }

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const {
    title,
    description,
    menuDescription,
    donationDescription,
    date,
    slots,
    price,
    discounts,
    cover,
    addressId,
  } = submission.value;

  const eventImage = await prisma.image.create({
    data: {
      contentType: cover.type,
      blob: Buffer.from(await cover.arrayBuffer()),
    },
  });

  logger.info(`Client zone offset: ${userTimezoneOffset}`);
  logger.info(`Client zone: ${userTimezone}`);

  const eventDate = Date.parse(
    date.toLocaleString(undefined, { timeZone: EVENT_TIMEZONE }),
  );

  const userDate = Date.parse(
    date.toLocaleString(undefined, { timeZone: userTimezone }),
  );

  const localeDifference = (eventDate - userDate) / (60 * 1000);

  logger.info(`Difference in locales: ${localeDifference}`);

  const event = await createEvent({
    title,
    description,
    menuDescription,
    donationDescription,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -(localeDifference + userTimezoneOffset)),
    slots,
    price,
    discounts,
    addressId: addressId,
    imageId: eventImage.id,
    createdById: user.id,
  });

  // Remove the file from disk.
  // It is in the database now.
  await fileStorage.remove(getStorageKey("temporary-key"));

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();

  return (
    <>
      <div>Create a new dinner</div>
      <AdminDinnerForm
        schema={EventSchema}
        validImageTypes={validImageTypes}
        addresses={addresses}
        lastResult={lastResult}
        submitText="Create Dinner"
      />
    </>
  );
}
