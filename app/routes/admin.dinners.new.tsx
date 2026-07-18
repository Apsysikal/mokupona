import {
  FormProvider,
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import {
  AdminDinnerForm,
  toAddressOptions,
} from "~/components/admin-dinner-form";
import { userContext } from "~/features/auth/middleware.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
} from "~/features/signup-form/builder";
import { parseImageFormData } from "~/features/uploads/image-upload.server";
import { logger } from "~/logger.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { fileToImageData } from "~/models/image.server";
import { VALID_IMAGE_TYPES } from "~/shared/image";
import { getClientHints } from "~/utils/client-hints.server";
import { toUtcEventDate } from "~/utils/event-timezone.server";
import { EventSchema } from "~/utils/event-validation";

export async function loader() {
  const addresses = await getAddresses();

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const clientHints = getClientHints(request);

  const uploadResult = await parseImageFormData(request, "cover");

  if (!uploadResult.success) {
    // folded into the conform result so actionData has a single shape
    return {
      status: "error",
      error: { cover: [uploadResult.uploadError] },
    } satisfies SubmissionResult;
  }

  // Every exit below — validation failure (the file is sent again on
  // resubmit), success, or a thrown error — is done with the staged temp
  // file, so one idempotent discard in `finally` covers them all.
  try {
    const submission = parseWithZod(uploadResult.formData, {
      schema: EventSchema,
    });

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
        // the image row is created inside createEvent's transaction, so a
        // failed event write can no longer leak it
        image: await fileToImageData(cover),
        createdById: user.id,
      },
      // validated by SignupFormSchema inside EventSchema's signupForm field
      builderRowsToDescriptors(signupForm),
    );

    return redirect(`/admin/dinners/${event.id}`);
  } finally {
    await uploadResult.discardImage();
  }
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Dinner" }];
};

export default function DinnersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { addresses, validImageTypes } = loaderData;
  const addressOptions = toAddressOptions(addresses);

  const [form, fields] = useForm({
    lastResult: actionData,
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
          submitText="Save dinner"
          pageTitle="New dinner"
          cancelHref="/admin/dinners"
        />
      </Form>
    </FormProvider>
  );
}
