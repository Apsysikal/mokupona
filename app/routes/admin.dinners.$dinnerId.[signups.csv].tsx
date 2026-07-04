import type { Route } from "./+types/admin.dinners.$dinnerId.[signups.csv]";

import {
  getAttendeeRosterForEvent,
  type Attendee,
  type RosterColumn,
} from "~/features/signup-form/read.server";
import { buildCSVObject } from "~/lib/csv-builder.server";
import { getEventById } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;

  // one line per attendee; columns are the field-name union across all
  // versions with submissions (plus legacy defaults), headers from the
  // latest labels — design §8
  const [event, { attendees, columns }] = await Promise.all([
    getEventById(dinnerId),
    getAttendeeRosterForEvent(dinnerId),
  ]);

  if (!event) throw new Response("Not found", { status: 404 });

  const data = buildCSVObject(
    columns.map((column) => column.label),
    attendees.map((attendee) => toCsvRow(attendee, columns)),
  );

  // quotes or non-Latin-1 characters in the title would make the header
  // invalid (or injectable), so the filename keeps a safe alphabet only
  const filename = `${event.title.replace(/[^\w.-]+/g, "-")}-signups.csv`;

  return new Response(data.data, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": `${data.size}`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=0, immutable",
    },
  });
}

function toCsvRow(attendee: Attendee, columns: RosterColumn[]) {
  return columns.map((column) => formatAnswer(attendee.answers[column.name]));
}

function formatAnswer(value: string | boolean | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}
