import { useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { FileUpload, parseFormData } from "@mjackson/form-data-parser";
import { useEffect, useRef, useState } from "react";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { getClientLocales } from "remix-utils/locales/server";
import invariant from "tiny-invariant";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { EventSchema } from "~/utils/event-validation";
import { getTimezone, getTimezoneOffset, offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  const timeZone = getTimezone(request);
  const locale = (getClientLocales(request) ?? ["de-CH,de"])[0].split(",")[1];

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const addresses = await getAddresses();
  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  logger.info(`Zone offset: ${timeOffset}`);
  logger.info(`Zone: ${timeZone}`);
  logger.info(`Locale: ${locale}`);

  const localDate = Date.parse(
    event.date.toLocaleString(locale, {
      timeZone: "Europe/Zurich",
    }),
  );
  const userLocalizedDate = Date.parse(event.date.toLocaleString(locale));
  const localeDifference = (localDate - userLocalizedDate) / (60 * 1000);

  logger.debug(`Locale difference: ${localDate}`);
  logger.debug(`Locale difference: ${userLocalizedDate}`);
  logger.debug(`Locale difference: ${localeDifference}`);

  return {
    validImageTypes,
    addresses,
    dinner: {
      ...event,
      date: offsetDate(event.date, localeDifference)
        .toISOString()
        .substring(0, 16),
    },
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { dinner } = data;
  if (!dinner) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
};

export async function action({ request, params }: ActionFunctionArgs) {
  const schema = EventSchema.partial({ cover: true });
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  const timeZone = getTimezone(request);
  const locale = (getClientLocales(request) ?? ["de-CH,de"])[0].split(",")[1];

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  const submission = parseWithZod(formData, {
    schema: (intent) =>
      schema.superRefine((data) => {
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

  let eventImage;

  if (cover) {
    eventImage = await prisma.eventImage.create({
      data: {
        contentType: cover.type,
        blob: Buffer.from(await cover.arrayBuffer()),
      },
    });

    // Remove the file from disk.
    // It is in the database now.
    await fileStorage.remove(getStorageKey("temporary-key"));
  }

  logger.info(`Zone offset: ${timeOffset}`);
  logger.info(`Zone: ${timeZone}`);
  logger.info(`Locale: ${locale}`);

  const localDate = Date.parse(
    date.toLocaleString(locale, { timeZone: "Europe/Zurich" }),
  );
  const userLocalizedDate = Date.parse(date.toLocaleString(locale));
  const localeDifference = (localDate - userLocalizedDate) / (60 * 1000);

  logger.debug(`Locale difference: ${localeDifference}`);

  const event = await updateEvent(dinnerId, {
    title,
    description,
    menuDescription,
    donationDescription,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -localeDifference),
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
  const lastResult = useActionData<typeof action>();
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

function toISOString(date: Date) {}
