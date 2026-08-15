import type { Route } from "./+types/gallery";

import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
} from "~/components/section";
import { listGalleryImages } from "~/features/gallery/gallery.server";
import { MosaicGallery } from "~/features/gallery/layouts/mosaic";

export async function loader() {
  return { images: await listGalleryImages() };
}

export const meta: Route.MetaFunction = () => [{ title: "Gallery" }];

export default function GalleryPage({ loaderData }: Route.ComponentProps) {
  const { images } = loaderData;

  return (
    <PageContainer className="grow pt-7 pb-20">
      <div className="mb-9 flex flex-col gap-3">
        <Eyebrow>from the table</Eyebrow>
        <h1 className={pageTitleClassName}>gallery</h1>
        <p className="text-foreground/80 max-w-2xl text-base font-light md:text-lg">
          plates, hands, half-finished glasses — everything we managed to
          photograph before it was eaten.
        </p>
      </div>

      <MosaicGallery images={images} variant="page" />
    </PageContainer>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-7 pb-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
