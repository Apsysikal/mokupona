import { describe, expect, it } from "vitest";

import { buildCSVObject } from "./csv-builder.server";

describe("buildCSVObject", () => {
  it("escapes embedded double quotes per RFC 4180", () => {
    const { data } = buildCSVObject(
      ["Restrictions"],
      [['peanuts, "severe" allergy']],
    );

    expect(data).toBe('Restrictions,\n"peanuts, ""severe"" allergy",\n');
  });

  it("quotes values containing separators or line breaks", () => {
    const { data } = buildCSVObject(["A", "B"], [["one,two", "three\nfour"]]);

    expect(data).toBe('A,B,\n"one,two","three\nfour",\n');
  });

  it("reports size in UTF-8 bytes, not UTF-16 code units", () => {
    const { data, size } = buildCSVObject(["Name"], [["Jürgen"]]);

    expect(size).toBe(Buffer.byteLength(data, "utf8"));
    expect(size).toBeGreaterThan(data.length);
  });
});
