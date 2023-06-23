import type { GetEntryResponseBody } from "types/strapi";

export type EventResponse = {
  name: string;
  email: string;
  restriction_vegetarian: boolean;
  restriction_vegan: boolean;
  restriction_nuts: boolean;
  restriction_dairy: boolean;
  restriction_alcohol: boolean;
  restriction_other: null | string;
  comment: null | string;
  termsOfService: boolean;
  confirm_token: null | string;
  state: "waiting" | "invite_sent" | "invite_confirmed" | "invite_cancelled";
  invite_date: string | null;
  signup_date: string;
  event?: string;
};

const apiUrl = process.env.STRAPI_API_URL;
const apiHeaders = {
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function createEventResponse(data: EventResponse) {
  const url = `${apiUrl}/api/event-responses`;
  const response = await fetch(`${url}`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      data: {
        ...data,
      },
    }),
  });
  if (!response.ok) throw new Error("Failed to create event response");
}

export async function getEventResponseById(id: string) {
  const url = `${apiUrl}/api/event-responses/${id}`;
  const response = await fetch(url, {
    headers: apiHeaders,
  });

  if (!response.ok) throw new Error(`Failed to fetch event-response ${id}`);

  const body = (await response.json()) as GetEntryResponseBody<EventResponse>;
  return body.data;
}

export async function updateEventResponse(
  id: string,
  data: Partial<EventResponse>
) {
  const url = `${apiUrl}/api/event-responses/${id}`;
  const response = await fetch(`${url}`, {
    method: "PUT",
    headers: apiHeaders,
    body: JSON.stringify({
      data: {
        ...data,
      },
    }),
  });
  if (!response.ok) throw new Error("Failed to update event response");
}
