import { generateSrcSet } from "../utils";

import type { ImageBlockType } from "./model";

type ImageBlockViewProps = React.ComponentPropsWithoutRef<"picture"> & {
  blockData: ImageBlockType;
};

export function ImageBlockView({ blockData, ...rest }: ImageBlockViewProps) {
  const { data } = blockData;
  const { image, variant } = data;
  const { src, alt, width, height } = image;
  const srcSet = generateSrcSet(src, [432, 648, 864, 1080]);

  const baseClasses = "mx-auto my-20";
  const defaultClasses = "w-4xl h-auto object-cover px-4";
  const fullWidthClasses = "h-96 w-full object-cover";

  return (
    <picture>
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
    </picture>
  );
}
