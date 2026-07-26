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
