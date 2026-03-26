import { parseWithZod } from "@conform-to/zod/v4";
import type { MetaFunction } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { getClientHints } from "~/utils/client-hints.server";
import { toUtcEventDate } from "~/utils/event-timezone.server";
import { EventSchema } from "~/utils/event-validation";
import { parseImageFormData } from "~/utils/image-upload.server";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

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
  const clientHints = getClientHints(request);

  const uploadResult = await parseImageFormData(request, "cover");

  if (!uploadResult.success) {
    return { uploadHandlerError: uploadResult.uploadError };
  }

  const submission = parseWithZod(uploadResult.formData, {
    schema: EventSchema,
  });

  if (
    submission.status !== "success" &&
    submission.payload &&
    submission.payload.cover
  ) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await uploadResult.discardImage();
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

  logger.info(`Client zone offset: ${clientHints.userTimezoneOffset}`);
  logger.info(`Client zone: ${clientHints.userTimezone}`);

  const imageId = await uploadResult.persistImage(cover);

  const event = await createEvent({
    title,
    description,
    menuDescription,
    donationDescription,
    date: toUtcEventDate(date),
    slots,
    price,
    discounts,
    addressId,
    imageId,
    createdById: user.id,
  });

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes } = useLoaderData<typeof loader>();
  const lastSubmission = useActionData<typeof action>();
  const coverErrors =
    lastSubmission && "uploadHandlerError" in lastSubmission
      ? [lastSubmission.uploadHandlerError]
      : undefined;
  const lastResult =
    lastSubmission && "uploadHandlerError" in lastSubmission
      ? undefined
      : lastSubmission;

  return (
    <>
      <div>Create a new dinner</div>
      <AdminDinnerForm
        schema={EventSchema}
        validImageTypes={validImageTypes}
        addresses={addresses}
        lastResult={lastResult}
        coverErrors={coverErrors}
        submitText="Create Dinner"
      />
    </>
  );
}
