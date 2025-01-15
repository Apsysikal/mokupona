import { ActionFunctionArgs, redirect } from "react-router";
import invariant from "tiny-invariant";

import { prisma } from "~/db.server";
import { deleteUserById } from "~/models/user.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader() {
  return redirect("/admin/users");
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);

  const { userId } = params;
  invariant(typeof userId === "string", "Parameter userId is missing");

  const userRole = await prisma.role.findFirst({
    where: { users: { some: { id: userId } } },
  });

  if (!userRole) return redirect("/admin/users");
  // Admins can't be deleted from the admin ui
  if (userRole.name === "admin") return redirect("/admin/users");

  await deleteUserById(userId);
  return redirect("/admin/users");
}
