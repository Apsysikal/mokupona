// The provider seam for image storage (design §3.1) — deliberately minimal.
// Mirrors the mail layer: the app talks to this interface, never to a vendor
// SDK; `app/features/images/providers/` is the only place an SDK may live.

/** What a provider hands back after persisting an upload. */
export interface StoredImage {
  /** Cloudinary public_id, or the local provider's file key. */
  storageKey: string;
  /** Cloudinary asset version — makes delivery URLs immutable. */
  version?: number;
  /** Intrinsic pixels, from the upload response (cloudinary only). */
  width?: number;
  height?: number;
  /** Base64 blur-up placeholder, generated at store time (cloudinary only). */
  blurDataUrl?: string;
}

export interface ImageStorageProvider {
  store(file: File, opts: { folder: string }): Promise<StoredImage>;
  destroy(storageKey: string): Promise<void>;
}
