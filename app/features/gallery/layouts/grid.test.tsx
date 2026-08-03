import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { GalleryImageModel } from "../view-models";

import { GalleryGrid, layout } from "./grid";

import type { ImageProviderConfig } from "~/shared/image";

// OptimizedImage reads delivery config from the root loader, which no layout
// test has; the local provider needs no cloud name.
vi.mock("~/shared/root-data", () => ({
  useImageConfig: (): ImageProviderConfig => ({
    imageProvider: "local",
    cloudinaryCloudName: null,
  }),
}));

const event = {
  id: "dinner-1",
  title: "a long table in march",
  date: "2026-03-14T18:00:00.000Z",
};

function makeImages(count: number): GalleryImageModel[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${index + 1}`,
    image: {
      id: `img-${index + 1}`,
      storageKey: `key-${index + 1}`,
      version: 1,
      width: 1600,
      height: 1200,
      blurDataUrl: null,
    },
    alt: `photo ${index + 1}`,
    caption: `caption ${index + 1}`,
    event,
  }));
}

/** The layout links to dinners, so it needs a router around it. */
function renderGrid(props: Parameters<typeof GalleryGrid>[0]) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <GalleryGrid {...props} /> },
    { path: "/dinners/:id", Component: () => <p>dinner page</p> },
  ]);

  return render(<Stub initialEntries={["/"]} />);
}

function lightbox() {
  return screen.getByRole("dialog");
}

/** A real pointer focuses the button it presses; fireEvent does not. */
function pressTile(tile: HTMLElement) {
  tile.focus();
  fireEvent.click(tile);
}

function pressKey(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

describe("gallery grid layout", () => {
  it("renders one tile per image", () => {
    renderGrid({ images: makeImages(3) });

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByAltText("photo 1")).toBeInTheDocument();
    expect(screen.getByAltText("photo 3")).toBeInTheDocument();
  });

  it("opens the lightbox on the tile that was clicked, with its caption and dinner", () => {
    renderGrid({ images: makeImages(4) });

    pressTile(screen.getByRole("button", { name: /photo 2/ }));

    const dialog = lightbox();
    expect(within(dialog).getByText("caption 2")).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 4")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /a long table in march/ }),
    ).toHaveAttribute("href", "/dinners/dinner-1");
  });

  it("shows the lightbox image at its own aspect ratio rather than a square crop", () => {
    renderGrid({ images: makeImages(1) });

    pressTile(screen.getByRole("button", { name: /photo 1/ }));

    const frame = within(lightbox()).getByAltText("photo 1").parentElement;
    expect(frame).toHaveStyle({ aspectRatio: "1200 / 900" });
  });

  it("moves to the next and previous image with the arrow keys", () => {
    renderGrid({ images: makeImages(4) });

    pressTile(screen.getByRole("button", { name: /photo 2/ }));

    pressKey("ArrowRight");
    expect(within(lightbox()).getByText("caption 3")).toBeInTheDocument();
    expect(within(lightbox()).getByText("3 of 4")).toBeInTheDocument();

    pressKey("ArrowLeft");
    pressKey("ArrowLeft");
    expect(within(lightbox()).getByText("caption 1")).toBeInTheDocument();

    // the ends wrap rather than dead-ending
    pressKey("ArrowLeft");
    expect(within(lightbox()).getByText("caption 4")).toBeInTheDocument();
  });

  it("returns focus to the tile that opened the lightbox", () => {
    renderGrid({ images: makeImages(3) });

    const tile = screen.getByRole("button", { name: /photo 2/ });
    pressTile(tile);
    // arrowing away must not move where focus lands on close
    pressKey("ArrowRight");
    pressKey("Escape");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(tile).toHaveFocus();
  });

  it("degrades gracefully when no dinner claims an image", () => {
    const [image] = makeImages(1);
    renderGrid({ images: [{ ...image, event: null, caption: null }] });

    pressTile(screen.getByRole("button", { name: /photo 1/ }));

    expect(within(lightbox()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(lightbox()).getByText("1 of 1")).toBeInTheDocument();
  });

  describe("section variant", () => {
    it("caps the tiles and folds the rest behind a +N more affordance", () => {
      renderGrid({ images: makeImages(10), variant: "section" });

      const tiles = screen.getAllByRole("button");
      expect(tiles).toHaveLength(6);
      expect(screen.getByText("+4 more")).toBeInTheDocument();

      // the affordance opens the lightbox at that tile, it does not paginate
      pressTile(tiles[5]);
      expect(within(lightbox()).getByText("6 of 10")).toBeInTheDocument();

      pressKey("ArrowRight");
      expect(within(lightbox()).getByText("caption 7")).toBeInTheDocument();
    });

    it("hides the dinner labels the surrounding page already shows", () => {
      renderGrid({ images: makeImages(3), variant: "section" });

      expect(
        screen.queryByText(/a long table in march/),
      ).not.toBeInTheDocument();

      pressTile(screen.getByRole("button", { name: /photo 1/ }));
      expect(within(lightbox()).queryByRole("link")).not.toBeInTheDocument();
      expect(within(lightbox()).getByText("caption 1")).toBeInTheDocument();
    });

    it("renders nothing at all when there are no images", () => {
      const { container } = renderGrid({ images: [], variant: "section" });

      expect(container).toBeEmptyDOMElement();
    });
  });

  it("shows a quiet empty state on the page variant", () => {
    renderGrid({ images: [] });

    expect(screen.getByText(/no photos from the table yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exports itself for the layout registry", () => {
    expect(layout.id).toBe("grid");
    expect(layout.label).toBe(layout.label.toLowerCase());
    expect(layout.Component).toBe(GalleryGrid);
  });
});
