import { Writable } from "node:stream";

import pino from "pino";
import { beforeEach, describe, expect, it } from "vitest";

import { hashIp } from "./hash-ip.server";
import { redact } from "./redact.server";

let records: Record<string, unknown>[] = [];

function createLogger() {
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      records.push(JSON.parse(chunk.toString()));
      callback();
    },
  });

  return pino(
    {
      level: "debug",
      redact,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label: string) => ({ level: label }) },
      serializers: { error: pino.stdSerializers.err },
    },
    sink,
  );
}

beforeEach(() => {
  records = [];
});

describe("redact", () => {
  it("masks an email and hashes an ip", () => {
    createLogger().info(
      { email: "alice@example.com", ip: "203.0.113.9" },
      "signed in",
    );

    expect(records[0]).toMatchObject({
      email: "a***@example.com",
      ip: hashIp("203.0.113.9"),
      msg: "signed in",
    });
    expect(JSON.stringify(records[0])).not.toContain("alice");
    expect(JSON.stringify(records[0])).not.toContain("203.0.113.9");
  });

  it("masks an email and hashes an ip one level down", () => {
    createLogger().info(
      { user: { email: "bob@example.com", ip: "198.51.100.1" } },
      "nested",
    );

    expect(records[0].user).toEqual({
      email: "b***@example.com",
      ip: hashIp("198.51.100.1"),
    });
  });

  it("replaces every other declared path with a fixed marker", () => {
    createLogger().info({ password: "hunter2" }, "credentials");

    expect(records[0].password).toBe("[redacted]");
  });

  it("replaces a non-string value with the fixed marker", () => {
    createLogger().info({ ip: null }, "no address");

    expect(records[0].ip).toBe("[redacted]");
  });

  it("hashes the same address to the same value across records", () => {
    const logger = createLogger();
    logger.info({ ip: "203.0.113.9" }, "first");
    logger.info({ ip: "203.0.113.9" }, "second");
    logger.info({ ip: "203.0.113.10" }, "third");

    expect(records[0].ip).toBe(records[1].ip);
    expect(records[2].ip).not.toBe(records[0].ip);
  });

  it("redacts records logged through a child logger", () => {
    createLogger()
      .child({ requestId: "req-1" })
      .info({ email: "carol@example.com", ip: "192.0.2.7" }, "through child");

    expect(records[0]).toMatchObject({
      requestId: "req-1",
      email: "c***@example.com",
      ip: hashIp("192.0.2.7"),
    });
  });

  it("redacts child bindings themselves", () => {
    createLogger()
      .child({ email: "dave@example.com", ip: "192.0.2.8" })
      .info("child bindings");

    expect(records[0]).toMatchObject({
      email: "d***@example.com",
      ip: hashIp("192.0.2.8"),
    });
  });
});
