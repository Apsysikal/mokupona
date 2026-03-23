export function generateSrcSet(src: string, widths: number[]) {
  const extIndex = src.lastIndexOf(".");
  const basename = src.slice(0, extIndex);
  const extension = ".webp";

  return widths
    .map((width) => `${basename}-${width}${extension} ${width}w`)
    .join(", ");
}
