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
import { getAttendeesForEvent } from "~/features/signup-form/read.server";
import { getEventById } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;

  const [event, attendees] = await Promise.all([
    getEventById(dinnerId),
    getAttendeesForEvent(dinnerId),
  ]);

  if (!event) throw new Response("Not found", { status: 404 });

  return {
    event,
    attendees,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { event } = loaderData;

  return [{ title: `Admin - Dinner - ${event.title} - Signups` }];
};

export default function DinnerSignupsPage({
  loaderData,
}: Route.ComponentProps) {
  const { event, attendees } = loaderData;

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
            <TableHead className="w-25">Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendees.map((attendee, index) => {
            return (
              // a party shares its submissionId, so the key needs the index
              <TableRow key={`${attendee.submissionId}-${index}`}>
                <TableCell className="font-medium">{attendee.email}</TableCell>
                <TableCell>{attendee.name}</TableCell>
                <TableCell>
                  {new Date(attendee.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
