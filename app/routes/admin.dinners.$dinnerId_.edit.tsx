import { useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useEffect, useRef, useState } from "react";
import { redirect, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.dinners.$dinnerId_.edit";

import { AdminDinnerForm } from "~/components/admin-dinner-form";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import { getClientHints } from "~/utils/client-hints.server";
import {
  toDisplayEventDate,
  toUtcEventDate,
} from "~/utils/event-timezone.server";
import { EventSchema } from "~/utils/event-validation";
import { parseImageFormData } from "~/utils/image-upload.server";
import { nullableStringUpdateValue } from "~/utils/nullable-update-field.server";
import { requireUserWithRole } from "~/utils/session.server";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { dinner } = data;
  if (!dinner) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const clientHints = getClientHints(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const addresses = await getAddresses();
  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  logger.info(`Client zone offset: ${clientHints.userTimezoneOffset}`);
  logger.info(`Client zone: ${clientHints.userTimezone}`);

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
    dinner: {
      ...event,
      date: toDisplayEventDate(event.date, clientHints),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const schema = EventSchema.partial({ cover: true });
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const clientHints = getClientHints(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const uploadResult = await parseImageFormData(request, "cover");

  if (!uploadResult.success) {
    return { uploadHandlerError: uploadResult.uploadError };
  }

  const submission = parseWithZod(uploadResult.formData, {
    schema,
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
    date,
    slots,
    price,
    discounts,
    cover,
    addressId,
  } = submission.value;

  logger.info(`Client zone offset: ${clientHints.userTimezoneOffset}`);
  logger.info(`Client zone: ${clientHints.userTimezone}`);

  const imageId = cover ? await uploadResult.persistImage(cover) : undefined;
  const menuDescriptionUpdateValue = nullableStringUpdateValue({
    formData: uploadResult.formData,
    fieldName: "menuDescription",
  });
  const donationDescriptionUpdateValue = nullableStringUpdateValue({
    formData: uploadResult.formData,
    fieldName: "donationDescription",
  });

  const event = await updateEvent(dinnerId, {
    title,
    description,
    ...(menuDescriptionUpdateValue !== undefined && {
      menuDescription: menuDescriptionUpdateValue,
    }),
    ...(donationDescriptionUpdateValue !== undefined && {
      donationDescription: donationDescriptionUpdateValue,
    }),
    date: toUtcEventDate(date, clientHints),
    slots,
    price,
    discounts,
    addressId,
    ...(imageId && { imageId }),
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
