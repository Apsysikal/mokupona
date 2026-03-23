import path from "node:path";

import sharp from "sharp";

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
  const variants = [
    { size: "1080", width: 1080 },
    { size: "864", width: 864 },
    { size: "648", width: 648 },
    { size: "432", width: 432 },
  ];

  variants.forEach(async ({ size, width }) => {
    const optimizedPath = path.join(
      __dirname,
      "..",
      "public",
      `hero-image-${size}.webp`,
    );

    await sharp(landingPageImagePath)
      .resize({ width })
      .webp({ quality: 60 })
      .toFile(optimizedPath);
  });

  await sharp(landingPageImagePath)
    .resize({ width: 432 })
    .jpeg()
    .toFile(path.join(__dirname, "..", "public", "hero-image.jpg"));

  variants.forEach(async ({ size, width }) => {
    const optimizedPath = path.join(
      __dirname,
      "..",
      "public",
      `accent-image-${size}.webp`,
    );

    await sharp(accentImagePath)
      .resize({ width })
      .webp({ quality: 60 })
      .toFile(optimizedPath);
  });

  await sharp(accentImagePath)
    .resize({ width: 432 })
    .jpeg()
    .toFile(path.join(__dirname, "..", "public", "accent-image.jpg"));
}

optimize().catch((e) => {
  console.error(e);
  process.exit(1);
});
