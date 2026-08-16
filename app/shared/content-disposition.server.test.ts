import { describe, expect, it } from "vitest";

import { contentDispositionAttachment } from "./content-disposition.server";

describe("contentDispositionAttachment", () => {
  it("carries umlauts in filename* and keeps the fallback ASCII-safe", () => {
    const header = contentDispositionAttachment("Grüße-signups.csv");

    expect(header).toBe(
      `attachment; filename="Gr-e-signups.csv"; filename*=UTF-8''Gr%C3%BC%C3%9Fe-signups.csv`,
    );
  });

  it("percent-encodes characters outside RFC 5987's attr-char set", () => {
    const header = contentDispositionAttachment(`Summer 'Special' (v2).csv`);

    expect(header).toContain(
      `filename*=UTF-8''Summer%20%27Special%27%20%28v2%29.csv`,
    );
    expect(header).toContain(`filename="Summer-Special-v2-.csv"`);
  });

  it("leaves a plain ASCII name readable in both parameters", () => {
    const header = contentDispositionAttachment("dinner-signups.csv");

    expect(header).toBe(
      `attachment; filename="dinner-signups.csv"; filename*=UTF-8''dinner-signups.csv`,
    );
  });
});
