import { redirect } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.gallery._index";

import { DEFAULT_GALLERY_FOUNDATION_ID } from "~/features/gallery/foundations/index.server";

export function loader({ params }: Route.LoaderArgs) {
  return redirect(
    `/admin/dinners/${params.dinnerId}/gallery/${DEFAULT_GALLERY_FOUNDATION_ID}`,
  );
}
