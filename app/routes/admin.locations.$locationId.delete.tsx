import { ActionFunctionArgs, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

import { deleteAddress } from "~/models/address.server";
import { requireUserId } from "~/session.server";

export async function loader() {
  return redirect("/admin/locations");
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);

  const { locationId } = params;
  invariant(typeof locationId === "string", "Parameter locationId is missing");

  await deleteAddress(locationId);
  return redirect("/admin/locations");
}
