import { describe, expect, it } from "vitest";

import { describeCompletedRequest } from "./request-log.server";

const completed = {
  method: "GET",
  pathname: "/dinners",
  pattern: "dinners",
  statusCode: 200,
  failed: false,
  shellMs: 12,
};

describe("describeCompletedRequest", () => {
  it("excludes the healthcheck and the HEAD it makes on itself", () => {
    expect(
      describeCompletedRequest({
        ...completed,
        pathname: "/healthcheck",
        pattern: "healthcheck",
      }),
    ).toBeNull();
    expect(
      describeCompletedRequest({
        ...completed,
        method: "HEAD",
        pathname: "/",
        pattern: "/",
      }),
    ).toBeNull();
  });

  it("keeps an ordinary request for the site root", () => {
    expect(
      describeCompletedRequest({ ...completed, pathname: "/", pattern: "/" }),
    ).toEqual({
      level: "info",
      bindings: { pattern: "/", statusCode: 200, shellMs: 12 },
    });
  });

  it("tags data requests instead of filtering them", () => {
    expect(
      describeCompletedRequest({ ...completed, pathname: "/dinners.data" }),
    ).toEqual({
      level: "debug",
      bindings: {
        pattern: "dinners",
        statusCode: 200,
        shellMs: 12,
        isDataRequest: true,
      },
    });
  });

  it("logs the image route at debug and its 404s at warn", () => {
    const file = {
      ...completed,
      pathname: "/file/cm5abc",
      pattern: "file/:fileId",
    };

    expect(describeCompletedRequest(file)?.level).toBe("debug");
    expect(describeCompletedRequest({ ...file, statusCode: 404 })?.level).toBe(
      "warn",
    );
  });

  it("raises the level of the one line rather than adding a second", () => {
    expect(describeCompletedRequest({ ...completed, failed: true })).toEqual({
      level: "error",
      bindings: { pattern: "dinners", statusCode: 200, shellMs: 12 },
    });
    expect(
      describeCompletedRequest({ ...completed, statusCode: 500 })?.level,
    ).toBe("error");
    expect(
      describeCompletedRequest({ ...completed, statusCode: 403 })?.level,
    ).toBe("warn");
  });

  it("logs an empty pattern for a request that matched no route", () => {
    expect(
      describeCompletedRequest({
        ...completed,
        pathname: "/whatever",
        pattern: undefined,
        statusCode: 404,
      }),
    ).toEqual({
      level: "warn",
      bindings: { pattern: "", statusCode: 404, shellMs: 12 },
    });
  });
});
