import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/admin.pages._index";

import { Button } from "~/components/ui/button";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return {
    pages: await siteCmsPageService.listEditablePages(),
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Pages" }];
};

export default function AdminPagesIndexRoute() {
  const { pages } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-4xl">Manage pages</h1>
      {pages.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pages.map((page) => (
            <div
              key={page.pageKey}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-1">
                <Link
                  to={page.pageKey}
                  className="text-sm leading-none font-medium underline"
                >
                  {page.pageKey}
                </Link>
                <p className="text-sm text-gray-300">{page.title}</p>
                <p className="text-sm">{formatPageStatus(page.status)}</p>
              </div>

              <Button variant="secondary" asChild>
                <Link to={page.pageKey}>Edit</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p>There are currently no editable pages</p>
      )}
    </main>
  );
}

function formatPageStatus(status: {
  kind: "default-backed" | "persisted";
  revision: number | null;
}) {
  if (status.kind === "default-backed") {
    return "Default-backed Page";
  }

  return `Persisted Page - Revision ${status.revision}`;
}
