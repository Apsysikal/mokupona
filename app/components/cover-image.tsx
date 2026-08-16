import { OptimizedImage } from "./optimized-image";

import { cn } from "~/lib/utils";
import type { ImageDisplaySource } from "~/shared/image";

const COVER_IMAGE_WIDTH = 1080;
const COVER_IMAGE_HEIGHT = 720;

export function CoverImage({
  image,
  alt,
  className,
  sizes,
}: {
  image: ImageDisplaySource | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  if (image) {
    return (
      <OptimizedImage
        image={image}
        alt={alt}
        width={COVER_IMAGE_WIDTH}
        height={COVER_IMAGE_HEIGHT}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    <div
      aria-hidden={alt === "" || undefined}
      role={alt === "" ? undefined : "img"}
      aria-label={alt === "" ? undefined : alt}
      className={cn(
        "bg-primary/10 flex aspect-3/2 items-center justify-center",
        className,
      )}
    >
      <span className="border-primary/35 flex aspect-square w-1/4 min-w-10 items-center justify-center rounded-full border-2">
        <span className="border-primary/20 aspect-square w-2/3 rounded-full border" />
      </span>
    </div>
  );
}
