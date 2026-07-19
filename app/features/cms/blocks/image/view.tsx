import { generateSrcSet } from "../utils";

import type { ImageBlockType } from "./model";

import { RESPONSIVE_IMAGE_WIDTHS } from "~/shared/image";

type ImageBlockViewProps = React.ComponentPropsWithoutRef<"picture"> & {
  blockData: ImageBlockType;
};

export function ImageBlockView({ blockData, ...rest }: ImageBlockViewProps) {
  const { data } = blockData;
  const { image, variant } = data;
  const { src, alt, width, height } = image;
  const srcSet = generateSrcSet(src, RESPONSIVE_IMAGE_WIDTHS);

  // "full-width" spans the editorial column, not the viewport (design §1)
  const imageClasses =
    variant === "full-width"
      ? "h-64 w-full rounded-2xl object-cover md:h-96"
      : "h-auto w-full object-cover";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 md:px-10">
      <picture {...rest}>
        <img
          src={src}
          srcSet={srcSet}
          className={imageClasses}
          alt={alt ?? ""}
          width={width}
          height={height}
        />
      </picture>
    </div>
  );
}
