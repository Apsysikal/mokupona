import { describe, expect, it } from "vitest";

import { toEventCardModel, toEventDetailModel } from "./view-models";

const event = {
  id: "event-id",
  title: "Summer Dinner",
  description: "Dinner description",
  menuDescription: "Seasonal menu",
  donationDescription: "Pay what you can",
  date: new Date("2026-07-12T17:30:00.000Z"),
  slots: 12,
  price: 30,
  discounts: "Student discount",
  imageId: "image-id",
  addressId: "address-id",
  createdById: "user-id",
  formId: "form-id",
  address: {
    id: "address-id",
    streetName: "Example Street",
    houseNumber: "4",
    zip: "8003",
    city: "Zürich",
  },
};

describe("event view-model mapping", () => {
  it("shares summary fields while preserving each view's address casing", () => {
    const card = toEventCardModel(event);
    const detail = toEventDetailModel(event);

    expect(card).toEqual({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      imageId: event.imageId,
      price: event.price,
      slots: event.slots,
      addressLine: "8003 zürich",
    });
    expect(detail).toMatchObject({
      ...card,
      addressLine: "8003 Zürich",
      menuDescription: event.menuDescription,
      donationDescription: event.donationDescription,
      discounts: event.discounts,
    });
  });
});
