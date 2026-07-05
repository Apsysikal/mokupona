import { PersonIcon, PlusIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useFetcher, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members";
import { OptimizedImage } from "./file.$fileId";

import {
  AdminEmptyState,
  AdminPageHeader,
  InitialsAvatar,
} from "~/components/admin-ui";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { listBoardMembers } from "~/models/board-member.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
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
    <div className="animate-in fade-in slide-in-from-bottom-1.5 duration-300">
      <AdminPageHeader
        eyebrow={`${boardMembers.length} members`}
        title="Board members"
        subtitle="These profiles appear publicly on the moku pona website."
        actions={
          <Button asChild>
            <Link to="new">
              <PlusIcon className="mr-2 size-[17px]" />
              Add member
            </Link>
          </Button>
        }
      />

      {boardMembers.length > 0 ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          {boardMembers.map((member, index) => (
            <BoardMemberCard key={member.id} member={member} seed={index} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<PersonIcon className="size-6.5" />}
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
        <div className="border-foreground/10 mt-8 border-t pt-8">
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
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";
  const { id, name, position, imageId } = member;

  return (
    <Card className="hover:border-primary/30 flex flex-wrap items-center gap-3.5 rounded-[14px] p-4.5 transition-colors">
      {imageId ? (
        <OptimizedImage
          imageId={imageId}
          alt={`Portrait of ${name}`}
          width={96}
          height={96}
          className="size-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <InitialsAvatar name={name} seed={seed} className="size-12 text-sm" />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold tracking-[-.01em]">
          {name}
        </h2>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">
          {position}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button
            type="submit"
            size="sm"
            variant="destructive-outline"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </div>
    </Card>
  );
}
