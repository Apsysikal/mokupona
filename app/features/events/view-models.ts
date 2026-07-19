// Client-safe: routes and components map entities into these render-ready
// shapes. The models describe exactly what the event UI consumes, so the
// components no longer depend on Prisma entities or another route's loader.

import type { Address } from "~/models/address.server";
import type { Event } from "~/models/event.server";

/**
 * Dates cross the loader boundary, so a model mapped server-side may reach
 * the client serialized. Components always wrap in `new Date(...)` before
 * formatting.
 */
export type SerializableDate = Date | string;

/** Fields shared by event cards and the full detail view. */
export interface EventSummaryModel {
  id: string;
  title: string;
  description: string;
  date: SerializableDate;
  imageId: string;
  price: number;
  slots: number;
}

/** What FeaturedEventCard / PastEventCard render. */
export interface EventCardModel extends EventSummaryModel {
  /** "8003 zürich" — lowercase `zip city`, the card's deliberate format */
  addressLine: string;
}

type EventWithAddress = Event & { address: Address };

function toEventSummaryModel(event: Event): EventSummaryModel {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    imageId: event.imageId,
    price: event.price,
    slots: event.slots,
  };
}

export function toEventCardModel(event: EventWithAddress): EventCardModel {
  return {
    ...toEventSummaryModel(event),
    addressLine: `${event.address.zip} ${event.address.city}`.toLowerCase(),
  };
}

/** What EventStory / EventFactList / EventView render. */
export interface EventDetailModel extends EventSummaryModel {
  menuDescription: string | null;
  donationDescription: string | null;
  discounts: string | null;
  /** "8003 Zürich" — stored casing for the detail page */
  addressLine: string;
}

export function toEventDetailModel(event: EventWithAddress): EventDetailModel {
  return {
    ...toEventSummaryModel(event),
    menuDescription: event.menuDescription,
    donationDescription: event.donationDescription,
    discounts: event.discounts,
    addressLine: `${event.address.zip} ${event.address.city}`,
  };
}

/** One entry of the admin form's address select. */
export interface AddressOptionModel {
  label: string;
  value: string;
}

/**
 * Shared by the dinner create and edit routes so the address label format
 * ("Streetname 1 - 8003 Zürich") can't drift between the two pages.
 */
export function toAddressOptions(
  addresses: Array<
    Pick<Address, "id" | "streetName" | "houseNumber" | "zip" | "city">
  >,
): AddressOptionModel[] {
  return addresses.map((address) => ({
    label: `${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`,
    value: address.id,
  }));
}
