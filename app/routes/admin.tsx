import { Outlet } from "react-router";

import type { Route } from "./+types/admin";

import { AdminTabs } from "~/components/admin-tabs";
import { countAddresses } from "~/models/address.server";
import { countBoardMembers } from "~/models/board-member.server";
import { countEvents } from "~/models/event.server";
import { countUsers } from "~/models/user.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const isAdmin = user.role.name === "admin";

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
      <main className="mx-auto w-full max-w-[1160px] grow px-4.5 pt-5.5 pb-4 md:px-10 md:pt-9.5">
        <Outlet />
      </main>
    </>
  );
}
