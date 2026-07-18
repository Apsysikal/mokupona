// Client-safe: routes and components map entities into these render-ready
// shapes. The models describe exactly what the event UI consumes, so the
// components no longer depend on Prisma entities or another route's loader.

import type { Address, Event } from "~/models/event.server";

/**
 * Dates cross the loader boundary, so a model mapped server-side may reach
 * the client serialized. Components always wrap in `new Date(...)` before
 * formatting.
 */
type SerializableDate = Date | string;

/** What FeaturedEventCard / PastEventCard render. */
export interface EventCardModel {
  id: string;
  title: string;
  description: string;
  date: SerializableDate;
  imageId: string;
  price: number;
  slots: number;
  /** "8003 zürich" — lowercase `zip city`, the card's deliberate format */
  addressLine: string;
}

export function toEventCardModel(
  event: Event & { address: Address },
): EventCardModel {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    imageId: event.imageId,
    price: event.price,
    slots: event.slots,
    addressLine: `${event.address.zip} ${event.address.city}`.toLowerCase(),
  };
}

/** What EventStory / EventFactList / EventView render. */
export interface EventDetailModel {
  id: string;
  title: string;
  description: string;
  menuDescription: string | null;
  donationDescription: string | null;
  date: SerializableDate;
  imageId: string;
  price: number;
  slots: number;
  discounts: string | null;
  /** "8003 Zürich" — `zip city` as stored, the detail page's format */
  addressLine: string;
}

export function toEventDetailModel(
  event: Event & { address: Address },
): EventDetailModel {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    menuDescription: event.menuDescription,
    donationDescription: event.donationDescription,
    date: event.date,
    imageId: event.imageId,
    price: event.price,
    slots: event.slots,
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
