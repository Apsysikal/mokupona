import { redirect } from "react-router";

import type { Route } from "./+types/admin.users.$userId.delete";

import { getRoleNameForUser } from "~/models/role.server";
import { deleteUserById } from "~/models/user.server";

export async function loader() {
  return redirect("/admin/users");
}

export async function action({ params }: Route.ActionArgs) {
  const { userId } = params;

  const roleName = await getRoleNameForUser(userId);

  if (!roleName) return redirect("/admin/users");
  // Admins can't be deleted from the admin ui
  if (roleName === "admin") return redirect("/admin/users");

  await deleteUserById(userId);
  return redirect("/admin/users");
}
