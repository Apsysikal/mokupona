import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { getEvents } from "~/models/event.server";
import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const events = await getEvents();

  return json({ events });
}

export default function DinnersPage() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-2">
      {events.length > 0 ? (
        <div className="flex flex-col gap-4">
          {events.map(({ id, title }) => {
            return (
              <div key={id} className="flex justify-between gap-2">
                <Button variant="link" asChild>
                  <Link to={id}>{title}</Link>
                </Button>

                <span className="flex gap-2">
                  <Button variant="ghost" asChild>
                    <Link to={`${id}/signups`}>View Signups</Link>
                  </Button>

                  <Button variant="secondary" asChild>
                    <Link to={`${id}/edit`}>Edit</Link>
                  </Button>

                  <Form method="POST" action={`${id}/delete`}>
                    <Button type="submit" variant="destructive">
                      Delete
                    </Button>
                  </Form>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p>There are currently no dinners available</p>
      )}

      <Button asChild>
        <Link to="new">Create new dinner</Link>
      </Button>
    </div>
  );
}
