import { redirect } from "react-router";

import type { Route } from "./+types/admin.users.$userId.delete";

import { getRoleNameForUser } from "~/models/role.server";
import { deleteUserById } from "~/models/user.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader() {
  return redirect("/admin/users");
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["admin"]);

  const { userId } = params;

  const roleName = await getRoleNameForUser(userId);

  if (!roleName) return redirect("/admin/users");
  // Admins can't be deleted from the admin ui
  if (roleName === "admin") return redirect("/admin/users");

  await deleteUserById(userId);
  return redirect("/admin/users");
}
