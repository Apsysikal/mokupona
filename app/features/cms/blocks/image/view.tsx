import type { ImageBlockType } from "./model";

import { OptimizedImage } from "~/components/optimized-image";

type ImageBlockViewProps = {
  blockData: ImageBlockType;
  className?: string;
};

export function ImageBlockView({ blockData, className }: ImageBlockViewProps) {
  const { data } = blockData;
  const { image, variant } = data;
  const { src, alt, width, height, blurDataUrl } = image;

  // "full-width" spans the editorial column, not the viewport (design §1)
  const imageClasses =
    variant === "full-width"
      ? "h-64 w-full rounded-2xl md:h-96"
      : "h-auto w-full";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 md:px-10">
      <OptimizedImage
        image={{ storageKey: src, blurDataUrl }}
        width={width ?? 1080}
        height={height ?? 382}
        alt={alt ?? ""}
        className={
          imageClasses ? `${imageClasses} ${className ?? ""}` : className
        }
      />
    </div>
  );
}
