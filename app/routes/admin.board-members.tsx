import { ChevronRightIcon, PersonIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useLoaderData } from "react-router";

import type { Route } from "./+types/admin.board-members";
import { OptimizedImage } from "./file.$fileId";

import { prisma } from "~/db.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const boardMembers = await prisma.boardMember.findMany({
    include: { image: { select: { id: true } } },
  });
  return { boardMembers };
}

export default function BoardMembersIndexRoute() {
  const { boardMembers } = useLoaderData<typeof loader>();

  return (
    <main>
      <h1 className="text-4xl">Manage board members</h1>
      <ul className="mt-8 divide-y">
        {boardMembers.map((boardMember) => {
          const { id, name, position, image } = boardMember;

          return (
            <li
              key={name}
              className="relative flex justify-between gap-x-6 py-5"
            >
              <div className="flex min-w-0 gap-x-4">
                {image?.id ? (
                  <OptimizedImage
                    imageId={image.id}
                    alt={`Portrait of ${name}`}
                    width={50}
                    height={50}
                    className="size-12 flex-none rounded-full bg-gray-50"
                  />
                ) : (
                  <div className="bg-primary flex size-12 shrink-0 items-center justify-center rounded-full">
                    <PersonIcon className="text-primary-foreground size-8" />
                  </div>
                )}
                <div className="min-w-0 flex-auto">
                  <p className="text-sm/6 font-semibold">
                    <Link to={`/admin/board-members/${id}/edit`}>
                      <span className="absolute inset-x-0 -top-px bottom-0" />
                      {name}
                    </Link>
                  </p>
                  <p className="mt-1 flex text-xs/5 text-gray-300">
                    {position}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-x-4">
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-5 flex-none"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-8" />
      <Outlet />
    </main>
  );
}
