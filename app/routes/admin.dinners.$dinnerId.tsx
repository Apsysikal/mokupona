import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import invariant from "tiny-invariant";

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
    <>
      <div className="flex flex-col gap-4">
        <img src={event.cover} alt="" width={640} height={480} />
        <span>{event.title}</span>
        <p className="whitespace-pre-line">{event.description}</p>
        <Suspense
          fallback={<span>{new Date(event.date).toLocaleString("de-CH")}</span>}
        >
          <ClientOnly>
            <span>{new Date(event.date).toLocaleString()}</span>
          </ClientOnly>
        </Suspense>
        <span>{event.slots}</span>
        <span>{`${event.price} CHF`}</span>
      </div>
    </>
  );
}

function ClientOnly({ children }: { children: React.ReactNode }) {
  if (typeof window === "undefined") {
    throw Error("Should only be client side rendered");
  }

  return children;
}
