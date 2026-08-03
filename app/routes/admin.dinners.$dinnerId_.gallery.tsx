import { NavLink, Outlet } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.gallery";

import { AdminPageHeader } from "~/components/admin-ui";
import { RouteErrorContent } from "~/components/route-error-content";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { getEventById } from "~/models/event.server";
import { requireFound } from "~/shared/http.server";

const FOUNDATION_TABS = [
  { to: "tagged", label: "Tagged images" },
  { to: "join", label: "Join table" },
  { to: "album", label: "Albums" },
] as const;

export async function loader({ params }: Route.LoaderArgs) {
  const event = requireFound(await getEventById(params.dinnerId));

  return { dinner: { id: event.id, title: event.title } };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `Admin - Gallery - ${loaderData.dinner.title}`
      : "Admin - Gallery",
  },
];

export default function AdminDinnerGalleryLayout({
  loaderData,
}: Route.ComponentProps) {
  const { dinner } = loaderData;

  return (
    <div className="animate-page-in flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={dinner.title}
        title="Gallery"
        subtitle="Three ways of linking images to a dinner, side by side. Each tab writes to its own tables — images added under one are invisible to the others."
        actions={
          <Button variant="outline" asChild>
            <NavLink to={`/admin/dinners/${dinner.id}`}>Back to dinner</NavLink>
          </Button>
        }
      />

      <nav
        aria-label="Gallery data models"
        className="flex gap-5 overflow-x-auto border-b whitespace-nowrap md:gap-7"
      >
        {FOUNDATION_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            prefetch="intent"
            className={({ isActive }) =>
              cn(
                "-mb-px inline-flex items-center border-b-2 py-3 text-sm font-semibold transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-foreground/65 hover:text-foreground border-transparent",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
