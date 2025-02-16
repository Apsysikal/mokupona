import type { ActionFunctionArgs} from "react-router";
import { redirect } from "react-router";
import invariant from "tiny-invariant";

import { deleteEvent } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  await deleteEvent(dinnerId);
  return redirect("/admin/dinners");
}
