import type { ComponentProps } from "react";

import { getImageUrl } from "~/utils/misc";

// Single source of truth for the resize fit vocabulary: the file.$fileId
// resource route builds its search-param schema from this list.
export const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

type ImageInputProps = {
  imageId: string;
  width: number;
  height: number;
  fit?: ImageFit;
};

type ImageProps = Omit<ComponentProps<"img">, "width" | "height" | "src"> &
  ImageInputProps;

export function OptimizedImage({
  imageId,
  width,
  height,
  fit = "cover",
  ...props
}: ImageProps) {
  const breakPoints = [432, 648, 864, 1080];
  const imageUrl = getImageUrl(imageId);
  const aspect = width / height;

  const searchParams = new URLSearchParams({
    w: `${width}`,
    h: `${height}`,
    fit,
  });

  const srcSetUrls = breakPoints.map((w) => {
    // sharp rejects fractional dimensions, so keep derived heights integer
    const h = Math.round(w / aspect);
    const searchParams = new URLSearchParams({
      w: `${w}`,
      h: `${h}`,
      fit,
    });

    return `${imageUrl + "?" + searchParams.toString()} ${w}w`;
  });

  return (
    <picture>
      <img
        srcSet={srcSetUrls.join(", ")}
        src={imageUrl + "?" + searchParams.toString()}
        width={width}
        height={height}
        {...props}
      />
    </picture>
  );
}
