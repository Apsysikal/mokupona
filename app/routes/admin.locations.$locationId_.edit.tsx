import { parseWithZod } from "@conform-to/zod/v4";
import { redirect } from "react-router";

import type { Route } from "./+types/admin.locations.$locationId_.edit";

import { AdminLocationRouteForm } from "~/components/admin-location-route-form";
import { getAddressById, updateAddress } from "~/models/address.server";
import { requireFound } from "~/shared/http.server";
import { AddressSchema, toAddressData } from "~/utils/address-validation";

export async function loader({ params }: Route.LoaderArgs) {
  const { locationId } = params;

  const address = requireFound(await getAddressById(locationId));

  return {
    location: address,
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Edit Location" }];
};

export async function action({ request, params }: Route.ActionArgs) {
  const { locationId } = params;

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: AddressSchema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  await updateAddress(locationId, toAddressData(submission.value));

  return redirect(`/admin/locations`);
}

export default function AdminLocationEditPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { location } = loaderData;
  return (
    <AdminLocationRouteForm
      lastResult={actionData}
      defaultValue={{
        streetName: location.streetName,
        houseNumber: location.houseNumber,
        zipCode: location.zip,
        city: location.city,
      }}
      submitText="Save location"
      pageTitle="Edit location"
    />
  );
}
