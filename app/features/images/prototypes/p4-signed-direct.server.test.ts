import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it } from "vitest";

import {
  createDirectUploadTicket,
  directOrUploadedImageSchema,
  verifyDirectUpload,
} from "./p4-signed-direct.server";

// The real signing helper runs here on purpose: these tests are about whether
// a forged descriptor can get past the server, so mocking the crypto would
// test nothing.
const env = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  CLOUDINARY_FOLDER_PREFIX: "test",
} as NodeJS.ProcessEnv;

function signedDescriptor(overrides: Record<string, unknown> = {}) {
  const public_id = "abc123";
  const version = 42;

  return {
    public_id,
    version,
    signature: cloudinary.utils.api_sign_request(
      { public_id, version },
      "secret",
    ),
    width: 1200,
    height: 800,
    bytes: 512 * 1024,
    format: "png",
    resource_type: "image" as const,
    asset_folder: "test/dinners",
    ...overrides,
  };
}

describe("createDirectUploadTicket", () => {
  it("signs only the params Cloudinary should enforce", () => {
    const ticket = createDirectUploadTicket("dinners", 1_700_000_000, env);

    expect(ticket).toMatchObject({
      uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
      apiKey: "key",
      timestamp: 1_700_000_000,
      assetFolder: "test/dinners",
    });
    expect(ticket.signature).toBe(
      cloudinary.utils.api_sign_request(
        { timestamp: 1_700_000_000, asset_folder: "test/dinners" },
        "secret",
      ),
    );
  });

  it("refuses to mint a ticket without a folder prefix", () => {
    expect(() =>
      createDirectUploadTicket("dinners", 1, {
        ...env,
        CLOUDINARY_FOLDER_PREFIX: undefined,
      }),
    ).toThrow();
  });
});

describe("verifyDirectUpload", () => {
  it("accepts a descriptor Cloudinary actually signed", () => {
    const result = verifyDirectUpload(signedDescriptor(), "dinners", env);

    expect(result).toEqual({
      valid: true,
      stored: {
        storageKey: "abc123",
        version: 42,
        width: 1200,
        height: 800,
      },
    });
  });

  it("rejects a forged signature", () => {
    const result = verifyDirectUpload(
      signedDescriptor({ signature: "not-a-real-signature" }),
      "dinners",
      env,
    );

    expect(result).toEqual({
      valid: false,
      error: "Upload could not be verified",
    });
  });

  it("rejects a descriptor whose public_id was swapped after signing", () => {
    const result = verifyDirectUpload(
      signedDescriptor({ public_id: "someone-elses-asset" }),
      "dinners",
      env,
    );

    expect(result).toMatchObject({ valid: false });
  });

  it("rejects a correctly signed asset from outside this app's folder", () => {
    const result = verifyDirectUpload(
      signedDescriptor({ asset_folder: "other-tenant/dinners" }),
      "dinners",
      env,
    );

    expect(result).toMatchObject({ valid: false });
  });

  it("still enforces the server's own size and format policy", () => {
    expect(
      verifyDirectUpload(
        signedDescriptor({ bytes: 4 * 1024 * 1024 }),
        "dinners",
        env,
      ),
    ).toEqual({ valid: false, error: "File cannot be greater than 3MB" });

    expect(
      verifyDirectUpload(signedDescriptor({ format: "gif" }), "dinners", env),
    ).toEqual({
      valid: false,
      error: "File must be a JPEG, PNG or WebP image",
    });
  });
});

describe("directOrUploadedImageSchema", () => {
  const schema = directOrUploadedImageSchema("dinners", env);

  it("accepts the enhanced path's verified descriptor", () => {
    const result = schema.safeParse(JSON.stringify(signedDescriptor()));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      kind: "direct",
      stored: {
        storageKey: "abc123",
        version: 42,
        width: 1200,
        height: 800,
      },
    });
  });

  it("accepts the no-JS path's plain file upload", () => {
    const file = new File([new Uint8Array(1024)], "cover.png", {
      type: "image/png",
    });

    const result = schema.safeParse(file);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ kind: "file" });
  });

  it("rejects a descriptor that is not valid JSON", () => {
    expect(schema.safeParse("{ not json").success).toBe(false);
  });

  it("rejects a hand-written descriptor with no signature", () => {
    const forged = JSON.stringify({
      public_id: "abc123",
      version: 42,
      signature: "made-up",
      width: 10,
      height: 10,
      bytes: 10,
      format: "png",
      resource_type: "image",
      asset_folder: "test/dinners",
    });

    expect(schema.safeParse(forged).success).toBe(false);
  });
});
