import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OptimizedImage } from "./optimized-image";

import type { ImageProviderConfig } from "~/shared/image";

// the component reads delivery config from the root loader; pin it per test
const mocks = vi.hoisted(() => ({
  useImageConfig: vi.fn<() => ImageProviderConfig>(() => ({
    imageProvider: "local",
    cloudinaryCloudName: null,
  })),
}));

vi.mock("~/shared/root-data", () => ({
  useImageConfig: mocks.useImageConfig,
}));

const image = {
  id: "img-1",
  storageKey: "abc123",
  version: 3,
  width: 1200,
  height: 800,
  blurDataUrl: "data:image/webp;base64,dGlueQ==",
};

function renderImage(overrides: Partial<typeof image> = {}) {
  return render(
    <OptimizedImage
      image={{ ...image, ...overrides }}
      width={640}
      height={480}
      alt="A dinner table"
    />,
  );
}

/** Pin HTMLImageElement.complete for the duration of one test. */
function stubImageComplete(value: boolean) {
  const original = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "complete",
  );
  Object.defineProperty(HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => value,
  });
  return () => {
    if (original) {
      Object.defineProperty(HTMLImageElement.prototype, "complete", original);
    }
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("OptimizedImage blur-up", () => {
  it("layers the stored placeholder under the real image", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage();

    const placeholder = container.querySelector(
      `img[src="${image.blurDataUrl}"]`,
    );
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("aria-hidden");
    // the backdrop-blur overlay smooths the upscaled 100px placeholder
    expect(container.querySelector(".backdrop-blur-2xl")).toBeInTheDocument();

    restore();
  });

  it("falls back to a neutral surface when no placeholder is stored", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage({ blurDataUrl: null });

    expect(
      container.querySelector("img[src^='data:']"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".backdrop-blur-2xl"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".bg-primary\\/10")).toBeInTheDocument();

    restore();
  });

  it("reserves the intrinsic aspect ratio on the frame", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage();

    expect(container.firstElementChild).toHaveStyle({
      aspectRatio: "1200 / 800",
    });

    restore();
  });

  it("fades the real image in on load", () => {
    const restore = stubImageComplete(false);
    renderImage();

    const img = screen.getByAltText("A dinner table");
    expect(img).toHaveClass("opacity-0");

    fireEvent.load(img);

    expect(img).toHaveClass("opacity-100");
    restore();
  });

  it("shows a cached (already complete) image immediately — no load event fires", () => {
    const restore = stubImageComplete(true);
    renderImage();

    expect(screen.getByAltText("A dinner table")).toHaveClass("opacity-100");
    restore();
  });

  it("emits provider URLs for src and every srcSet rung", () => {
    mocks.useImageConfig.mockReturnValue({
      imageProvider: "cloudinary",
      cloudinaryCloudName: "test-cloud",
    });
    const restore = stubImageComplete(false);
    renderImage();

    const img = screen.getByAltText("A dinner table");
    expect(img).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_fill,g_auto,w_640,h_480/v3/abc123",
    );
    // 640/480 aspect carried into each rung's derived height
    expect(img.getAttribute("srcset")).toContain("w_432,h_324/v3/abc123 432w");
    expect(img.getAttribute("srcset")).toContain(
      "w_1080,h_810/v3/abc123 1080w",
    );
    restore();
  });
});
