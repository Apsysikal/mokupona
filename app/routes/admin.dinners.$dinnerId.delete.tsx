import { ActionFunctionArgs, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

import { deleteEvent } from "~/models/event.server";
import { requireUserId } from "~/session.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  await deleteEvent(dinnerId);
  return redirect("/admin/dinners");
}
