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

  // "full-width" spans the editorial column, not the viewport (design §1)
  const imageClasses =
    variant === "full-width"
      ? "h-[200px] w-full rounded-xl object-cover md:h-[360px]"
      : "h-auto w-full object-cover";

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 md:px-14">
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
