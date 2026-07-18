import { redirect } from "react-router";

import type { Route } from "./+types/admin.board-members.$userId.delete";

import { deleteBoardMember } from "~/models/board-member.server";

export async function loader() {
  return redirect("/admin/board-members");
}

export async function action({ params }: Route.ActionArgs) {
  const { userId } = params;

  await deleteBoardMember(userId);
  return redirect("/admin/board-members");
}
