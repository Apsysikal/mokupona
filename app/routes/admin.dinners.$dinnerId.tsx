import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { DinnerView } from "~/components/dinner-view";
import { Button } from "~/components/ui/button";
import { getEventById } from "~/models/event.server";
import { requireUserId } from "~/session.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireUserId(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({ event });
}

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex max-w-3xl grow flex-col gap-5">
      <div className="flex items-center justify-between gap-2 rounded-md bg-secondary p-4 text-secondary-foreground">
        <p className="text-sm font-medium leading-none">
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
