import sharp from "sharp";

import { isImageFit, type ImageFit } from "~/shared/image";

// Tuned for the 512/256 MB single-vCPU fly machines: libvips' default
// operation cache holds up to 100 MB of decoded image data across requests,
// and its thread pool buys nothing on one shared core. Applied here so every
// runtime transform goes through a configured sharp; the standalone
// optimize-images build script imports sharp directly and stays untuned.
sharp.cache(false);
sharp.concurrency(1);

// Each transform decodes the full source image to raw pixels (~48 MB for a
// 4000×3000 photo), and one <OptimizedImage> fans out into 5 srcset requests.
// Gate in-flight transforms so a burst can't stack decodes past what the
// 256/512 MB fly machines can hold; excess requests queue FIFO.
const MAX_CONCURRENT_TRANSFORMS = 2;
let activeTransforms = 0;
const transformQueue: (() => void)[] = [];

async function acquireTransformSlot(): Promise<void> {
  if (activeTransforms < MAX_CONCURRENT_TRANSFORMS) {
    activeTransforms++;
    return;
  }
  await new Promise<void>((resolve) => transformQueue.push(resolve));
}

function releaseTransformSlot(): void {
  const next = transformQueue.shift();
  if (next) {
    // Hand the slot to the next waiter; activeTransforms stays unchanged.
    next();
  } else {
    activeTransforms--;
  }
}

export async function transformToWebp(
  blob: Uint8Array,
  { width, height, fit }: { width?: number; height?: number; fit?: ImageFit },
): Promise<Buffer> {
  await acquireTransformSlot();
  try {
    return await sharp(blob)
      .webp()
      .resize({
        ...(width && { width }),
        ...(height && { height }),
        // Keep a runtime backstop for untyped callers in addition to the
        // resource route's search-param validation.
        fit: isImageFit(fit) ? fit : "cover",
      })
      .toBuffer();
  } finally {
    releaseTransformSlot();
  }
}
