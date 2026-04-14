import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import type { BlockEditorContext } from "../../catalog";
import { createLinkTargetRegistry } from "../../link-targets";
import { createPageCommandBuilder } from "../../page-commands";
import { refByDefinitionKey } from "../block-ref";

import { ImageBlockEditor } from "./editor";
import type { ImageBlockType } from "./model";

function makeCtx(
  overrides: Partial<BlockEditorContext<ImageBlockType["data"]>> = {},
): BlockEditorContext<ImageBlockType["data"]> {
  const data: ImageBlockType["data"] = {
    image: { kind: "asset", src: "/accent-image.jpg", alt: "" },
    variant: "default",
  };

  return {
    data,
    blockRef: refByDefinitionKey("image-main"),
    commandBuilder: createPageCommandBuilder("home", null),
    linkTargetRegistry: createLinkTargetRegistry([]),
    capabilities: { canMoveUp: false, canMoveDown: false, canDelete: false },
    ...overrides,
  };
}

function render(element: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe("ImageBlockEditor", () => {
  test("renders image lifecycle and accessibility fields", () => {
    const html = render(<ImageBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("Image action");
    expect(html).toContain('name="imageFile"');
    expect(html).toContain("Image accessibility");
    expect(html).toContain("Choose accessibility");
  });

  test("shows read-only image src for asset-backed image blocks", () => {
    const html = render(<ImageBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("/accent-image.jpg");
    expect(html).not.toContain(`<input type="text" value="/accent-image.jpg"`);
  });

  test("renders variant options", () => {
    const html = render(<ImageBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("Default");
    expect(html).toContain("Full width");
  });
});
