import type {
  StrapiApiResponse,
  StrapiApiResponseMultiple,
  StrapiApiUrlParameters,
  StrapiComponentAddressField,
  StrapiMediaField,
} from "types/strapi";
import type {
  GetEntriesResponseBody,
  GetEntryResponseBody,
} from "types/strapi.new";
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

export type GetEventResponse = StrapiApiResponse<Event>;

export type GetEventsResponse = StrapiApiResponseMultiple<Event>;

const apiUrl = process.env.STRAPI_API_URL;
const apiHeaders = {
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function getEvents() {
  const url = `${apiUrl}/api/events`;
  const query = new URLSearchParams([
    ["populate", "cover"],
    ["populate", "address"],
    ["sort", "date"],
    ["publicationDate", "live"],
    ["filters[date][$gt]", new Date().toISOString()],
  ]);
  const response = await fetch(`${url}?${query}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error("Failed to fetch events");

  const body = (await response.json()) as GetEntriesResponseBody<Event>;
  return body.data;
}

export async function getEventById(id: string) {
  const url = `${apiUrl}/api/events/${id}`;
  const query = new URLSearchParams([
    ["populate", "cover"],
    ["populate", "address"],
    ["populate", "event_responses"],
  ]);
  const response = await fetch(`${url}?${query}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error(`Failed to fetch event ${id}`);

  const body = (await response.json()) as GetEntryResponseBody<Event>;
  return body.data;
}
