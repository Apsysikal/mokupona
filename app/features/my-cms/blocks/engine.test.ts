import { describe, expect, it } from "vitest";

import { readBlock } from "./engine";

describe("readBlock", () => {
  it("resolves a valid block (happy path — regression for empty migration chains)", () => {
    const raw = { headline: "Hi", body: "Body text", variant: "plain" };

    const result = readBlock("id-1", "text-section", 1, raw);

    expect(result.status).toBe("success");
    if (result.status === "success" && result.kind === "text-section") {
      expect(result.data).toEqual(raw);
    }
  });

  it("errors on an unknown block kind", () => {
    expect(readBlock("id-2", "nope", 1, {}).status).toBe("error");
  });

  it("errors on an out-of-range stored version", () => {
    const raw = { headline: "Hi", body: "Body text", variant: "plain" };
    expect(readBlock("id-3", "text-section", 99, raw).status).toBe("error");
  });

  it("errors on an invalid payload", () => {
    expect(readBlock("id-4", "text-section", 1, { headline: 123 }).status).toBe(
      "error",
    );
  });
});
