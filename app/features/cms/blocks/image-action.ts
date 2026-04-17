import { z } from "zod/v4";

export type ManagedImage =
  | { kind: "asset"; src: string; alt?: string }
  | {
      kind: "uploaded";
      imageId: string;
      fallbackAssetSrc: string;
      decorative: boolean;
      alt: string | undefined;
    };

export type ImageSlotFormShape = {
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility: "" | "decorative" | "descriptive";
  imageAlt: string;
};

export type ImageSlotFormValue = {
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility?: "decorative" | "descriptive";
  imageAlt?: string;
};

export function imageSlotSchema() {
  return z.object({
    imageAction: z.enum(["keep", "replace", "remove"]).default("keep"),
    imageAccessibility: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["decorative", "descriptive"]).optional(),
    ),
    imageAlt: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
  });
}

export function refineImageSlot(
  ctx: z.RefinementCtx,
  value: ImageSlotFormValue,
  prefix?: string,
): void {
  if (value.imageAction !== "replace") return;

  if (!value.imageAccessibility) {
    ctx.addIssue({
      code: "custom",
      path: prefix ? [prefix, "imageAccessibility"] : ["imageAccessibility"],
      message: "Image accessibility choice is required",
    });
  }

  if (
    value.imageAccessibility === "descriptive" &&
    (!value.imageAlt || value.imageAlt.length === 0)
  ) {
    ctx.addIssue({
      code: "custom",
      path: prefix ? [prefix, "imageAlt"] : ["imageAlt"],
      message: "Alt text is required for descriptive images",
    });
  }
}

export function hydrateImageSlot(current: ManagedImage): ImageSlotFormShape {
  const imageAccessibility =
    current.kind === "uploaded"
      ? current.decorative
        ? "decorative"
        : "descriptive"
      : "";
  const imageAlt =
    current.kind === "uploaded" && imageAccessibility === "descriptive"
      ? (current.alt ?? "")
      : "";

  return {
    imageAction: "keep",
    imageAccessibility,
    imageAlt,
  };
}

export function applyImageSlot(
  current: ManagedImage,
  value: ImageSlotFormValue,
  options: { uploadedImageId?: string },
): ManagedImage {
  if (value.imageAction === "replace" && options.uploadedImageId) {
    return {
      kind: "uploaded",
      imageId: options.uploadedImageId,
      fallbackAssetSrc:
        current.kind === "asset" ? current.src : current.fallbackAssetSrc,
      decorative: value.imageAccessibility !== "descriptive",
      alt:
        value.imageAccessibility === "descriptive" ? value.imageAlt : undefined,
    };
  }

  if (value.imageAction === "remove" && current.kind === "uploaded") {
    return { kind: "asset", src: current.fallbackAssetSrc };
  }

  if (
    value.imageAction === "keep" &&
    current.kind === "uploaded" &&
    value.imageAccessibility
  ) {
    return {
      ...current,
      decorative: value.imageAccessibility !== "descriptive",
      alt:
        value.imageAccessibility === "descriptive" ? value.imageAlt : undefined,
    };
  }

  return current;
}
