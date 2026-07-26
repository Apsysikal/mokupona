import { PersonIcon, PlusIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  InitialsAvatar,
} from "~/components/admin-ui";
import { OptimizedImage } from "~/components/optimized-image";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { listBoardMembers } from "~/models/board-member.server";

export async function loader() {
  const boardMembers = await listBoardMembers();
  return { boardMembers };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Board Members" }];
};

export default function AdminBoardMembersPage({
  loaderData,
}: Route.ComponentProps) {
  const { boardMembers } = loaderData;
  const location = useLocation();
  // the new/edit forms render below the list via the Outlet
  const formOpen = location.pathname !== "/admin/board-members";

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${boardMembers.length} members`}
        title="Board members"
        subtitle="These profiles appear publicly on the moku pona website."
        actions={
          <Button asChild>
            <Link to="new">
              <PlusIcon className="size-4" />
              Add member
            </Link>
          </Button>
        }
      />

      {boardMembers.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {boardMembers.map((member, index) => (
            <BoardMemberCard key={member.id} member={member} seed={index} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<PersonIcon className="size-6" />}
          title="No board members yet"
          description="Add the people behind moku pona — they show up on the public site."
          action={
            <Button asChild>
              <Link to="new">Add member</Link>
            </Button>
          }
        />
      )}

      {formOpen ? (
        <div className="mt-8 border-t pt-8">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

type BoardMember = Awaited<ReturnType<typeof loader>>["boardMembers"][number];

function BoardMemberCard({
  member,
  seed,
}: {
  member: BoardMember;
  seed: number;
}) {
  const { id, name, position, image } = member;

  return (
    <Card interactive className="flex flex-wrap items-center gap-3 p-4">
      {image ? (
        <OptimizedImage
          image={image}
          alt={`Portrait of ${name}`}
          width={96}
          height={96}
          className="size-12 shrink-0 rounded-full"
        />
      ) : (
        <InitialsAvatar name={name} seed={seed} className="size-12 text-sm" />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold">{name}</h2>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">
          {position}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <AdminDeleteButton action={`${id}/delete`} />
      </div>
    </Card>
  );
}
