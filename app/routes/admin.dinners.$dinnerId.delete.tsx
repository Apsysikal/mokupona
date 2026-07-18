import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId.delete";

import { deleteEvent } from "~/models/event.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ params }: Route.ActionArgs) {
  const { dinnerId } = params;

  await deleteEvent(dinnerId);
  return redirect("/admin/dinners");
}
