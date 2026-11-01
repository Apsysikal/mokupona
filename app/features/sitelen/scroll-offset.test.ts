import { rowOffset } from "./scroll-offset";

describe("rowOffset", () => {
  it("stays within one copy to the left of the band", () => {
    for (const y of [0, 1, 250, 999, 12345]) {
      for (const dir of [-1, 1] as const) {
        const x = rowOffset(y, dir, 800, 0.6);
        expect(x).toBeGreaterThanOrEqual(-800);
        expect(x).toBeLessThan(0);
      }
    }
  });

  it("slides left for -1 and right for +1 as the page scrolls down", () => {
    const left0 = rowOffset(0, -1, 1000, 1, 500);
    const left1 = rowOffset(10, -1, 1000, 1, 500);
    expect(left1 - left0).toBe(-10);

    const right0 = rowOffset(0, 1, 1000, 1, 500);
    const right1 = rowOffset(10, 1, 1000, 1, 500);
    expect(right1 - right0).toBe(10);
  });

  it("returns to the same place when scrolled back up", () => {
    expect(rowOffset(300, -1, 900, 0.5)).toBe(rowOffset(300, -1, 900, 0.5));
    expect(rowOffset(0, 1, 900, 0.5, 120)).toBe(
      rowOffset(1800 / 0.5, 1, 900, 0.5, 120),
    );
  });

  it("does nothing before the row has a width", () => {
    expect(rowOffset(400, 1, 0, 1)).toBe(0);
  });
});
