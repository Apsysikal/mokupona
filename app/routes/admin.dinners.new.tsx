import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.new";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventRouteForm } from "~/features/events/components/admin-event-route-form";
import { EventSchema } from "~/features/events/event-schema";
import { toUtcEventDate } from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import { storeImage } from "~/features/images/image-storage.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
} from "~/features/signup-form/builder";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";

export async function loader() {
  const addresses = await getAddresses();

  return { addresses };
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
          // the provider stores the bytes first; the row created inside
          // createEvent's transaction persists only the returned scalars (a
          // failed write leaks at most a provider asset, never a row)
          image: {
            contentType: cover.type,
            ...(await storeImage(cover, "dinners")),
          },
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
  const { addresses } = loaderData;
  const addressOptions = toAddressOptions(addresses);

  return (
    <AdminEventRouteForm
      schema={EventSchema}
      lastResult={actionData}
      defaultValue={{ signupForm: defaultBuilderRows() }}
      addressOptions={addressOptions}
      submitText="Save dinner"
      pageTitle="New dinner"
      cancelHref="/admin/dinners"
    />
  );
}
