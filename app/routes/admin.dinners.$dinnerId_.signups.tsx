import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getEventResponsesForEvent } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { requireUserId } from "~/session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);
  const responses = await getEventResponsesForEvent(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({
    event,
    responses,
  });
}

export default function DinnerSignupsPage() {
  const { event, responses } = useLoaderData<typeof loader>();

  const responsesForInvite = responses.slice(0, event.slots);
  const mailToString = responsesForInvite
    .map((response) => response.email)
    .join(",");

  return (
    <main className="flex grow flex-col gap-5">
      <div className="flex items-center justify-between gap-2 rounded-md bg-secondary p-4 text-secondary-foreground">
        <p className="text-sm font-medium leading-none">
          You are viewing the submissons for the {`${event.title}`} dinner.
        </p>

        <span className="flex gap-2">
          <Button variant="ghost" asChild>
            <a href={`mailto:?bcc=${mailToString}`}>Create inivations</a>
          </Button>
        </span>
      </div>
      <Table>
        <TableCaption>Signups for {event.title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((response) => {
            return (
              <TableRow key={response.id}>
                <TableCell className="font-medium">{response.email}</TableCell>
                <TableCell>{response.name}</TableCell>
                <TableCell>
                  {new Date(response.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
