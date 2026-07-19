import { redirect } from "react-router";

import type { Route } from "./+types/admin.locations.$locationId.delete";

import { deleteAddress } from "~/models/address.server";

export async function loader() {
  return redirect("/admin/locations");
}

export async function action({ params }: Route.ActionArgs) {
  const { locationId } = params;

  await deleteAddress(locationId);
  return redirect("/admin/locations");
}
