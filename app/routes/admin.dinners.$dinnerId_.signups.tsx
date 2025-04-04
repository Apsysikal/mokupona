import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.dinners.$dinnerId_.signups";

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
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);
  const responses = await getEventResponsesForEvent(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return {
    event,
    responses,
  };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { event } = data;
  if (!event) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${event.title} - Signups` }];
};

export default function DinnerSignupsPage() {
  const { event, responses } = useLoaderData<typeof loader>();

  return (
    <main className="flex grow flex-col gap-5">
      <div className="bg-secondary text-secondary-foreground flex items-center justify-between gap-2 rounded-md p-4">
        <p className="text-sm leading-none font-medium">
          You are viewing the submissons for the {`${event.title}`} dinner.
        </p>

        <span className="flex gap-2">
          <Button variant="ghost" asChild>
            <a href="signups.csv">Export Responses</a>
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
