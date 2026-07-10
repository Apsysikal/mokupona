import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId.delete";

import { requireUserWithRole } from "~/features/auth/guards.server";
import { deleteEvent } from "~/models/event.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;

  await deleteEvent(dinnerId);
  return redirect("/admin/dinners");
}
