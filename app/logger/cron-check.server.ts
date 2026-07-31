import { readFileSync, readdirSync } from "node:fs";

export function isCronRunning(): boolean | undefined {
  let entries: string[];
  try {
    entries = readdirSync("/proc");
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (readFileSync(`/proc/${entry}/comm`, "utf8").trim() === "cron") {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}
