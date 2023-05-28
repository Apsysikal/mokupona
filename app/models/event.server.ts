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
  locationStreet: string;
  locationCity: string;
};

export type EventPopulatedCoverField = {
  data: {
    id: number;
    attributes: {
      alternativeText: string;
      url: string;
      formats: {
        large: {
          url: string;
        };
        small: {
          url: string;
        };
        medium: {
          url: string;
        };
        thumbnail: {
          url: string;
        };
      };
    };
  };
};

export type EventPopulatedResponsesField = {
  data: [EventResponse];
};

type AllEventsResponse = {
  data: [
    {
      id: number;
      attributes: Event & {
        cover: EventPopulatedCoverField;
      };
    }
  ];
};

type SingleEventResponse = {
  data: {
    id: number;
    attributes: Event & {
      cover: EventPopulatedCoverField;
      event_responses: EventPopulatedResponsesField;
    };
  };
};

const apiUrl = process.env.STRAPI_API_URL;
const apiHeaders = {
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function getEvents() {
  const url = `${apiUrl}/api/events`;
  const query = new URLSearchParams({
    populate: "cover",
    sort: "date",
    publicationDate: "live",
    "filters[date][$gt]": `${new Date().toISOString()}`, // Only events later than current time
  });
  const response = await fetch(`${url}?${query}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error("Failed to fetch events");

  const body = (await response.json()) as AllEventsResponse;
  return body.data;
}

export async function getEventById(id: string) {
  const url = `${apiUrl}/api/events/${id}`;
  const query = new URLSearchParams([
    ["populate", "cover"],
    ["populate", "event_responses"],
  ]);
  const response = await fetch(`${url}?${query}`, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error(`Failed to fetch event ${id}`);

  const body = (await response.json()) as SingleEventResponse;
  return body.data;
}
