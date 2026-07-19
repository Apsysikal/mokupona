import { describe, expect, it } from "vitest";

import { AddressSchema, toAddressData } from "./address-validation";

describe("address form mapping", () => {
  it("maps the form zipCode field to the model zip field", () => {
    const value = AddressSchema.parse({
      streetName: " Example Street ",
      houseNumber: " 4 ",
      zipCode: " 8003 ",
      city: " Zürich ",
    });

    expect(toAddressData(value)).toEqual({
      streetName: "Example Street",
      houseNumber: "4",
      zip: "8003",
      city: "Zürich",
    });
  });
});
