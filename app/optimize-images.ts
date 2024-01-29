import path from "node:path";

import sharp from "sharp";

const landingPagePath = path.join(
  __dirname,
  "..",
  "public",
  "landing-page.jpg",
);

async function optimize() {
  const variants = [
    {
      size: "original",
      width: 1080,
    },
    {
      size: "lg",
      width: 864,
    },
    {
      size: "md",
      width: 648,
    },
    {
      size: "sm",
      width: 432,
    },
  ];

  variants.forEach(async ({ size, width }) => {
    const optimizedPath = path.join(
      __dirname,
      "..",
      "public",
      `landing-page-${size}.webp`,
    );

    await sharp(landingPagePath).resize(width).webp().toFile(optimizedPath);
  });
}

optimize().catch((e) => {
  console.error(e);
  process.exit(1);
});
