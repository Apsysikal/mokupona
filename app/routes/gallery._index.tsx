import { redirect } from "react-router";

import { DEFAULT_GALLERY_FOUNDATION_ID } from "~/features/gallery/foundations/index.server";
import { DEFAULT_GALLERY_LAYOUT_ID } from "~/features/gallery/layouts";

// /gallery has no canonical shape yet — while the prototypes run, the bare
// path lands on the default pair and the switcher takes it from there.
export function loader() {
  return redirect(
    `/gallery/${DEFAULT_GALLERY_FOUNDATION_ID}/${DEFAULT_GALLERY_LAYOUT_ID}`,
  );
}
