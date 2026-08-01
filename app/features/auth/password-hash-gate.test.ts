// @vitest-environment node
// (happy-dom swaps the crypto primitives better-auth derives against)

import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

import {
  gatedHashPassword,
  gatedVerifyPassword,
  withSlot,
} from "./password-hash-gate.server";

describe("withSlot", () => {
  it("runs one task at a time", async () => {
    let active = 0;
    let peak = 0;
    const task = async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    };

    await Promise.all(Array.from({ length: 6 }, () => withSlot(task)));

    expect(peak).toBe(1);
  });

  it("preserves submission order", async () => {
    const order: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map((i) =>
        withSlot(async () => {
          order.push(i);
        }),
      ),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("still admits one at a time when callers arrive while others run", async () => {
    let active = 0;
    let peak = 0;
    const task = async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
    };

    const running = [withSlot(task), withSlot(task)];
    // arrivals interleaved with completions, not all queued up front
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      running.push(withSlot(task));
    }
    await Promise.all(running);

    expect(peak).toBe(1);
  });

  it("hands the slot on when a task rejects", async () => {
    const boom = withSlot(() => Promise.reject(new Error("boom")));
    // queued behind the rejecting task: a leaked slot would hang this forever
    const after = withSlot(() => Promise.resolve("ran"));

    await expect(boom).rejects.toThrow("boom");
    await expect(after).resolves.toBe("ran");
  });
});

describe("gated password derivation", () => {
  it("round-trips a password", async () => {
    const hash = await gatedHashPassword("correct horse battery staple");

    expect(
      await gatedVerifyPassword({
        hash,
        password: "correct horse battery staple",
      }),
    ).toBe(true);
    expect(await gatedVerifyPassword({ hash, password: "wrong" })).toBe(false);
  });

  it("leaves better-auth's derivation alone, so stored hashes keep verifying", async () => {
    // hashed through better-auth directly, verified through the gate: this is
    // every hash already in the database. Changing scrypt's parameters here
    // would lock every existing user out, so the gate must stay transparent.
    const existing = await hashPassword("mokupona");

    expect(existing).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(
      await gatedVerifyPassword({ hash: existing, password: "mokupona" }),
    ).toBe(true);
  });
});
