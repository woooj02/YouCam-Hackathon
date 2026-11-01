import { describe, expect, it } from "vitest";
import { blendInto, DEFAULT_HEAD_BOX, featherAlpha, featherMask, headCropRect, upscaleSize } from "@/lib/engine/composite";
import { allStages, dependencies, lookImages, renderImpact, repairCost, stagesForLook } from "@/lib/engine/render";
import { applyOp } from "@/lib/engine/ops";
import { gatsbyProduction } from "@/lib/gatsby";
import { solve } from "@/lib/engine/solver";
import type { CompleteLook, Production } from "@/lib/engine/types";

function planned(completeLook?: CompleteLook): Production {
  const p = gatsbyProduction();
  p.completeLook = completeLook;
  p.plan = solve(p);
  return p;
}
const damageJacket = (p: Production) => applyOp(p, { type: "unavailable", itemId: "g-black-jacket" }).production;

describe("head composite geometry", () => {
  it("crops a square around the head box, inside the image", () => {
    const r = headCropRect(DEFAULT_HEAD_BOX, 728, 1104);
    expect(r.width).toBe(r.height);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left + r.width).toBeLessThanOrEqual(728);
    expect(r.top + r.height).toBeLessThanOrEqual(1104);
    // The whole head box sits inside the crop.
    expect(r.left).toBeLessThanOrEqual(DEFAULT_HEAD_BOX.x * 728);
    expect(r.left + r.width).toBeGreaterThanOrEqual((DEFAULT_HEAD_BOX.x + DEFAULT_HEAD_BOX.w) * 728);
    expect(r.top).toBeLessThanOrEqual(DEFAULT_HEAD_BOX.y * 1104);
    expect(upscaleSize(r)).toEqual({ width: 1024, height: 1024 });
  });

  it("clamps a head box at the image edge", () => {
    const r = headCropRect({ x: 0.9, y: 0, w: 0.2, h: 0.2 }, 500, 800);
    expect(r.left + r.width).toBeLessThanOrEqual(500);
    expect(r.top).toBe(0);
  });

  it("feathers from fully opaque at the face to transparent at the crop edge", () => {
    expect(featherAlpha(50, 46, 100, 100)).toBe(1);
    expect(featherAlpha(0, 0, 100, 100)).toBe(0);
    expect(featherAlpha(99, 99, 100, 100)).toBe(0);
    const ring = [60, 70, 80, 90].map((x) => featherAlpha(x, 46, 100, 100));
    for (let i = 1; i < ring.length; i++) expect(ring[i]).toBeLessThanOrEqual(ring[i - 1]);
    expect(ring.some((a) => a > 0 && a < 1)).toBe(true);
  });

  it("replaces the face and leaves the crop corners and the rest of the image untouched", () => {
    const W = 20, H = 20, rect = { left: 5, top: 5, width: 10, height: 10 };
    const base = new Uint8ClampedArray(W * H * 4).fill(10);
    const head = new Uint8ClampedArray(rect.width * rect.height * 4).fill(250);
    blendInto(base, W, head, rect, featherMask(rect.width, rect.height));
    const px = (x: number, y: number) => base[(y * W + x) * 4];
    expect(px(10, 9)).toBe(250);
    expect(px(5, 5)).toBe(10);
    expect(px(0, 0)).toBe(10);
    expect(px(19, 19)).toBe(10);
  });
});

describe("complete look in the render graph", () => {
  it("is off by default, so the existing showcases keep their 12 layers", () => {
    expect(allStages(planned())).toHaveLength(12);
  });

  it("composite from the photo: one image per look, and a jacket repair still re-renders one API layer", () => {
    const p = planned({ strategy: "composite", cropFrom: "photo" });
    const gatsby = stagesForLook(p, p.looks[0]);
    expect(gatsby.map((s) => s.stage)).toEqual(["base", "outer", "hair", "makeup", "look-hair", "look-makeup", "composite"]);
    const composite = gatsby.at(-1)!;
    expect(composite.units).toBe(0);
    expect(dependencies(composite)).toEqual([gatsby[5].key, gatsby[1].key]);
    expect(gatsby[4].crop).toBeDefined();
    expect(gatsby[4].parentKey).toBeUndefined();

    const next = damageJacket(p);
    const cost = repairCost(p, next);
    expect(cost).toEqual({ apiLayers: 18, changedApiLayers: 1, units: 2, fullCastUnits: 2 * 6 + 2 * 3 + 1 * 3 + 2 * 3 + 1 * 3, recomposited: 1 });
    expect(renderImpact(p, next).lookIds).toEqual(["l-gatsby"]);
  });

  it("direct: styling runs on the clothed render, so a jacket repair re-renders the styling too", () => {
    const p = planned({ strategy: "direct" });
    const gatsby = stagesForLook(p, p.looks[0]);
    expect(gatsby.map((s) => s.stage)).toEqual(["base", "outer", "hair", "makeup", "look-hair", "look-makeup"]);
    expect(gatsby[4].parentKey).toBe(gatsby[1].key);
    expect(gatsby[4].crop).toBeUndefined();
    const cost = repairCost(p, damageJacket(p));
    expect(cost.changedApiLayers).toBe(3);
    expect(cost.units).toBe(5);
    expect(cost.recomposited).toBe(0);
  });

  it("composite cropped from the clothed render depends on the costume", () => {
    const p = planned({ strategy: "composite", cropFrom: "clothed" });
    const cost = repairCost(p, damageJacket(p));
    expect(cost.changedApiLayers).toBe(3);
    expect(cost.recomposited).toBe(1);
  });

  it("re-keys the head chain when the performer's head box moves", () => {
    const p = planned({ strategy: "composite", cropFrom: "photo" });
    const moved = { ...p, performers: p.performers.map((x) => (x.id === "p-gatsby" ? { ...x, headBox: { x: 0.4, y: 0.03, w: 0.2, h: 0.18 } } : x)) };
    const a = stagesForLook(p, p.looks[0]), b = stagesForLook(moved, moved.looks[0]);
    expect(b[0].key).toBe(a[0].key);
    expect(b[4].key).not.toBe(a[4].key);
    expect(b[6].key).not.toBe(a[6].key);
  });

  it("exposes the finished complete look as the hero record", () => {
    const p = planned({ strategy: "composite", cropFrom: "photo" });
    const last = stagesForLook(p, p.looks[1]).at(-1)!;
    expect(lookImages(p, "l-daisy").complete).toBeUndefined();
    p.renders[last.key] = { key: last.key, lookId: "l-daisy", stage: "composite", status: "done", url: "data:image/jpeg;base64,AA==", composite: true, units: 0 };
    expect(lookImages(p, "l-daisy").complete?.composite).toBe(true);
  });
});
