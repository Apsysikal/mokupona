import { generateSrcSet } from "../utils";

import type { ImageBlockType } from "./model";

import { OptimizedImage } from "~/components/optimized-image";
import { getImageUrl } from "~/utils/misc";

type ImageBlockViewProps = React.ComponentPropsWithoutRef<"picture"> & {
  blockData: ImageBlockType;
};

export function ImageBlockView({ blockData, ...rest }: ImageBlockViewProps) {
  const { data } = blockData;
  const { image, variant } = data;
  const src = image.kind === "asset" ? image.src : getImageUrl(image.imageId);
  const alt =
    image.kind === "asset"
      ? (image.alt ?? "")
      : image.decorative
        ? ""
        : image.alt;
  const width = image.kind === "asset" ? image.width : undefined;
  const height = image.kind === "asset" ? image.height : undefined;
  const srcSet = generateSrcSet(src, [432, 648, 864, 1080]);

  const baseClasses = "mx-auto my-20";
  const defaultClasses = "w-4xl h-auto object-cover px-4";
  const fullWidthClasses = "h-96 w-full object-cover";

  return (
    <picture>
      {image.kind === "asset" ? (
        <img
          src={src}
          srcSet={srcSet}
          className={[
            baseClasses,
            variant === "full-width" ? fullWidthClasses : defaultClasses,
          ].join(" ")}
          alt={alt}
          width={width}
          height={height}
        />
      ) : (
        <OptimizedImage
          imageId={image.imageId}
          alt={alt}
          width={variant === "full-width" ? 1920 : 1080}
          height={variant === "full-width" ? 768 : 720}
          sizes={
            variant === "full-width"
              ? "(min-width: 1024px) 100vw, 100vw"
              : "(min-width: 1024px) 1080px, 100vw"
          }
          className={[
            baseClasses,
            variant === "full-width" ? fullWidthClasses : defaultClasses,
          ].join(" ")}
        />
      )}
    </picture>
  );
}
