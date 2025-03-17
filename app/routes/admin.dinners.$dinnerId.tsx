import { Form, Link, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.dinners.$dinnerId";

import { DinnerView } from "~/components/dinner-view";
import { Button } from "~/components/ui/button";
import { getEventById } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return { event };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { event } = data;
  if (!event) return [{ title: "Admin - Dinner" }];

  return [{ title: `Dinner - ${event.title}` }];
};

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex max-w-4xl grow flex-col gap-5">
      <div className="bg-secondary text-secondary-foreground flex items-center justify-between gap-2 rounded-md p-4">
        <p className="text-sm leading-none font-medium">
          You are viewing the admin view of this dinner.
        </p>

        <span className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="signups">View Signups</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="edit">Edit</Link>
          </Button>
          <Form method="POST" action="delete">
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </Form>
        </span>
      </div>

      <DinnerView event={event} />
    </main>
  );
}
