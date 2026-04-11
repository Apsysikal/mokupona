import { describe, expect, test } from "vitest";

import { parseAutoLinks } from "./auto-link";

describe("parseAutoLinks", () => {
  describe("plain text without links", () => {
    test("returns text as-is when no URL present", () => {
      const result = parseAutoLinks("Hello, world!");
      expect(result).toEqual([{ type: "text", value: "Hello, world!" }]);
    });
  });

  describe("plain URLs (current behaviour)", () => {
    test("detects a bare https URL", () => {
      const result = parseAutoLinks("Visit https://example.com for more.");
      expect(result).toContainEqual({ type: "link", url: "https://example.com" });
    });

    test("detects a bare http URL", () => {
      const result = parseAutoLinks("Visit http://example.com for more.");
      expect(result).toContainEqual({ type: "link", url: "http://example.com" });
    });

    test("detects a URL without protocol", () => {
      const result = parseAutoLinks("Visit example.com for more.");
      expect(result).toContainEqual({ type: "link", url: "example.com" });
    });

    test("preserves surrounding text when URL is present", () => {
      const result = parseAutoLinks("before https://example.com after");
      expect(result[0]).toEqual({ type: "text", value: "before " });
      expect(result[1]).toEqual({ type: "link", url: "https://example.com" });
      expect(result[2]).toEqual({ type: "text", value: " after" });
    });

    test("preserves balanced parentheses in URLs (e.g. Wikipedia links)", () => {
      const result = parseAutoLinks(
        "See https://en.wikipedia.org/wiki/Tokyo_(Japan) for details.",
      );
      expect(result).toContainEqual({
        type: "link",
        url: "https://en.wikipedia.org/wiki/Tokyo_(Japan)",
      });
    });
  });

  describe("URLs wrapped in braces (desired behaviour)", () => {
    test("strips trailing ) when URL is wrapped in parentheses", () => {
      const result = parseAutoLinks("Check out (https://example.com) for more.");
      expect(result).toContainEqual({ type: "link", url: "https://example.com" });
    });

    test("surrounding text is preserved when URL is in parentheses", () => {
      const result = parseAutoLinks("Check out (https://example.com) for more.");
      const texts = result
        .filter((p) => p.type === "text")
        .map((p) => p.value);
      expect(texts.join("")).toBe("Check out () for more.");
    });

    test("strips multiple trailing ) when URL is followed by extra closing parens", () => {
      const result = parseAutoLinks("((https://example.com))");
      expect(result).toContainEqual({ type: "link", url: "https://example.com" });
    });
  });
});
