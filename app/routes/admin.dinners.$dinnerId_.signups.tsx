import { DownloadIcon } from "@radix-ui/react-icons";

import type { Route } from "./+types/admin.dinners.$dinnerId_.signups";

import { AdminPageHeader, InitialsAvatar } from "~/components/admin-ui";
import { BackLink } from "~/components/section";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatAdminTimestamp } from "~/features/events/date-format";
import {
  getAttendeesForEvent,
  type Attendee,
} from "~/features/signup-form/read.server";
import { getEventById } from "~/models/event.server";
import { requireFound } from "~/shared/http.server";

function toParties(attendees: Attendee[]) {
  const parties = new Map<
    string,
    { name: string; email: string; size: number; createdAt: Date }
  >();

  for (const attendee of attendees) {
    const existing = parties.get(attendee.submissionId);
    if (!existing) {
      parties.set(attendee.submissionId, {
        name: attendee.name,
        email: attendee.email,
        size: 1,
        createdAt: attendee.createdAt,
      });
    } else {
      existing.size += 1;
      if (attendee.isSigner) {
        existing.name = attendee.name;
        existing.email = attendee.email;
      }
    }
  }

  return [...parties.values()];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const [event, attendees] = await Promise.all([
    getEventById(dinnerId).then(requireFound),
    getAttendeesForEvent(dinnerId),
  ]);

  return {
    event: { title: event.title, slots: event.slots },
    seatsTaken: attendees.length,
    parties: toParties(attendees),
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Dinner - ${loaderData.event.title} - Signups`
        : "Admin - Dinner - Signups",
    },
  ];
};

export default function DinnerSignupsPage({
  loaderData,
}: Route.ComponentProps) {
  const { event, seatsTaken, parties } = loaderData;

  return (
    <main className="animate-page-in">
      <BackLink to="/admin/dinners" prefetch="intent">
        Dinners
      </BackLink>

      <AdminPageHeader
        eyebrow={`${parties.length} signups · ${seatsTaken} / ${event.slots} seats`}
        title={event.title}
        actions={
          <Button variant="outline" asChild>
            <a href="signups.csv">
              <DownloadIcon className="size-4" />
              Export CSV
            </a>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Guest</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Party</TableHead>
              <TableHead className="text-right">Signed up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party, index) => (
              <TableRow key={`${party.email}-${index}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar
                      name={party.name}
                      seed={index}
                      className="size-8 text-xs"
                    />
                    <span className="font-semibold">{party.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-foreground/65">
                  {party.email}
                </TableCell>
                <TableCell className="text-center">{party.size}</TableCell>
                <TableCell className="text-right">
                  <time
                    dateTime={new Date(party.createdAt).toISOString()}
                    suppressHydrationWarning
                    className="text-foreground/50 text-sm whitespace-nowrap"
                  >
                    {formatAdminTimestamp(new Date(party.createdAt))}
                  </time>
                </TableCell>
              </TableRow>
            ))}
            {parties.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="text-foreground/50 py-8 text-center text-sm"
                >
                  No signups yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
