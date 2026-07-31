import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  readdirSync: vi.fn<(dir: string) => string[]>(),
  readFileSync: vi.fn<(file: string, encoding: string) => string>(),
}));

vi.mock("node:fs", () => ({ ...fs, default: fs }));

const { isCronRunning } = await import("./cron-check.server");

function procWith(processes: Record<string, string>) {
  fs.readdirSync.mockReturnValue([...Object.keys(processes), "self", "uptime"]);
  fs.readFileSync.mockImplementation((file) => {
    const pid = file.replace(/^\/proc\/(\d+)\/comm$/, "$1");
    const comm = processes[pid];
    if (comm === undefined) throw new Error("ENOENT");
    return `${comm}\n`;
  });
}

describe("isCronRunning", () => {
  beforeEach(() => {
    fs.readdirSync.mockReset();
    fs.readFileSync.mockReset();
  });

  it("finds the cron daemon among the running processes", () => {
    procWith({ "1": "npm", "14": "node", "22": "cron" });

    expect(isCronRunning()).toBe(true);
  });

  it("reports cron as absent when no process is named cron", () => {
    procWith({ "1": "npm", "14": "node" });

    expect(isCronRunning()).toBe(false);
  });

  it("ignores a process that exits while /proc is being walked", () => {
    fs.readdirSync.mockReturnValue(["7", "22"]);
    fs.readFileSync.mockImplementation((file) => {
      if (file === "/proc/7/comm") throw new Error("ESRCH");
      return "cron\n";
    });

    expect(isCronRunning()).toBe(true);
  });

  it("returns undefined rather than a false alarm where there is no /proc", () => {
    fs.readdirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(isCronRunning()).toBeUndefined();
  });
});
