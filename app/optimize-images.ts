import path from "node:path";

import sharp from "sharp";

import { RESPONSIVE_IMAGE_WIDTHS } from "~/shared/image";

const __dirname = import.meta.dirname;

const publicDir = path.join(__dirname, "..", "public");

async function optimizeResponsiveImage(source: string, outputStem: string) {
  for (const width of RESPONSIVE_IMAGE_WIDTHS) {
    await sharp(source)
      .resize({ width })
      .webp({ quality: 60 })
      .toFile(path.join(publicDir, `${outputStem}-${width}.webp`));
  }

  await sharp(source)
    .resize({ width: RESPONSIVE_IMAGE_WIDTHS[0] })
    .jpeg()
    .toFile(path.join(publicDir, `${outputStem}.jpg`));
}

async function optimize() {
  await optimizeResponsiveImage(
    path.join(publicDir, "hero-image-original.jpg"),
    "hero-image",
  );
  await optimizeResponsiveImage(
    path.join(publicDir, "accent-image-original.png"),
    "accent-image",
  );
}

optimize().catch((e) => {
  console.error(e);
  process.exit(1);
});
