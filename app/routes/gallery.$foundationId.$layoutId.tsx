import type { Route } from "./+types/gallery.$foundationId.$layoutId";

import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
} from "~/components/section";
import { GalleryPrototypeSwitcher } from "~/features/gallery/components/prototype-switcher";
import {
  galleryFoundationOptions,
  getGalleryFoundation,
} from "~/features/gallery/foundations/index.server";
import {
  galleryLayoutOptions,
  getGalleryLayout,
} from "~/features/gallery/layouts";

export async function loader({ params }: Route.LoaderArgs) {
  const { foundationId, layoutId } = params;

  const foundation = getGalleryFoundation(foundationId);
  // the layout is resolved here too so an unknown one 404s server-side
  // instead of rendering an empty page
  if (!foundation || !getGalleryLayout(layoutId)) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    images: await foundation.listAll(),
    foundationId: foundation.id,
    layoutId,
    foundations: galleryFoundationOptions(),
    layouts: galleryLayoutOptions(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `Gallery - ${loaderData.foundationId} / ${loaderData.layoutId}`
      : "Gallery",
  },
];

export default function GalleryPrototypePage({
  loaderData,
}: Route.ComponentProps) {
  const { images, foundationId, layoutId, foundations, layouts } = loaderData;

  // the loader already rejected unknown ids, so this always resolves
  const layout = getGalleryLayout(layoutId);
  if (!layout) return null;

  const { Component } = layout;

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

      <GalleryPrototypeSwitcher
        foundations={foundations}
        layouts={layouts}
        currentFoundationId={foundationId}
        currentLayoutId={layoutId}
      />

      <Component images={images} variant="page" />
    </PageContainer>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
