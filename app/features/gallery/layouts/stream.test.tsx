import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { GalleryImageModel } from "../view-models";

import { layout, StreamGallery } from "./stream";

import type { GalleryLayoutProps } from "~/features/gallery/layouts/types";

// OptimizedImage reads delivery config from the root loader, which no test
// router provides
vi.mock("~/shared/root-data", () => ({
  useImageConfig: () => ({ imageProvider: "local", cloudinaryCloudName: null }),
}));

const may = {
  id: "evt-may",
  title: "spring supper",
  date: "2026-05-09T17:00:00.000Z",
};
const march = {
  id: "evt-march",
  title: "winter's end",
  date: "2026-03-14T18:00:00.000Z",
};

function makeImage(
  id: string,
  event: GalleryImageModel["event"],
  overrides: Partial<GalleryImageModel> = {},
): GalleryImageModel {
  return {
    id,
    image: {
      id: `img-${id}`,
      storageKey: `key-${id}`,
      version: 1,
      width: 1200,
      height: 800,
      blurDataUrl: null,
    },
    alt: id,
    caption: null,
    event,
    ...overrides,
  };
}

// foundations hand layouts a newest-dinner-first feed
const feed: GalleryImageModel[] = [
  makeImage("may-1", may),
  makeImage("may-2", may),
  makeImage("march-1", march),
  makeImage("march-2", march),
  makeImage("loose-1", null),
];

function renderStream(props: GalleryLayoutProps) {
  return render(
    <MemoryRouter>
      <StreamGallery {...props} />
    </MemoryRouter>,
  );
}

describe("stream gallery layout", () => {
  it("gives every dinner one chapter heading, newest first", () => {
    renderStream({ images: feed });

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "spring supper",
      "winter's end",
      "odds and ends",
    ]);

    expect(screen.getByRole("link", { name: "spring supper" })).toHaveAttribute(
      "href",
      "/dinners/evt-may",
    );
    // the archive label reads "may 2026", not the full date line
    expect(screen.getByText("may 2026")).toBeInTheDocument();
  });

  it("keeps each dinner's photos under its own chapter", () => {
    renderStream({ images: feed });

    const [spring, winter] = screen.getAllByRole("region");

    expect(within(spring).getByAltText("may-1")).toBeInTheDocument();
    expect(within(spring).getByAltText("may-2")).toBeInTheDocument();
    expect(within(spring).queryByAltText("march-1")).not.toBeInTheDocument();

    expect(within(winter).getByAltText("march-1")).toBeInTheDocument();
    expect(within(winter).queryByAltText("may-1")).not.toBeInTheDocument();

    expect(within(spring).getByText("2 photos")).toBeInTheDocument();
  });

  it("collects unclaimed photos in a trailing chapter of their own", () => {
    renderStream({ images: feed });

    const regions = screen.getAllByRole("region");
    const last = regions[regions.length - 1];

    expect(regions).toHaveLength(3);
    expect(
      within(last).getByRole("heading", { name: "odds and ends" }),
    ).toBeInTheDocument();
    expect(within(last).getByAltText("loose-1")).toBeInTheDocument();
    expect(within(last).queryByRole("link")).not.toBeInTheDocument();
    expect(within(last).getByText("1 photo")).toBeInTheDocument();
  });

  it("renders the tail of a chapter as a keyboard-reachable scrolling strip", () => {
    renderStream({ images: feed });

    const strip = screen.getByRole("group", {
      name: "more photos from spring supper",
    });

    expect(strip).toHaveAttribute("tabindex", "0");
    expect(strip).toHaveClass("overflow-x-auto", "snap-x");
    // the lead photo sits outside the strip, at hero size
    expect(within(strip).queryByAltText("may-1")).not.toBeInTheDocument();
    expect(within(strip).getByAltText("may-2")).toBeInTheDocument();
  });

  it("prints captions under their photo instead of hiding them behind hover", () => {
    renderStream({
      images: [makeImage("may-1", may, { caption: "the last course" })],
    });

    expect(screen.getByText("the last course")).toBeInTheDocument();
  });

  it("drops the chapter heading in the section variant", () => {
    renderStream({ images: [makeImage("may-1", may)], variant: "section" });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByAltText("may-1")).toBeInTheDocument();
  });

  it("shows a quiet empty state on the page and nothing in a section", () => {
    const { unmount } = renderStream({ images: [] });
    expect(
      screen.getByText(/no photos yet. the next evening will start the story./),
    ).toBeInTheDocument();
    unmount();

    const { container } = renderStream({ images: [], variant: "section" });
    expect(container).toBeEmptyDOMElement();
  });

  it("registers itself for the layout switcher", () => {
    expect(layout.id).toBe("stream");
    expect(layout.label).toBe(layout.label.toLowerCase());
    expect(layout.Component).toBe(StreamGallery);
  });
});
