import { redirect } from "react-router";

import type { Route } from "./+types/admin.locations.$locationId.delete";

import { requireUserWithRole } from "~/features/auth/guards.server";
import { deleteAddress } from "~/models/address.server";

export async function loader() {
  return redirect("/admin/locations");
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;

  await deleteAddress(locationId);
  return redirect("/admin/locations");
}
