import { parseWithZod } from "@conform-to/zod";
import { parseFormData, type FileUpload } from "@mjackson/form-data-parser";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { EventSchema } from "~/utils/event-validation";
import { getTimezone, getTimezoneOffset, offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request }: LoaderFunctionArgs) {
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

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  const timeZone = getTimezone(request);

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  const submission = parseWithZod(formData, {
    schema: (intent) =>
      EventSchema.superRefine((data) => {
        if (intent !== null) return { ...data };
      }),
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

  const eventImage = await prisma.eventImage.create({
    data: {
      contentType: cover.type,
      blob: Buffer.from(await cover.arrayBuffer()),
    },
  });

  logger.info(`Zone offset: ${timeOffset}`);
  logger.info(`Zone: ${timeZone}`);

  const localDate = Date.parse(
    date.toLocaleString(undefined, { timeZone: timeZone }),
  );
  const userLocalizedDate = Date.parse(date.toLocaleString(undefined));
  const localeDifference = (localDate - userLocalizedDate) / (60 * 1000);

  logger.debug(`Locale difference: ${localeDifference}`);

  const event = await createEvent({
    title,
    description,
    menuDescription,
    donationDescription,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -localeDifference),
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
