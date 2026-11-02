import { describe, expect, it } from "vitest";
import { featherMask, matchTone } from "@/lib/engine/composite";

describe("matchTone", () => {
  it("scales a uniformly brightened crop back to the base's tone", () => {
    const W = 40, H = 40, rect = { left: 10, top: 10, width: 20, height: 20 };
    const base = new Uint8Array(W * H * 4).fill(200);
    const head = new Uint8Array(rect.width * rect.height * 4);
    for (let i = 0; i < head.length; i += 4) { head[i] = 210; head[i + 1] = 210; head[i + 2] = 215; head[i + 3] = 255; }
    matchTone(base, W, head, rect, featherMask(rect.width, rect.height));
    expect(Math.abs(head[0] - 200)).toBeLessThanOrEqual(1);
    expect(Math.abs(head[2] - 200)).toBeLessThanOrEqual(1);
  });
});

describe("matchTone cap", () => {
  it("never shifts a channel by more than 10%", () => {
    const W = 40, H = 40, rect = { left: 10, top: 10, width: 20, height: 20 };
    const base = new Uint8Array(W * H * 4).fill(100);
    const head = new Uint8Array(rect.width * rect.height * 4).fill(200);
    matchTone(base, W, head, rect, featherMask(rect.width, rect.height));
    expect(head[0]).toBe(180);
  });
});
