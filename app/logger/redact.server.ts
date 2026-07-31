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
      case "email": {
        const at = value.lastIndexOf("@");
        return at < 1 ? "[redacted]" : `${value[0]}***${value.slice(at)}`;
      }
      case "ip":
        return hashIp(value);
      default:
        return "[redacted]";
    }
  },
};
