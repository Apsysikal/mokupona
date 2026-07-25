export type BlockAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

export type BlockImage = {
  /** Cloudinary public_id (e.g. "static/hero-image") since the migration. */
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  /** Blur-up placeholder, supplied by the loader via getBlurDataUrl. */
  blurDataUrl?: string | null;
};
