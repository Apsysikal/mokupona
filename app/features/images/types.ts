export interface StoredImage {
  storageKey: string;
  version?: number;
  width?: number;
  height?: number;
  blurDataUrl?: string;
}

export interface ImageStorageProvider {
  store(file: File, opts: { folder: string }): Promise<StoredImage>;
  destroy(storageKey: string): Promise<void>;
}
