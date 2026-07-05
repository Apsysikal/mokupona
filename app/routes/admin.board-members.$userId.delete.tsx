import { redirect } from "react-router";

import type { Route } from "./+types/admin.board-members.$userId.delete";

import { deleteBoardMember } from "~/models/board-member.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader() {
  return redirect("/admin/board-members");
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { userId } = params;

  await deleteBoardMember(userId);
  return redirect("/admin/board-members");
}
