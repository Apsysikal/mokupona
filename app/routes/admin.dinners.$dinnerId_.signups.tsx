import { ChevronLeftIcon, DownloadIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import type { Route } from "./+types/admin.dinners.$dinnerId_.signups";

import { AdminPageHeader, InitialsAvatar } from "~/components/admin-ui";
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
import {
  getAttendeesForEvent,
  type Attendee,
} from "~/features/signup-form/read.server";
import { getEventById } from "~/models/event.server";
import { formatAdminTimestamp } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

// The table reads one row per party: the signer fronts the row, friends only
// bump the party size. Legacy rows never share a submissionId, so each stays
// its own party of one.
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

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;

  const [event, attendees] = await Promise.all([
    getEventById(dinnerId),
    getAttendeesForEvent(dinnerId),
  ]);

  if (!event) throw new Response("Not found", { status: 404 });

  return {
    event: { title: event.title, slots: event.slots },
    seatsTaken: attendees.length,
    parties: toParties(attendees),
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { event } = loaderData;

  return [{ title: `Admin - Dinner - ${event.title} - Signups` }];
};

export default function DinnerSignupsPage({
  loaderData,
}: Route.ComponentProps) {
  const { event, seatsTaken, parties } = loaderData;

  return (
    <main className="animate-page-in">
      <Link
        to="/admin/dinners"
        prefetch="intent"
        className="text-foreground/50 hover:text-foreground mb-3 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ChevronLeftIcon className="size-4" />
        Dinners
      </Link>

      <AdminPageHeader
        eyebrow={`${parties.length} signups · ${seatsTaken} / ${event.slots} seats`}
        title={event.title}
        actions={
          <Button variant="outline" asChild>
            <a href="signups.csv">
              <DownloadIcon className="mr-2 size-4" />
              Export CSV
            </a>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-foreground/50 h-auto px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                Guest
              </TableHead>
              <TableHead className="text-foreground/50 h-auto px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                Email
              </TableHead>
              <TableHead className="text-foreground/50 h-auto px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                Party
              </TableHead>
              <TableHead className="text-foreground/50 h-auto px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                Signed up
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party, index) => (
              <TableRow
                key={`${party.email}-${index}`}
                className="hover:bg-foreground/5"
              >
                <TableCell className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar
                      name={party.name}
                      seed={index}
                      className="size-8 text-xs"
                    />
                    <span className="font-semibold">{party.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-4">
                  {party.email}
                </TableCell>
                <TableCell className="px-4 py-4 text-center">
                  {party.size}
                </TableCell>
                <TableCell className="px-4 py-4 text-right">
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
                  className="text-foreground/50 px-4 py-8 text-center text-sm"
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
