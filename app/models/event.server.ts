import type {
  StrapiComponentAddressField,
  StrapiMediaField,
} from "types/strapi";
import type {
  GetEntriesResponseBody,
  GetEntryResponseBody,
  Parameters,
} from "types/strapi.new";
import { stringify } from "qs";
import type { EventResponse } from "./event-response.server";

export type Event = {
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  tags?: string;
  date: string;
  signupDate: string;
  slots: number;
  price: number;
  cover?: { data: StrapiMediaField };
  address?: StrapiComponentAddressField;
  event_responses?: { data: EventResponse[] };
};

const apiUrl = process.env.STRAPI_API_URL;
const apiHeaders = {
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function getEvents() {
  const url = `${apiUrl}/api/events`;
  const query: Parameters<Event> = {
    populate: ["cover", "address"],
    sort: "date",
    publicationState: "live",
    filters: {
      date: {
        $gt: new Date().toISOString(),
      },
    },
  };

  const response = await fetch(`${url}?${stringify(query)}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error("Failed to fetch events");

  const body = (await response.json()) as GetEntriesResponseBody<Event>;
  return body.data;
}

export async function getEventById(id: string) {
  const url = `${apiUrl}/api/events/${id}`;
  const query: Parameters<Event> = {
    populate: ["cover", "address", "event_responses"],
  };

  const response = await fetch(`${url}?${stringify(query)}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error(`Failed to fetch event ${id}`);

  const body = (await response.json()) as GetEntryResponseBody<Event>;
  return body.data;
}
