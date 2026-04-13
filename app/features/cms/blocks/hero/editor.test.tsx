import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import type { BlockEditorContext } from "../../catalog";
import { createLinkTargetRegistry } from "../../link-targets";
import { createPageCommandBuilder } from "../../page-commands";
import { refByDefinitionKey } from "../block-ref";

import { HeroBlockEditor } from "./editor";
import type { HeroBlockType } from "./model";

function makeCtx(
  overrides: Partial<BlockEditorContext<HeroBlockType["data"]>> = {},
): BlockEditorContext<HeroBlockType["data"]> {
  const data: HeroBlockType["data"] = {
    eyebrow: "test eyebrow",
    headline: "test headline",
    description: "test description",
    actions: [{ label: "Join", href: "/join" }],
    image: { src: "/hero.jpg" },
  };

  return {
    data,
    blockRef: refByDefinitionKey("hero-main"),
    commandBuilder: createPageCommandBuilder("home", null),
    linkTargetRegistry: createLinkTargetRegistry([
      { key: "dinners", label: "Dinners", href: "/dinners" },
      { key: "join", label: "Join", href: "/join" },
    ]),
    capabilities: { canMoveUp: false, canMoveDown: false, canDelete: false },
    ...overrides,
  };
}

function render(element: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe("HeroBlockEditor", () => {
  test("renders the headline field pre-populated with current data", () => {
    const html = render(<HeroBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("test headline");
  });

  test("renders the eyebrow field pre-populated with current data", () => {
    const html = render(<HeroBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("test eyebrow");
  });

  test("renders the CTA select with link target options", () => {
    const html = render(<HeroBlockEditor ctx={makeCtx()} />);

    expect(html).toContain("Dinners");
    expect(html).toContain("Join");
  });

  test("renders nested CTA field names for robust form parsing", () => {
    const html = render(<HeroBlockEditor ctx={makeCtx()} />);

    expect(html).toContain('name="actions[0].label"');
    expect(html).toContain('name="actions[0].href"');
  });

  test("renders the image src as read-only (not an editable input)", () => {
    const html = render(<HeroBlockEditor ctx={makeCtx()} />);

    // The image src should be visible but not in an <input type="text"> that could alter it
    expect(html).toContain("/hero.jpg");
    expect(html).not.toContain(`<input type="text" value="/hero.jpg"`);
  });

  test("shows move-up button when canMoveUp is true", () => {
    const html = render(
      <HeroBlockEditor
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
      <HeroBlockEditor
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

  test("shows delete button when canDelete is true", () => {
    const html = render(
      <HeroBlockEditor
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

  test("renders a block-level error message when the route returns one", () => {
    const html = render(
      <HeroBlockEditor
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

  test("does not show delete button when canDelete is false", () => {
    const html = render(
      <HeroBlockEditor
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
});
