import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { AutoLink, parseAutoLinks } from "./auto-link";

describe("parseAutoLinks", () => {
  describe("plain text without links", () => {
    test("returns text as-is when no URL present", () => {
      const result = parseAutoLinks("Hello, world!");
      expect(result).toEqual([{ type: "text", value: "Hello, world!" }]);
    });
  });

  describe("plain URLs", () => {
    test("detects a bare https URL", () => {
      const result = parseAutoLinks("Visit https://example.com for more.");
      expect(result).toContainEqual({
        type: "link",
        url: "https://example.com",
      });
    });

    test.each([",", ".", "!", "?", ";", ":", "?!", ".,"])(
      "keeps trailing punctuation outside links for plain URLs: %s",
      (punctuation) => {
        const result = parseAutoLinks(
          `Visit https://example.com${punctuation}`,
        );

        expect(result).toEqual([
          { type: "text", value: "Visit " },
          { type: "link", url: "https://example.com" },
          { type: "text", value: punctuation },
        ]);
      },
    );

    test("detects a bare http URL", () => {
      const result = parseAutoLinks("Visit http://example.com for more.");
      expect(result).toContainEqual({
        type: "link",
        url: "http://example.com",
      });
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

    test("supports query, hash, and trailing punctuation", () => {
      const result = parseAutoLinks(
        "Read https://example.com/path?q=value#section.",
      );

      expect(result).toEqual([
        { type: "text", value: "Read " },
        { type: "link", url: "https://example.com/path?q=value#section" },
        { type: "text", value: "." },
      ]);
    });

    test("supports custom ports and trailing punctuation", () => {
      const result = parseAutoLinks("Visit https://example.com:8080/path,");

      expect(result).toEqual([
        { type: "text", value: "Visit " },
        { type: "link", url: "https://example.com:8080/path" },
        { type: "text", value: "," },
      ]);
    });

    test("detects multiple URLs in one sentence", () => {
      const result = parseAutoLinks(
        "Check https://example.com, then https://example.org.",
      );

      expect(result).toEqual([
        { type: "text", value: "Check " },
        { type: "link", url: "https://example.com" },
        { type: "text", value: ", then " },
        { type: "link", url: "https://example.org" },
        { type: "text", value: "." },
      ]);
    });

    test("does not parse malformed domains with double dots", () => {
      const result = parseAutoLinks("example..com");

      expect(result).toEqual([{ type: "text", value: "example..com" }]);
    });

    test("does not parse localhost without a TLD", () => {
      const result = parseAutoLinks("localhost");

      expect(result).toEqual([{ type: "text", value: "localhost" }]);
    });

    test("returns no parts for an empty string", () => {
      const result = parseAutoLinks("");

      expect(result).toEqual([]);
    });

    test("preserves whitespace-only strings as text", () => {
      const result = parseAutoLinks("   ");

      expect(result).toEqual([{ type: "text", value: "   " }]);
    });
  });

  describe("URLs wrapped in parentheses (desired behaviour)", () => {
    test("strips trailing ) when URL is wrapped in parentheses", () => {
      const result = parseAutoLinks(
        "Check out (https://example.com) for more.",
      );
      expect(result).toContainEqual({
        type: "link",
        url: "https://example.com",
      });
    });

    test.each([",", ".", "!", "?", ";", ":"])(
      "strips trailing ) when wrapped URL is followed by %s",
      (punctuation) => {
        const result = parseAutoLinks(
          `Check (https://example.com/)${punctuation} please`,
        );
        expect(result).toContainEqual({
          type: "link",
          url: "https://example.com/",
        });

        const texts = result
          .filter((p) => p.type === "text")
          .map((p) => p.value);
        expect(texts.join("")).toBe(`Check ()${punctuation} please`);
      },
    );

    test.each(["?!", ".,", ":;"])(
      "strips trailing ) when wrapped URL is followed by punctuation sequence %s",
      (punctuation) => {
        const result = parseAutoLinks(
          `Check (https://example.com/)${punctuation} please`,
        );
        expect(result).toContainEqual({
          type: "link",
          url: "https://example.com/",
        });

        const texts = result
          .filter((p) => p.type === "text")
          .map((p) => p.value);
        expect(texts.join("")).toBe(`Check ()${punctuation} please`);
      },
    );

    test("preserves text flow around a URL in parentheses", () => {
      const result = parseAutoLinks("bellum (https://example.com/) please");

      expect(result).toContainEqual({
        type: "link",
        url: "https://example.com/",
      });

      const texts = result.filter((p) => p.type === "text").map((p) => p.value);
      expect(texts.join("")).toBe("bellum () please");
    });

    test("surrounding text is preserved when URL is in parentheses", () => {
      const result = parseAutoLinks(
        "Check out (https://example.com) for more.",
      );
      const texts = result.filter((p) => p.type === "text").map((p) => p.value);
      expect(texts.join("")).toBe("Check out () for more.");
    });

    test("strips multiple trailing ) when URL is followed by extra closing parens", () => {
      const result = parseAutoLinks("((https://example.com))");
      expect(result).toContainEqual({
        type: "link",
        url: "https://example.com",
      });
    });

    test("strips multiple trailing ) before a comma", () => {
      const result = parseAutoLinks("((https://example.com/)),");

      expect(result).toEqual([
        { type: "text", value: "((" },
        { type: "link", url: "https://example.com/" },
        { type: "text", value: "))," },
      ]);
    });
  });

  describe("AutoLink rendering", () => {
    test("uses https for bare domains", () => {
      const html = renderToStaticMarkup(
        createElement(AutoLink, { text: "Visit example.com" }),
      );

      expect(html).toContain('href="https://example.com"');
    });

    test("keeps explicit http protocol unchanged", () => {
      const html = renderToStaticMarkup(
        createElement(AutoLink, { text: "Visit http://example.com" }),
      );

      expect(html).toContain('href="http://example.com"');
    });
  });
});
