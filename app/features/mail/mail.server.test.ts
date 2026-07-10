import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { latestMailPath } from "./capture.shared";
import { createMailProvider } from "./mail.server";
import { consoleProvider } from "./providers/console.server";

describe("createMailProvider", () => {
  it("defaults to the console provider", () => {
    expect(createMailProvider({})).toBe(consoleProvider);
    expect(createMailProvider({ MAIL_PROVIDER: "console" })).toBe(
      consoleProvider,
    );
  });

  it("fails fast on an unknown MAIL_PROVIDER", () => {
    expect(() => createMailProvider({ MAIL_PROVIDER: "sendgrid" })).toThrow(
      /Unknown MAIL_PROVIDER "sendgrid"/,
    );
  });

  it("fails fast when resend is selected without an API key", () => {
    expect(() => createMailProvider({ MAIL_PROVIDER: "resend" })).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it("creates a resend provider when the key is present", () => {
    expect(
      createMailProvider({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x" }),
    ).toHaveProperty("send");
  });
});

describe("capture provider", () => {
  it("writes each message as JSON, latest.json pointing at the newest", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mail-capture-"));
    const provider = createMailProvider({
      MAIL_PROVIDER: "capture",
      MAIL_CAPTURE_DIR: dir,
    });

    await provider.send({ to: "a@example.com", subject: "one", text: "1" });
    await provider.send({ to: "a@example.com", subject: "two", text: "2" });

    const latest = JSON.parse(
      await readFile(latestMailPath("a@example.com", dir), "utf8"),
    );
    expect(latest).toMatchObject({ subject: "two", text: "2" });
  });
});
