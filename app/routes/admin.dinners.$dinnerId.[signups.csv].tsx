import type { EventResponse } from "@prisma/client";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.dinners.$dinnerId.[signups.csv]";

import { buildCSVObject } from "~/lib/csv-builder.server";
import { getEventResponsesForEvent } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

const HEADER_ROW = [
  "Name",
  "Email",
  "Phone",
  "Vegetarian/Vegan",
  "Student",
  "Restrictions",
  "Comment",
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);
  const responses = await getEventResponsesForEvent(dinnerId);

  const data = buildCSVObject(HEADER_ROW, getCsvDataFromResponses(responses));

  if (!event) throw new Response("Not found", { status: 404 });

  return new Response(data.data, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": `${data.size}`,
      "Content-Disposition": `attachment; filename="${event.title.split(" ").join("-")}-signups.csv"`,
      "Cache-Control": "public, max-age=0, immutable",
    },
  });
}

function getCsvDataFromResponses(responses: EventResponse[]) {
  return [
    ...responses.map(
      ({ name, email, phone, vegetarian, student, restrictions, comment }) => {
        return [
          name,
          email,
          phone,
          vegetarian ? "true" : "false",
          student ? "true" : "false",
          restrictions || "",
          comment || "",
        ];
      },
    ),
  ];
}
