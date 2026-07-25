import { describe, expect, it } from "vitest";

import { EventEditSchema, EventSchema } from "./event-schema";

describe("event form schemas", () => {
  it("requires a cover on create and permits an omitted cover on edit", () => {
    expect(EventSchema.shape.cover.safeParse(undefined).success).toBe(false);
    expect(EventEditSchema.shape.cover.safeParse(undefined).success).toBe(true);
  });
});
