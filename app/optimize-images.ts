import path from "node:path";

import sharp from "sharp";

import { RESPONSIVE_IMAGE_WIDTHS } from "~/shared/image";

const __dirname = import.meta.dirname;

const landingPageImagePath = path.join(
  __dirname,
  "..",
  "public",
  "hero-image-original.jpg",
);

const accentImagePath = path.join(
  __dirname,
  "..",
  "public",
  "accent-image-original.png",
);

async function optimize() {
  for (const width of RESPONSIVE_IMAGE_WIDTHS) {
    const optimizedPath = path.join(
      __dirname,
      "..",
      "public",
      `hero-image-${width}.webp`,
    );

    await sharp(landingPageImagePath)
      .resize({ width })
      .webp({ quality: 60 })
      .toFile(optimizedPath);
  }

  await sharp(landingPageImagePath)
    .resize({ width: RESPONSIVE_IMAGE_WIDTHS[0] })
    .jpeg()
    .toFile(path.join(__dirname, "..", "public", "hero-image.jpg"));

  for (const width of RESPONSIVE_IMAGE_WIDTHS) {
    const optimizedPath = path.join(
      __dirname,
      "..",
      "public",
      `accent-image-${width}.webp`,
    );

    await sharp(accentImagePath)
      .resize({ width })
      .webp({ quality: 60 })
      .toFile(optimizedPath);
  }

  await sharp(accentImagePath)
    .resize({ width: RESPONSIVE_IMAGE_WIDTHS[0] })
    .jpeg()
    .toFile(path.join(__dirname, "..", "public", "accent-image.jpg"));
}

optimize().catch((e) => {
  console.error(e);
  process.exit(1);
});
