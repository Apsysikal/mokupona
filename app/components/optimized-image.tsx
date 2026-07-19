import type { ComponentProps } from "react";

import {
  getImageUrl,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageFit,
} from "~/shared/image";
import { useImageConfig } from "~/shared/root-data";

type ImageInputProps = {
  imageId: string;
  width: number;
  height: number;
  fit?: ImageFit;
};

type ImageProps = Omit<ComponentProps<"img">, "width" | "height" | "src"> &
  ImageInputProps;

/**
 * Renders a dynamically transformed image with a width-descriptor `srcSet`.
 * Pass `sizes` whenever the image renders narrower than the viewport —
 * without it browsers assume roughly `100vw` and pick needlessly large
 * candidates.
 */
export function OptimizedImage({
  imageId,
  width,
  height,
  fit = "cover",
  ...props
}: ImageProps) {
  const config = useImageConfig();
  const aspect = width / height;

  const srcSet = RESPONSIVE_IMAGE_WIDTHS.map((w) => {
    // keep derived heights integer so URL variants stay cache-friendly
    const h = Math.round(w / aspect);
    return `${getImageUrl({ id: imageId }, config, { width: w, height: h, fit })} ${w}w`;
  }).join(", ");

  return (
    <picture>
      <img
        srcSet={srcSet}
        src={getImageUrl({ id: imageId }, config, { width, height, fit })}
        width={width}
        height={height}
        {...props}
      />
    </picture>
  );
}
