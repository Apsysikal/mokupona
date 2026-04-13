import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { OptimizedImage } from "./optimized-image";

describe("OptimizedImage", () => {
  test("does not generate srcSet candidates larger than the requested width", () => {
    const html = renderToStaticMarkup(
      <OptimizedImage imageId="img_123" width={640} height={480} alt="" />,
    );

    expect(html).toContain("432w");
    expect(html).toContain("640w");
    expect(html).not.toContain("864w");
    expect(html).not.toContain("1080w");
  });

  test("forwards the sizes attribute to the underlying image", () => {
    const html = renderToStaticMarkup(
      <OptimizedImage
        imageId="img_123"
        width={640}
        height={480}
        alt=""
        sizes="(min-width: 1024px) 640px, 100vw"
      />,
    );

    expect(html).toContain('sizes="(min-width: 1024px) 640px, 100vw"');
  });
});
