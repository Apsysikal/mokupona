import { describe, expect, it } from "vitest";

import { redactDatabaseUrl } from "./redact-url.server";

describe("redactDatabaseUrl", () => {
  it("reports an unset variable as such", () => {
    expect(redactDatabaseUrl(undefined)).toBe("[unset]");
    expect(redactDatabaseUrl("")).toBe("[unset]");
  });

  it("keeps a sqlite path exactly as configured", () => {
    expect(redactDatabaseUrl("file:/data/sqlite.db")).toBe(
      "file:/data/sqlite.db",
    );
    expect(redactDatabaseUrl("file:./prisma/data.db")).toBe(
      "file:./prisma/data.db",
    );
  });

  it("drops query parameters and fragments", () => {
    expect(redactDatabaseUrl("file:/data/sqlite.db?connection_limit=1")).toBe(
      "file:/data/sqlite.db",
    );
  });

  it("masks credentials", () => {
    expect(redactDatabaseUrl("postgres://user:secret@host:5432/mokupona")).toBe(
      "postgres://redacted:redacted@host:5432/mokupona",
    );
  });

  it("leaves a host without credentials alone", () => {
    expect(redactDatabaseUrl("postgres://host:5432/mokupona")).toBe(
      "postgres://host:5432/mokupona",
    );
  });
});
