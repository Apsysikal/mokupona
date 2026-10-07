import { redirect } from "react-router";

import type { Route } from "./+types/admin.events.$eventId.delete";

import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { destroyImages } from "~/features/images/image-storage.server";
import { deleteEvent } from "~/models/event.server";

export async function loader() {
  return redirect("/admin/events");
}

export async function action({ params, context }: Route.ActionArgs) {
  const { eventId } = params;
  const { imageKeys } = await deleteEvent(eventId);
  await destroyImages(imageKeys);

  context
    .get(requestLoggerContext)
    .warn(
      { userId: context.get(userContext).id, event: eventId },
      "Admin deleted an event and everything that cascades from it",
    );

  return redirect("/admin/events");
}
