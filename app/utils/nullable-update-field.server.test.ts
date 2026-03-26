import { describe, expect, it } from "vitest";

import { nullableStringUpdateValue } from "./nullable-update-field.server";

describe("nullableStringUpdateValue", () => {
  it("keeps existing menu value if unchanged (field not provided)", () => {
    const formData = new FormData();
    const updateValue = nullableStringUpdateValue({
      formData,
      fieldName: "menuDescription",
      parsedValue: undefined,
    });

    expect(updateValue).toBeUndefined();
  });

  it("updates existing menu value if changed", () => {
    const formData = new FormData();
    formData.set("menuDescription", "new menu");

    const updateValue = nullableStringUpdateValue({
      formData,
      fieldName: "menuDescription",
      parsedValue: "new menu",
    });

    expect(updateValue).toBe("new menu");
  });

  it("removes existing menu value if cleared", () => {
    const formData = new FormData();
    formData.set("menuDescription", "");

    const updateValue = nullableStringUpdateValue({
      formData,
      fieldName: "menuDescription",
      parsedValue: "",
    });

    expect(updateValue).toBeNull();
  });

  it("removes existing donation value if cleared", () => {
    const formData = new FormData();
    formData.set("donationDescription", "");

    const updateValue = nullableStringUpdateValue({
      formData,
      fieldName: "donationDescription",
      parsedValue: "",
    });

    expect(updateValue).toBeNull();
  });
});
