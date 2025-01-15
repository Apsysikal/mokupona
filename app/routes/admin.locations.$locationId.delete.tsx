import { ActionFunctionArgs, redirect } from "react-router";
import invariant from "tiny-invariant";

import { deleteAddress } from "~/models/address.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader() {
  return redirect("/admin/locations");
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;
  invariant(typeof locationId === "string", "Parameter locationId is missing");

  await deleteAddress(locationId);
  return redirect("/admin/locations");
}
