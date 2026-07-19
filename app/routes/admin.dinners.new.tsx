import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventForm } from "~/features/events/components/admin-event-form";
import { EventSchema } from "~/features/events/event-schema";
import { toUtcEventDate } from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
} from "~/features/signup-form/builder";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { fileToImageData } from "~/models/image.server";
import { VALID_IMAGE_TYPES } from "~/shared/image";

export async function loader() {
  const addresses = await getAddresses();

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);

  return withParsedImageForm(request, {
    fieldName: "cover",
    schema: EventSchema,
    async onSuccess({ value }) {
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
      } = value;

      const event = await createEvent(
        {
          title,
          description,
          menuDescription,
          donationDescription,
          date: toUtcEventDate(date),
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
    },
  });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Dinner" }];
};

export default function AdminDinnerNewPage({
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
        <AdminEventForm
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
