import { redirect } from "react-router";

import type { Route } from "./+types/admin.users.$userId.delete";

import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { deleteNonAdminUserById } from "~/models/user.server";

export async function loader() {
  return redirect("/admin/users");
}

export async function action({ params, context }: Route.ActionArgs) {
  const { userId } = params;

  const deleted = await deleteNonAdminUserById(userId);

  const audit = {
    userId: context.get(userContext).id,
    targetUserId: userId,
  };
  const log = context.get(requestLoggerContext);
  if (deleted) {
    log.warn(audit, "Admin deleted a user account");
  } else {
    log.warn(audit, "Admin account deletion was refused");
  }

  return redirect("/admin/users");
}
