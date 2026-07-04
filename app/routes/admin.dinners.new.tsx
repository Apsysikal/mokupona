import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import {
  AdminDinnerForm,
  splitUploadActionData,
  toAddressOptions,
} from "~/components/admin-dinner-form";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
} from "~/features/signup-form/builder";
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

export const meta: Route.MetaFunction = () => {
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
    signupForm,
  } = submission.value;

  logger.info(`Client zone offset: ${clientHints.userTimezoneOffset}`);
  logger.info(`Client zone: ${clientHints.userTimezone}`);

  const imageId = await uploadResult.persistImage(cover);

  const event = await createEvent(
    {
      title,
      description,
      menuDescription,
      donationDescription,
      date: toUtcEventDate(date, clientHints),
      slots,
      price,
      discounts,
      addressId,
      imageId,
      createdById: user.id,
    },
    // validated by SignupFormSchema inside EventSchema's signupForm field
    builderRowsToDescriptors(signupForm),
  );

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { addresses, validImageTypes } = loaderData;
  const { coverErrors, lastResult } = splitUploadActionData(actionData);
  const addressOptions = toAddressOptions(addresses);

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(EventSchema),
    defaultValue: {
      signupForm: defaultBuilderRows(),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: EventSchema });
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
          submitText="Create Dinner"
          pageTitle="Create a new dinner"
          cancelHref="/admin/dinners"
        />
      </Form>
    </FormProvider>
  );
}
