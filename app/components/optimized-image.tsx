import type { ComponentProps } from "react";

import {
  getImageUrl,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageFit,
} from "~/shared/image";

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
  const imageUrl = getImageUrl(imageId);
  const aspect = width / height;

  const searchParams = new URLSearchParams({
    w: `${width}`,
    h: `${height}`,
    fit,
  });

  const srcSetUrls = RESPONSIVE_IMAGE_WIDTHS.map((w) => {
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
