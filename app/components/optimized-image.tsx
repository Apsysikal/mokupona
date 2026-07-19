import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";
import {
  getImageUrl,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageDisplaySource,
  type ImageFit,
} from "~/shared/image";
import { useImageConfig } from "~/shared/root-data";

type ImageInputProps = {
  image: ImageDisplaySource;
  width: number;
  height: number;
  fit?: ImageFit;
};

type ImageProps = Omit<ComponentProps<"img">, "width" | "height" | "src"> &
  ImageInputProps;

/**
 * Provider-served image with a width-descriptor `srcSet` (Cloudinary variant
 * URLs, or the `/file` route under the local provider) and a blur-up loading
 * experience (design §3.3): the container reserves the aspect ratio (zero
 * CLS), the stored base64 placeholder renders instantly under a
 * backdrop-blur that smooths its upscaled pixels, and the real image fades
 * in on load. Without a placeholder (local provider, not-yet-backfilled
 * rows) a neutral surface fills the frame instead.
 *
 * `className` sizes and shapes the frame; the layers fill it. Pass `sizes`
 * whenever the image renders narrower than the viewport — without it
 * browsers assume roughly `100vw` and pick needlessly large candidates.
 */
export function OptimizedImage({
  image,
  width,
  height,
  fit = "cover",
  className,
  style,
  alt,
  ...props
}: ImageProps) {
  const config = useImageConfig();
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // a cached image can be complete before hydration — its load event never
  // fires, so the fade must be triggered from here on mount
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  const aspect = width / height;

  const srcSet = RESPONSIVE_IMAGE_WIDTHS.map((w) => {
    // keep derived heights integer so URL variants stay cache-friendly
    const h = Math.round(w / aspect);
    return `${getImageUrl(image, config, { width: w, height: h, fit })} ${w}w`;
  }).join(", ");

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      // the intrinsic ratio wins when known; consumers that fix both
      // dimensions via className are unaffected
      style={{
        aspectRatio:
          image.width && image.height
            ? `${image.width} / ${image.height}`
            : `${width} / ${height}`,
        ...style,
      }}
    >
      {image.blurDataUrl ? (
        <>
          {/* one heavily blurred placeholder fits every crop */}
          <img
            src={image.blurDataUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 backdrop-blur-2xl" />
        </>
      ) : (
        <div aria-hidden className="bg-primary/10 absolute inset-0" />
      )}
      <img
        ref={imgRef}
        srcSet={srcSet}
        src={getImageUrl(image, config, { width, height, fit })}
        width={width}
        height={height}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        {...props}
      />
    </div>
  );
}
