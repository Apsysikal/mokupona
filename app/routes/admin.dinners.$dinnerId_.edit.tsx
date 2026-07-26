import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.edit";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventRouteForm } from "~/features/events/components/admin-event-route-form";
import { EventEditSchema } from "~/features/events/event-schema";
import {
  toDisplayEventDate,
  toUtcEventDate,
} from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
} from "~/features/signup-form/builder";
import { getAddresses } from "~/models/address.server";
import {
  getEventWithCurrentFormVersion,
  updateEvent,
} from "~/models/event.server";
import { eventHasSignups } from "~/models/form-submission.server";
import { requireFound } from "~/shared/http.server";
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
  const user = context.get(userContext);

  const { dinnerId } = params;

  return withParsedImageForm(request, {
    fieldName: "cover",
    schema: EventEditSchema,
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

      const { event, replacedImageKey } = await updateEvent(
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
          ...(cover && {
            image: {
              contentType: cover.type,
              ...(await storeImage(cover, "dinners")),
            },
          }),
          createdById: user.id,
        },
        builderRowsToDescriptors(signupForm),
      );

      await destroyImages([replacedImageKey]);

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
  const { addresses, dinner, signupForm, formHasSubmissions } = loaderData;
  const addressOptions = toAddressOptions(addresses);

  return (
    <AdminEventRouteForm
      schema={EventEditSchema}
      lastResult={actionData}
      defaultValue={{ ...dinner, signupForm }}
      addressOptions={addressOptions}
      submitText="Save dinner"
      pageTitle="Edit dinner"
      cancelHref={`/admin/dinners/${dinner.id}`}
      lockFieldKeys={formHasSubmissions}
    />
  );
}
