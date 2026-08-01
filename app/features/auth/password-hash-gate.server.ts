import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * Serialize better-auth's password derivations.
 *
 * better-auth hashes with scrypt at N=16384, r=16 (`@better-auth/utils`), which
 * is a deliberate 128 * N * r = **32 MiB** working set per call, allocated
 * natively on a libuv thread rather than on the V8 heap. The thread pool holds
 * four threads by default, so four sign-ins that overlap ask the machine for
 * ~130 MB of transient buffers on top of the app's own resident set.
 *
 * The Fly machine does not have that much headroom, so the kernel makes room by
 * evicting the app's own pages to swap. scrypt then walks its arena in random
 * order — that is the whole point of the algorithm — so every evicted page
 * comes back as a major fault, and a sign-in that costs ~0.2 s with headroom
 * takes seconds without it. The CPU is never busy; it is waiting on swap. Worse,
 * the pages evicted to make room were the app's, so the *next* request pays to
 * fault them back in.
 *
 * Gating the derivations to one at a time bounds that transient cost at a single
 * 32 MiB arena. It gives up no real throughput: the machine has one shared vCPU,
 * so concurrent scrypts were never computing in parallel — only competing for
 * memory. Hash parameters are untouched, so existing hashes keep verifying.
 */

// One in flight. Raise only alongside the machine's memory: each additional slot
// is another concurrent 32 MiB arena.
const SLOTS = 1;

let active = 0;
const waiting: Array<() => void> = [];

/** Exported for the unit test — the gate is the part worth pinning. */
export async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= SLOTS) {
    // woken by the release below, which hands its slot straight over rather
    // than freeing it — so the count already accounts for this task
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    active++;
  }

  try {
    return await task();
  } finally {
    // a rejected derivation must still pass its slot on, hence the `finally`.
    // Handing the slot straight to the next waiter rather than releasing it and
    // letting them re-take it keeps the count correct without depending on when
    // a woken waiter resumes relative to a fresh caller.
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export const gatedHashPassword = (password: string) =>
  withSlot(() => hashPassword(password));

export const gatedVerifyPassword = (data: { hash: string; password: string }) =>
  withSlot(() => verifyPassword(data));
