import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  return json({ users });
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Users" }];
};

export default function DinnersPage() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-2">
      {users.length > 0 ? (
        <div className="flex flex-col gap-4">
          {users.map(({ id, email, role }) => {
            const isAdmin = role.name === "admin";

            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium leading-none">
                  {email}
                </span>

                <span className="flex gap-2">
                  <Button variant="secondary" asChild>
                    <Link to={`${id}/edit`}>Edit</Link>
                  </Button>

                  <Form method="POST" action={`${id}/delete`}>
                    <Button
                      type="submit"
                      disabled={isAdmin}
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </Form>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p>There are currently no users</p>
      )}
    </div>
  );
}
