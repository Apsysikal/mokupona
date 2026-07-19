import { redirect } from "react-router";

import type { Route } from "./+types/admin.users.$userId.delete";

import { deleteNonAdminUserById } from "~/models/user.server";

export async function loader() {
  return redirect("/admin/users");
}

export async function action({ params }: Route.ActionArgs) {
  const { userId } = params;

  await deleteNonAdminUserById(userId);
  return redirect("/admin/users");
}
