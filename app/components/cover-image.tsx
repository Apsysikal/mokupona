import { OptimizedImage } from "./optimized-image";

import { cn } from "~/lib/utils";

// Cover slot for entities whose image is optional (Image.eventId is the FK,
// so a cover can disappear without taking its owner): renders the image when
// one exists, otherwise a quiet CSS "plate" artwork filling the same frame —
// the events' cousin of the board members' InitialsAvatar.
export function CoverImage({
  imageId,
  alt,
  width,
  height,
  className,
}: {
  imageId: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  if (imageId) {
    return (
      <OptimizedImage
        imageId={imageId}
        alt={alt}
        width={width}
        height={height}
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
        "bg-primary/10 flex items-center justify-center",
        className,
      )}
    >
      <span className="border-primary/40 flex aspect-square w-1/4 min-w-10 items-center justify-center rounded-full border-2">
        <span className="border-primary/25 aspect-square w-2/3 rounded-full border" />
      </span>
    </div>
  );
}
