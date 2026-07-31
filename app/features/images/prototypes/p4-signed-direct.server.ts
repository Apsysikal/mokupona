import { v2 as cloudinary } from "cloudinary";
import invariant from "tiny-invariant";
import { z } from "zod";

import type { StoredImage } from "../types";

import {
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  MAX_IMAGE_BYTES,
  VALID_IMAGE_TYPES,
  imageFileSchema,
} from "~/shared/image";

/**
 * PROTOTYPE 4 — signed direct-to-Cloudinary upload, with the server upload
 * kept as the progressive-enhancement fallback.
 *
 * The other three prototypes all move bytes *through* this app, so peak memory
 * is bounded by `maxFileSize` no matter how clever the handoff is. This one
 * removes the payload from the app server entirely: the browser POSTs the file
 * straight to Cloudinary using a short-lived signature minted here, then the
 * ordinary form submit carries only the resulting identifiers.
 *
 * Progressive enhancement is the whole design constraint. Without JS the file
 * input posts as multipart exactly as it does today and the server-side path
 * runs; with JS the script uploads first and replaces the file input's value
 * with a hidden descriptor field. The schema below accepts *either* shape, so
 * one Conform form and one action serve both.
 *
 * Trust is the thing to get right: a hidden field is client-controlled, so a
 * descriptor is only believed if Cloudinary's own response signature verifies
 * against our API secret and the asset lands under this app's folder prefix.
 */

const DIRECT_UPLOAD_TTL_SECONDS = 10 * 60;

function requireConfig(env: NodeJS.ProcessEnv) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const folderPrefix = env.CLOUDINARY_FOLDER_PREFIX;

  invariant(
    cloudName && apiKey && apiSecret && folderPrefix,
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_FOLDER_PREFIX must be set for direct uploads",
  );

  return { cloudName, apiKey, apiSecret, folderPrefix };
}

export interface DirectUploadTicket {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  assetFolder: string;
}

/**
 * Mint the credentials the browser needs for one upload. Signed params are the
 * ones Cloudinary will enforce; the client cannot widen them without breaking
 * the signature. Handed to the form via its loader.
 */
export function createDirectUploadTicket(
  folder: string,
  timestamp: number,
  env: NodeJS.ProcessEnv = process.env,
): DirectUploadTicket {
  const { cloudName, apiKey, apiSecret, folderPrefix } = requireConfig(env);
  const assetFolder = `${folderPrefix}/${folder}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, asset_folder: assetFolder },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    apiKey,
    timestamp,
    signature,
    assetFolder,
  };
}

/**
 * The shape the enhanced client writes back into the form as a hidden field.
 * Every value here is attacker-controlled until `verifyDirectUpload` says
 * otherwise.
 */
export const directUploadDescriptorSchema = z.object({
  public_id: z.string().min(1),
  version: z.number().int().positive(),
  signature: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.string().min(1),
  resource_type: z.literal("image"),
  asset_folder: z.string().min(1),
});

export type DirectUploadDescriptor = z.infer<
  typeof directUploadDescriptorSchema
>;

export type DirectUploadVerification =
  { valid: true; stored: StoredImage } | { valid: false; error: string };

const FORMAT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Re-derive Cloudinary's upload signature and re-apply every policy limit the
 * server would have enforced had the bytes come through it.
 *
 * `api_sign_request({ public_id, version })` is the documented way to
 * authenticate an upload response: only a party holding the API secret can
 * produce it, so a forged or replayed descriptor fails here.
 */
export function verifyDirectUpload(
  descriptor: DirectUploadDescriptor,
  folder: string,
  env: NodeJS.ProcessEnv = process.env,
): DirectUploadVerification {
  const { apiSecret, folderPrefix } = requireConfig(env);

  const expected = cloudinary.utils.api_sign_request(
    { public_id: descriptor.public_id, version: descriptor.version },
    apiSecret,
  );

  if (expected !== descriptor.signature) {
    return { valid: false, error: "Upload could not be verified" };
  }

  // a valid signature still does not mean the asset belongs to this app
  if (descriptor.asset_folder !== `${folderPrefix}/${folder}`) {
    return { valid: false, error: "Upload could not be verified" };
  }

  const mimeType = FORMAT_TO_MIME[descriptor.format.toLowerCase()];
  if (!mimeType || !VALID_IMAGE_TYPES.includes(mimeType)) {
    return { valid: false, error: IMAGE_TYPE_ERROR };
  }

  // Cloudinary's upload preset should cap this too, but the server owns the
  // policy — never let the client's chosen endpoint be the only gate
  if (descriptor.bytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: IMAGE_SIZE_ERROR };
  }

  return {
    valid: true,
    stored: {
      storageKey: descriptor.public_id,
      version: descriptor.version,
      width: descriptor.width,
      height: descriptor.height,
    },
  };
}

/**
 * The dual-path field schema: a hidden verified descriptor when JS ran, an
 * ordinary `File` when it did not. Both branches resolve to the same thing the
 * action needs, so `onSuccess` does not care which path produced it.
 *
 * Conform sees one field name and reports errors on it either way, which is
 * what keeps the no-JS and enhanced forms interchangeable.
 */
export function directOrUploadedImageSchema(
  folder: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const directBranch = z.string().transform((raw, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "Upload could not be verified" });
      return z.NEVER;
    }

    const descriptor = directUploadDescriptorSchema.safeParse(parsed);
    if (!descriptor.success) {
      ctx.addIssue({ code: "custom", message: "Upload could not be verified" });
      return z.NEVER;
    }

    const verification = verifyDirectUpload(descriptor.data, folder, env);
    if (!verification.valid) {
      ctx.addIssue({ code: "custom", message: verification.error });
      return z.NEVER;
    }

    return { kind: "direct" as const, stored: verification.stored };
  });

  const uploadBranch = imageFileSchema().transform((file) => ({
    kind: "file" as const,
    file,
  }));

  return z.union([directBranch, uploadBranch]);
}
