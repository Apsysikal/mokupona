import { OptimizedImage } from "~/components/optimized-image";
import type { ViewProps } from "./model";

export function ImageBlockView({ data, ...props }: ViewProps) {
  const { image, variant } = data;

  const baseClasses = "mx-auto my-20";
  const defaultClasses = "w-4xl h-auto object-cover px-4";
  const fullWidthClasses = "h-96 w-full object-cover";

  return (
    <picture {...props}>
      <OptimizedImage
        imageId={image.imageId}
        alt={image.alt}
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
    </picture>
  );
}
