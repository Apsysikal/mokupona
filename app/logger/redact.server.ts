import { hashIp } from "./hash-ip.server";

export const redact = {
  paths: [
    "email",
    "*.email",
    "ip",
    "*.ip",
    "req.headers.authorization",
    "password",
  ],
  censor: (value: unknown, path: string[]) => {
    if (typeof value !== "string") return "[redacted]";
    switch (path[path.length - 1]) {
      case "email":
        return value.replace(/^(.).*(@.*)$/, "$1***$2");
      case "ip":
        return hashIp(value);
      default:
        return "[redacted]";
    }
  },
};
