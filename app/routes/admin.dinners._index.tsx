import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

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
    <>
      <Link to="new">Create new dinner</Link>
      {events.length > 0 ? (
        <div className="flex flex-col gap-4">
          {events.map(({ id, title }) => {
            return (
              <div key={id} className="flex gap-2">
                <Link to={id}>{title}</Link>
                <Link to={`${id}/edit`}>Edit</Link>
                <Form method="POST" action={`${id}/delete`}>
                  <button type="submit">Delete</button>
                </Form>
              </div>
            );
          })}
        </div>
      ) : (
        <p>There are currently no dinners available</p>
      )}
    </>
  );
}
