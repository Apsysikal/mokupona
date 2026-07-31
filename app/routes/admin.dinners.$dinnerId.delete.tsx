import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId.delete";

import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { destroyImages } from "~/features/images/image-storage.server";
import { deleteEvent } from "~/models/event.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ params, context }: Route.ActionArgs) {
  const { dinnerId } = params;
  const { imageKey } = await deleteEvent(dinnerId);
  await destroyImages([imageKey]);

  context
    .get(requestLoggerContext)
    .warn(
      { userId: context.get(userContext).id, dinner: dinnerId },
      "Admin deleted a dinner and everything that cascades from it",
    );

  return redirect("/admin/dinners");
}
