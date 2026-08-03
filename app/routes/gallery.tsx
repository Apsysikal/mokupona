import { Outlet } from "react-router";

import type { Route } from "./+types/gallery";

import { RouteErrorContent } from "~/components/route-error-content";
import { PageContainer } from "~/components/section";

export const meta: Route.MetaFunction = () => [{ title: "Gallery" }];

export default function GalleryPage() {
  // the prototype pages own their own headers and switcher chrome
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-7 pb-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
