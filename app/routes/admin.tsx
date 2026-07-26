import { Outlet } from "react-router";

import type { Route } from "./+types/admin";

import { AdminTabs } from "~/components/admin-tabs";
import { RouteErrorContent } from "~/components/route-error-content";
import { PageContainer } from "~/components/section";
import {
  requireResolvedUserRoleMiddleware,
  userContext,
} from "~/features/auth/middleware.server";
import { ADMIN_ROLE_NAMES, isAdminRole } from "~/features/auth/roles";
import { countAddresses } from "~/models/address.server";
import { countBoardMembers } from "~/models/board-member.server";
import { countEvents } from "~/models/event.server";
import { countUsers } from "~/models/user.server";

// Authorizes the root-resolved user for the whole admin hierarchy and exposes
// the required userContext. Descendants inherit this middleware; only the
// admin-only users segment needs an additional narrowing check.
export const middleware: Route.MiddlewareFunction[] = [
  requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const isAdmin = isAdminRole(user.role.name);

  const [dinners, locations, board, users] = await Promise.all([
    countEvents(),
    countAddresses(),
    countBoardMembers(),
    // the users section (and its tab) is admin-only
    isAdmin ? countUsers() : Promise.resolve(null),
  ]);

  return { counts: { dinners, locations, board, users } };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <AdminTabs counts={loaderData.counts} />
      <PageContainer className="grow pt-5 pb-4 md:pt-9">
        <Outlet />
      </PageContainer>
    </>
  );
}

// The middleware's 403 (and child 404s) land here instead of the root
// boundary, so denied users see a styled page inside the site chrome.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-5 pb-4 md:pt-9">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
