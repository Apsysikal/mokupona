import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.edit";

import {
  AdminDinnerForm,
  splitUploadActionData,
  toAddressOptions,
} from "~/components/admin-dinner-form";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
} from "~/features/signup-form/builder";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";
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

export function meta({ loaderData }: Route.MetaArgs) {
  const { dinner } = loaderData;

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const clientHints = getClientHints(request);

  const { dinnerId } = params;

  const [addresses, event, version] = await Promise.all([
    getAddresses(),
    getEventById(dinnerId),
    getCurrentFormVersionForEvent(dinnerId),
  ]);

  if (!event || !version) throw new Response("Not found", { status: 404 });

  logger.info(`Client zone offset: ${clientHints.userTimezoneOffset}`);
  logger.info(`Client zone: ${clientHints.userTimezone}`);

  // an unparseable stored schema (a bug state) surfaces as the default form;
  // saving then repairs the event's form
  const storedFields = parseStoredFormSchemaOrLog(version);

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
    signupForm: storedFields
      ? descriptorsToBuilderRows(storedFields)
      : defaultBuilderRows(),
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
    signupForm,
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

  // event data and the authored form persist in one transaction; the form
  // follows the §9 versioning policy (deep-equal skip / in-place while
  // unsubmitted / new version), validated by SignupFormSchema inside
  // EventSchema's signupForm field
  const event = await updateEvent(
    dinnerId,
    {
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
    },
    builderRowsToDescriptors(signupForm),
  );

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const schema = EventSchema.partial({ cover: true });
  const { addresses, validImageTypes, dinner, signupForm } = loaderData;
  const { coverErrors, lastResult } = splitUploadActionData(actionData);
  const addressOptions = toAddressOptions(addresses);

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: {
      ...dinner,
      signupForm,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <FormProvider context={form.context}>
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        {...getFormProps(form)}
      >
        <AdminDinnerForm
          fields={fields}
          addressOptions={addressOptions}
          validImageTypes={validImageTypes}
          coverErrors={coverErrors}
          submitText="Update Dinner"
        />
      </Form>
    </FormProvider>
  );
}
