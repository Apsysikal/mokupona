import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { prisma } from "~/db.server";
import { logout, requireUserId } from "~/utils/session.server";

export const meta: MetaFunction = () => [{ title: "moku pona" }];

const ENABLED = false;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!ENABLED) return redirect("/");

  const userId = await requireUserId(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
    },
  });

  if (!user) throw await logout(request);

  return { user };
};

export default function MeRoute() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <main className="relative mx-auto flex max-w-4xl flex-col gap-2">
      <div className="px-2">
        <h1 className="text-2xl font-extrabold">Welcome to your profile.</h1>
      </div>

      <div className="flex flex-col gap-2 px-2">
        <p>Email: {user.email}</p>
        <p>
          Role: {user.role.name}
          {user.role.description ? `, ${user.role.description}` : null}
        </p>
      </div>
    </main>
  );
}
