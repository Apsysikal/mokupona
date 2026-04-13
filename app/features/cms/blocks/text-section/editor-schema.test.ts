import { describe, expect, test } from "vitest";

import {
  applyTextSectionBlockEditorValue,
  createTextSectionBlockEditorFormSchema,
  getTextSectionBlockEditorDefaultValue,
  getTextSectionBlockEditorFormId,
} from "./editor-schema";

import {
  refByDefinitionKey,
  refByPageBlockId,
} from "~/features/cms/blocks/block-ref";

describe("text-section editor schema validation", () => {
  test("validates successfully with all required fields", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "Our Vision",
      body: "Some body text here.",
      variant: "plain",
    });

    expect(result.success).toBe(true);
  });

  test("rejects empty headline", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "",
      body: "Some body text.",
      variant: "plain",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path[0] === "headline")).toBe(
      true,
    );
  });

  test("rejects empty body", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "Headline",
      body: "",
      variant: "plain",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path[0] === "body")).toBe(true);
  });

  test("trims whitespace-only headline", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "   ",
      body: "Body text.",
      variant: "plain",
    });

    expect(result.success).toBe(false);
  });

  test("rejects invalid variant values", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "Headline",
      body: "Body text.",
      variant: "unknown",
    });

    expect(result.success).toBe(false);
  });

  test("accepts slanted variant", () => {
    const schema = createTextSectionBlockEditorFormSchema();
    const result = schema.safeParse({
      headline: "Headline",
      body: "Body text.",
      variant: "slanted",
    });

    expect(result.success).toBe(true);
  });
});

describe("getTextSectionBlockEditorDefaultValue", () => {
  test("maps block data to form shape with all fields", () => {
    const defaults = getTextSectionBlockEditorDefaultValue({
      headline: "Our Vision",
      body: "Some body text.",
      variant: "slanted",
    });

    expect(defaults).toEqual({
      headline: "Our Vision",
      body: "Some body text.",
      variant: "slanted",
    });
  });
});

describe("applyTextSectionBlockEditorValue", () => {
  test("returns new block data from form value", () => {
    const result = applyTextSectionBlockEditorValue(
      { headline: "Old headline", body: "Old body", variant: "plain" },
      { headline: "New headline", body: "New body", variant: "slanted" },
    );

    expect(result).toEqual({
      headline: "New headline",
      body: "New body",
      variant: "slanted",
    });
  });

  test("does not mutate current data", () => {
    const current = {
      headline: "Original",
      body: "Original body",
      variant: "plain" as const,
    };
    applyTextSectionBlockEditorValue(current, {
      headline: "Changed",
      body: "Changed body",
      variant: "slanted",
    });

    expect(current.headline).toBe("Original");
  });
});

describe("getTextSectionBlockEditorFormId", () => {
  test("returns a stable id for definition-key refs", () => {
    const id = getTextSectionBlockEditorFormId(
      refByDefinitionKey("vision-section"),
    );

    expect(id).toBe("text-section-block-editor-vision-section");
  });

  test("returns a stable id for page-block-id refs", () => {
    const id = getTextSectionBlockEditorFormId(
      refByPageBlockId("block-abc-123", 2),
    );

    expect(id).toBe("text-section-block-editor-block-abc-123");
  });
});
