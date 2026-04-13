import type { ComponentProps } from "react";

import { getImageUrl } from "~/utils/misc";

type OptimizedImageFit = "cover" | "contain" | "fill";

type ImageInputProps = {
  imageId: string;
  width: number;
  height: number;
  fit?: OptimizedImageFit;
};

type OptimizedImageProps = Omit<
  ComponentProps<"img">,
  "width" | "height" | "src"
> &
  ImageInputProps;

const RESPONSIVE_BREAKPOINTS = [432, 648, 864, 1080];

export function OptimizedImage({
  imageId,
  width,
  height,
  fit = "cover",
  ...props
}: OptimizedImageProps) {
  const imageUrl = getImageUrl(imageId);
  const aspect = width / height;
  const responsiveWidths = [...new Set([...RESPONSIVE_BREAKPOINTS, width])]
    .filter((candidateWidth) => candidateWidth <= width)
    .sort((left, right) => left - right);

  const searchParams = new URLSearchParams({
    w: `${width}`,
    h: `${height}`,
    fit,
  });

  const srcSetUrls = responsiveWidths.map((w) => {
    const h = w / aspect;
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
