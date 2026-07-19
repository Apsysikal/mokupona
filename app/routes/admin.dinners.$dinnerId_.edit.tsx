import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.edit";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventForm } from "~/features/events/components/admin-event-form";
import { EventSchema } from "~/features/events/event-schema";
import {
  toDisplayEventDate,
  toUtcEventDate,
} from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
} from "~/features/signup-form/builder";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import { getAddresses } from "~/models/address.server";
import {
  getEventWithCurrentFormVersion,
  updateEvent,
} from "~/models/event.server";
import { eventHasSignups } from "~/models/form-submission.server";
import { fileToImageData } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { VALID_IMAGE_TYPES } from "~/shared/image";
import { nullableStringUpdateValue } from "~/utils/nullable-update-field.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const [addresses, eventWithVersion, formHasSubmissions] = await Promise.all([
    getAddresses(),
    getEventWithCurrentFormVersion(dinnerId).then(requireFound),
    eventHasSignups(dinnerId),
  ]);
  const { event, version } = eventWithVersion;

  // an unparseable stored schema (a bug state) surfaces as the default form;
  // saving then repairs the event's form
  const storedFields = parseStoredFormSchemaOrLog(version);

  return {
    validImageTypes: VALID_IMAGE_TYPES,
    addresses,
    formHasSubmissions,
    signupForm: storedFields
      ? descriptorsToBuilderRows(storedFields)
      : defaultBuilderRows(),
    dinner: {
      ...event,
      date: toDisplayEventDate(event.date),
    },
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const schema = EventSchema.partial({ cover: true });
  const user = context.get(userContext);

  const { dinnerId } = params;

  return withParsedImageForm(request, {
    fieldName: "cover",
    schema,
    async onSuccess({ value, formData }) {
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
      } = value;

      const menuDescriptionUpdateValue = nullableStringUpdateValue({
        formData,
        fieldName: "menuDescription",
      });
      const donationDescriptionUpdateValue = nullableStringUpdateValue({
        formData,
        fieldName: "donationDescription",
      });

      // event data, the swapped cover image, and the authored form persist in
      // one transaction (updateEvent creates the new image, repoints the event
      // and deletes the old image atomically); the form follows the §9
      // versioning policy (deep-equal skip / in-place while unsubmitted / new
      // version), validated by SignupFormSchema inside EventSchema's signupForm
      // field
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
          date: toUtcEventDate(date),
          slots,
          price,
          discounts,
          addressId,
          ...(cover && { image: await fileToImageData(cover) }),
          createdById: user.id,
        },
        builderRowsToDescriptors(signupForm),
      );

      return redirect(`/admin/dinners/${event.id}`);
    },
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Dinner - ${loaderData.dinner.title} - Edit`
        : "Admin - Dinner - Edit",
    },
  ];
};

export default function AdminDinnerEditPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const schema = EventSchema.partial({ cover: true });
  const { addresses, validImageTypes, dinner, signupForm, formHasSubmissions } =
    loaderData;
  const addressOptions = toAddressOptions(addresses);

  const [form, fields] = useForm({
    lastResult: actionData,
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
        <AdminEventForm
          fields={fields}
          addressOptions={addressOptions}
          validImageTypes={validImageTypes}
          submitText="Save dinner"
          pageTitle="Edit dinner"
          cancelHref={`/admin/dinners/${dinner.id}`}
          lockFieldKeys={formHasSubmissions}
        />
      </Form>
    </FormProvider>
  );
}
