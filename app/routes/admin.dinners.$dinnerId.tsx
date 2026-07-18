import { Form, Link } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId";

import { DinnerView } from "~/components/dinner-view";
import { Button } from "~/components/ui/button";
import { requireUserWithRole } from "~/features/auth/guards.server";
import { getEventById } from "~/models/event.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const event = await getEventById(params.dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return { event };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData ? `Dinner - ${loaderData.event.title}` : "Dinner",
    },
  ];
};

export default function DinnerPage({ loaderData }: Route.ComponentProps) {
  const { event } = loaderData;

  return (
    <main className="mx-auto flex max-w-4xl grow flex-col gap-5">
      <div className="bg-secondary text-secondary-foreground flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-none font-medium">
          You are viewing the admin view of this dinner.
        </p>

        <span className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="signups">View Signups</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="edit">Edit</Link>
          </Button>
          <Form method="POST" action="delete">
            <Button type="submit" variant="destructive" size="sm">
              Delete
            </Button>
          </Form>
        </span>
      </div>

      <DinnerView event={event} />
    </main>
  );
}
