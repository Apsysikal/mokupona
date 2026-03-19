import { useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { FileUpload } from "@remix-run/form-data-parser";
import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";
import { useEffect, useRef, useState } from "react";
import { redirect, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.dinners.$dinnerId_.edit";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import { getClientHints } from "~/utils/client-hints.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { EventSchema } from "~/utils/event-validation";
import { offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EVENT_TIMEZONE = "Europe/Zurich";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { dinner } = data;
  if (!dinner) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const { userTimezone, userTimezoneOffset } = getClientHints(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const addresses = await getAddresses();
  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  logger.info(`Client zone offset: ${userTimezoneOffset}`);
  logger.info(`Client zone: ${userTimezone}`);

  const eventDate = Date.parse(
    event.date.toLocaleString(undefined, { timeZone: EVENT_TIMEZONE }),
  );

  const userDate = Date.parse(
    event.date.toLocaleString(undefined, { timeZone: userTimezone }),
  );

  const localeDifference = (eventDate - userDate) / (60 * 1000);

  logger.info(`Difference in locales: ${localeDifference}`);

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
    dinner: {
      ...event,
      date: offsetDate(event.date, localeDifference + userTimezoneOffset)
        .toISOString()
        .substring(0, 16),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const schema = EventSchema.partial({ cover: true });
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const { userTimezone, userTimezoneOffset } = getClientHints(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === "cover") {
      let storageKey = getStorageKey("temporary-key");
      await fileStorage.set(storageKey, fileUpload);
      return fileUpload;
    }
  };

  let formData: FormData;

  try {
    formData = await parseFormData(
      request,
      { maxFileSize: 1024 * 1024 * 4, maxFiles: 1 },
      uploadHandler,
    );
  } catch (error) {
    if (
      error instanceof MaxFileSizeExceededError ||
      (error instanceof FormDataParseError &&
        "cause" in error &&
        error.cause instanceof MaxFileSizeExceededError)
    ) {
      return {
        uploadHandlerError: "File cannot be greater than 3MB",
      };
    } else if (
      error instanceof MaxFilesExceededError ||
      (error instanceof FormDataParseError &&
        "cause" in error &&
        error.cause instanceof MaxFilesExceededError)
    ) {
      return {
        uploadHandlerError: "You can only upload one file",
      };
    } else {
      throw error;
    }
  }

  const submission = parseWithZod(formData, {
    schema,
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

  let eventImage;

  if (cover) {
    eventImage = await prisma.image.create({
      data: {
        contentType: cover.type,
        blob: Buffer.from(await cover.arrayBuffer()),
      },
    });

    // Remove the file from disk.
    // It is in the database now.
    await fileStorage.remove(getStorageKey("temporary-key"));
  }

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

  const event = await updateEvent(dinnerId, {
    title,
    description,
    menuDescription,
    donationDescription,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -(localeDifference + userTimezoneOffset)),
    slots,
    price,
    discounts,
    addressId,
    ...(eventImage && { imageId: eventImage.id }),
    createdById: user.id,
  });

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const schema = EventSchema.partial({ cover: true });
  const { addresses, validImageTypes, dinner } = useLoaderData<typeof loader>();
  const lastSubmission = useActionData<typeof action>();
  const coverErrors =
    lastSubmission && "uploadHandlerError" in lastSubmission
      ? [lastSubmission.uploadHandlerError]
      : undefined;
  const lastResult =
    lastSubmission && "uploadHandlerError" in lastSubmission
      ? undefined
      : lastSubmission;
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: {
      title: dinner.title,
      description: dinner.description,
      menuDescription: dinner.menuDescription,
      donationDescription: dinner.donationDescription,
      date: dinner.date,
      slots: dinner.slots,
      price: dinner.price,
      discounts: dinner.discounts,
      addressId: dinner.addressId,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const [textContent, setTextContent] = useState<string>();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!canUseDOM()) return;
    if (!textRef || !textRef.current) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    textRef.current.style.height = `${textRef.current.scrollHeight}px`;
  }, [textContent, textRef]);

  return (
    <>
      <AdminDinnerForm
        schema={EventSchema.partial({ cover: true })}
        validImageTypes={validImageTypes}
        addresses={addresses}
        lastResult={lastResult}
        coverErrors={coverErrors}
        defaultValues={{
          title: dinner.title,
          description: dinner.description,
          menuDescription: dinner.menuDescription || undefined,
          donationDescription: dinner.donationDescription || undefined,
          date: dinner.date,
          slots: dinner.slots,
          price: dinner.price,
          discounts: dinner.discounts || undefined,
          addressId: dinner.addressId,
        }}
        submitText="Update Dinner"
      />
    </>
  );
}

export function canUseDOM() {
  return !!(
    typeof window !== "undefined" &&
    typeof window.document !== "undefined" &&
    typeof window.document.createElement !== "undefined"
  );
}
