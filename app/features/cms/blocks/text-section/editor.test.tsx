import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import type { BlockEditorContext } from "../../catalog";
import { createLinkTargetRegistry } from "../../link-targets";
import { createPageCommandBuilder } from "../../page-commands";
import { refByDefinitionKey, refByPageBlockId } from "../block-ref";

import { TextSectionBlockEditor } from "./editor";
import type { TextSectionBlockType } from "./model";

function makeCtx(
  overrides: Partial<BlockEditorContext<TextSectionBlockType["data"]>> = {},
): BlockEditorContext<TextSectionBlockType["data"]> {
  const data: TextSectionBlockType["data"] = {
    headline: "Our Vision",
    body: "Some body text about our vision.",
    variant: "plain",
  };

  return {
    data,
    blockRef: refByDefinitionKey("vision-section"),
    commandBuilder: createPageCommandBuilder("home", null),
    linkTargetRegistry: createLinkTargetRegistry([]),
    capabilities: { canMoveUp: false, canMoveDown: false, canDelete: false },
    ...overrides,
  };
}

function render(element: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe("TextSectionBlockEditor", () => {
  test("renders the headline field pre-populated with current data", () => {
    const html = render(<TextSectionBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("Our Vision");
  });

  test("renders the body field pre-populated with current data", () => {
    const html = render(<TextSectionBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("Some body text about our vision.");
  });

  test("renders the variant select with plain and slanted options", () => {
    const html = render(<TextSectionBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("plain");
    expect(html).toContain("slanted");
  });

  test("renders the correct hidden intent field for set-block-data", () => {
    const html = render(<TextSectionBlockEditor ctx={makeCtx()} />);

    expect(html).toContain('value="set-block-data"');
  });

  test("renders the block type as text-section in a hidden field", () => {
    const html = render(<TextSectionBlockEditor ctx={makeCtx()} />);

    expect(html).toContain('value="text-section"');
  });

  test("shows move-up button when canMoveUp is true", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          capabilities: {
            canMoveUp: true,
            canMoveDown: false,
            canDelete: false,
          },
        })}
      />,
    );

    expect(html.toLowerCase()).toContain("move up");
  });

  test("does not show move-up button when canMoveUp is false", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          capabilities: {
            canMoveUp: false,
            canMoveDown: false,
            canDelete: false,
          },
        })}
      />,
    );

    expect(html.toLowerCase()).not.toContain("move up");
  });

  test("shows move-down button when canMoveDown is true", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          capabilities: {
            canMoveUp: false,
            canMoveDown: true,
            canDelete: false,
          },
        })}
      />,
    );

    expect(html.toLowerCase()).toContain("move down");
  });

  test("shows delete button when canDelete is true", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          capabilities: {
            canMoveUp: false,
            canMoveDown: false,
            canDelete: true,
          },
        })}
      />,
    );

    expect(html.toLowerCase()).toContain("delete");
  });

  test("does not show delete button when canDelete is false", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          capabilities: {
            canMoveUp: false,
            canMoveDown: false,
            canDelete: false,
          },
        })}
      />,
    );

    expect(html.toLowerCase()).not.toContain("delete");
  });

  test("renders a block-level error message when the route returns one", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          formState: {
            lastResult: null,
            errorMessage:
              "Block could not be saved — please refresh and retry.",
          },
        })}
      />,
    );

    expect(html).toContain("Block could not be saved");
  });

  test("uses page-block-id in form id when ref is a page-block-id ref", () => {
    const html = render(
      <TextSectionBlockEditor
        ctx={makeCtx({
          blockRef: refByPageBlockId("block-xyz-999", 3),
        })}
      />,
    );

    expect(html).toContain("text-section-block-editor-block-xyz-999");
  });
});
