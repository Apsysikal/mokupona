import type { Route } from "./+types/admin.dinners.$dinnerId.[signups.csv]";

import { requireUserWithRole } from "~/features/auth/guards.server";
import {
  getAttendeeRosterForEvent,
  type Attendee,
  type RosterColumn,
} from "~/features/signup-form/read.server";
import { contentDispositionAttachment } from "~/lib/content-disposition.server";
import { buildCSVObject } from "~/lib/csv-builder.server";
import { getEventById } from "~/models/event.server";

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

  // the helper emits an ASCII-safe filename= fallback plus an RFC 5987
  // filename*, so umlauts in the title survive into the saved file's name
  const filename = `${event.title.split(" ").join("-")}-signups.csv`;

  return new Response(data.data, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": `${data.size}`,
      "Content-Disposition": contentDispositionAttachment(filename),
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
