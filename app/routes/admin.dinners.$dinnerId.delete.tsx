import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId.delete";

import { destroyImages } from "~/features/images/image-storage.server";
import { deleteEvent } from "~/models/event.server";

export async function loader() {
  return redirect("/admin/dinners");
}

export async function action({ params }: Route.ActionArgs) {
  const { dinnerId } = params;

  // capture-and-destroy: the model returns the doomed cover's storageKey
  // from inside its transaction; the provider asset goes strictly after the
  // commit (design §3.4)
  const { imageKey } = await deleteEvent(dinnerId);
  await destroyImages([imageKey]);

  return redirect("/admin/dinners");
}
