import { parseWithZod } from "@conform-to/zod/v4";
import { redirect } from "react-router";

import type { Route } from "./+types/admin.locations.new";

import { AdminLocationRouteForm } from "~/components/admin-location-route-form";
import { createAddress } from "~/models/address.server";
import { AddressSchema, toAddressData } from "~/utils/address-validation";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: AddressSchema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  await createAddress(toAddressData(submission.value));

  return redirect("/admin/locations");
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Location" }];
};

export default function AdminLocationNewPage({
  actionData,
}: Route.ComponentProps) {
  return (
    <AdminLocationRouteForm
      lastResult={actionData}
      submitText="Create location"
      pageTitle="New location"
    />
  );
}
