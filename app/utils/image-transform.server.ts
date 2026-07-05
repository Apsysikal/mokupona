import sharp, { type FitEnum } from "sharp";

// Tuned for the 512/256 MB single-vCPU fly machines: libvips' default
// operation cache holds up to 100 MB of decoded image data across requests,
// and its thread pool buys nothing on one shared core. Applied here so every
// runtime transform goes through a configured sharp; the standalone
// optimize-images build script imports sharp directly and stays untuned.
sharp.cache(false);
sharp.concurrency(1);

export async function transformToWebp(
  blob: Uint8Array,
  {
    width,
    height,
    fit,
  }: { width?: number; height?: number; fit: string },
): Promise<Buffer> {
  return sharp(blob)
    .webp()
    .resize({
      ...(width && { width }),
      ...(height && { height }),
      fit: isAllowedFit(fit) ? fit : "cover",
    })
    .toBuffer();
}

function isAllowedFit(s: string | null): s is FitEnum[keyof FitEnum] {
  const allowedFits: FitEnum[keyof FitEnum][] = ["contain", "cover", "fill"];
  if (!s) return false;
  // @ts-ignore
  return allowedFits.includes(s);
}
