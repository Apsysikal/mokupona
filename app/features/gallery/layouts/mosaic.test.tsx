import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { GalleryImageModel } from "../view-models";

import { MosaicGallery } from "./mosaic";
import type { GalleryLayoutProps } from "./types";

import type { ImageProviderConfig } from "~/shared/image";

// the tiles render OptimizedImage, which reads delivery config from the root
// loader; pin it so the test never needs the real root route
vi.mock("~/shared/root-data", () => ({
  useImageConfig: (): ImageProviderConfig => ({
    imageProvider: "local",
    cloudinaryCloudName: null,
  }),
}));

function makeImage(
  overrides: Partial<GalleryImageModel> & { id: string },
): GalleryImageModel {
  return {
    image: {
      id: `img-${overrides.id}`,
      storageKey: `key-${overrides.id}`,
      version: 1,
      width: 1200,
      height: 800,
      blurDataUrl: null,
    },
    alt: `photo ${overrides.id}`,
    caption: null,
    event: {
      id: "dinner-1",
      title: "nine courses",
      date: "2026-04-11T18:00:00.000Z",
    },
    ...overrides,
  };
}

function renderMosaic(props: GalleryLayoutProps) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <MosaicGallery {...props} /> },
  ]);

  return render(<Stub initialEntries={["/"]} />);
}

/** The frame OptimizedImage reserves — the tile's real aspect ratio. */
function frameOf(alt: string) {
  const img = screen.getByAltText(alt);
  return {
    width: Number(img.getAttribute("width")),
    height: Number(img.getAttribute("height")),
  };
}

describe("mosaic layout", () => {
  it("renders every image in the feed", () => {
    renderMosaic({
      images: [
        makeImage({ id: "a" }),
        makeImage({ id: "b" }),
        makeImage({ id: "c" }),
      ],
    });

    expect(screen.getAllByRole("img")).toHaveLength(3);
    for (const id of ["a", "b", "c"]) {
      expect(screen.getByAltText(`photo ${id}`)).toBeInTheDocument();
    }
  });

  it("keeps each photo's intrinsic aspect ratio", () => {
    renderMosaic({
      images: [
        makeImage({
          id: "wide",
          alt: "panorama",
          image: {
            id: "img-wide",
            storageKey: "wide",
            version: null,
            width: 2000,
            height: 1000,
            blurDataUrl: null,
          },
        }),
        makeImage({
          id: "tall",
          alt: "portrait",
          image: {
            id: "img-tall",
            storageKey: "tall",
            version: null,
            width: 800,
            height: 1200,
            blurDataUrl: null,
          },
        }),
      ],
    });

    const wide = frameOf("panorama");
    const tall = frameOf("portrait");

    expect(wide.width / wide.height).toBeCloseTo(2, 2);
    expect(tall.width / tall.height).toBeCloseTo(800 / 1200, 2);
    // the reserved box must be there for the first paint, not measured later
    expect(screen.getByAltText("portrait").parentElement).toHaveStyle({
      aspectRatio: `${tall.width} / ${tall.height}`,
    });
  });

  it("falls back to a 3:2 frame when the row has no intrinsic dimensions", () => {
    renderMosaic({
      images: [
        makeImage({
          id: "unknown",
          alt: "no dimensions",
          image: {
            id: "img-unknown",
            storageKey: "unknown",
            version: null,
            width: null,
            height: null,
            blurDataUrl: null,
          },
        }),
      ],
    });

    const frame = frameOf("no dimensions");
    expect(frame.width / frame.height).toBeCloseTo(3 / 2, 2);
  });

  it("keeps captions in the accessibility tree without hover", () => {
    const { container } = renderMosaic({
      images: [makeImage({ id: "a", caption: "the last course, half eaten" })],
    });

    const caption = screen.getByText("the last course, half eaten");
    expect(caption).toBeVisible();
    // a hover-only overlay would be aria-hidden or removed; this one is neither
    expect(caption.closest("[aria-hidden]")).toBeNull();
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "the last course, half eaten",
    );
  });

  it("labels the dinner an image came from with a link to it", () => {
    renderMosaic({
      images: [makeImage({ id: "a", caption: "steam off the pot" })],
    });

    const link = screen.getByRole("link", { name: /nine courses/ });
    expect(link).toHaveAttribute("href", "/dinners/dinner-1");
    expect(link).toHaveTextContent("apr 2026");
  });

  it("renders an image no dinner claims without a label", () => {
    renderMosaic({
      images: [makeImage({ id: "orphan", event: null, caption: "a candle" })],
    });

    expect(screen.getByAltText("photo orphan")).toBeInTheDocument();
    expect(screen.getByText("a candle")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("drops the (redundant) dinner labels in the section variant", () => {
    renderMosaic({
      images: [makeImage({ id: "a", caption: "steam off the pot" })],
      variant: "section",
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/nine courses/)).not.toBeInTheDocument();
    // the caption itself survives — it is the only text the tile carries
    expect(screen.getByText("steam off the pot")).toBeInTheDocument();
  });

  it("lays the wall out with CSS columns so it is correct on the first paint", () => {
    const { container } = renderMosaic({ images: [makeImage({ id: "a" })] });

    const wall = container.querySelector("div[class*='columns-']");
    expect(wall).toBeInTheDocument();
    expect(container.querySelector("figure")).toHaveClass("break-inside-avoid");
  });

  it("shows a quiet empty state on the page variant", () => {
    renderMosaic({ images: [] });

    expect(screen.getByText(/no photos on the wall yet/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders nothing at all on an empty section variant", () => {
    const { container } = renderMosaic({ images: [], variant: "section" });

    expect(container).toBeEmptyDOMElement();
  });
});
