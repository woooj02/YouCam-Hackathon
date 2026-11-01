import { describe, expect, it } from "vitest";
import { audit, lockedPairs, matchScore, naivePlan, replanWithout, solve } from "@/lib/engine/solver";
import { allStages, lookImages, stagesForLook } from "@/lib/engine/render";
import { showcaseProduction } from "@/lib/showcase";
import type { Production } from "@/lib/engine/types";

const planned = (): Production => {
  const p = showcaseProduction();
  return { ...p, plan: solve(p) };
};

describe("matchScore", () => {
  it("rewards tags and colour, and rejects the wrong slot", () => {
    const p = showcaseProduction();
    const coat = p.inventory.find((i) => i.id === "i-navy-coat")!;
    expect(matchScore(coat, { slot: "outer", tags: ["long", "coat"], colors: ["navy"] })).toBe(1);
    expect(matchScore(coat, { slot: "base", tags: ["long", "coat"] })).toBe(0);
  });
});

describe("solve on the showcase production", () => {
  it("fills every required slot with no hard conflicts and stays in budget", () => {
    const { plan } = planned();
    expect(plan!.gaps).toEqual([]);
    expect(plan!.conflicts.filter((c) => c.severity === "hard")).toEqual([]);
    expect(plan!.cost).toBeLessThanOrEqual(250);
  });

  it("gives the one navy greatcoat to one person in the harbour scene", () => {
    const { plan } = planned();
    const wearers = Object.entries(plan!.assignment).filter(([, s]) => s.outer === "i-navy-coat").map(([l]) => l);
    expect(wearers).toHaveLength(1);
    expect(plan!.assignment["l-quill"].outer).toBe("i-frock-coat");
  });

  it("beats the look-by-look baseline, which double-books the coat", () => {
    const p = showcaseProduction();
    const naive = naivePlan(p);
    expect(naive.conflicts.some((c) => c.kind === "double-booked" && c.itemId === "i-navy-coat")).toBe(true);
    expect(solve(p).conflicts.filter((c) => c.severity === "hard")).toHaveLength(0);
  });
});

describe("replanWithout", () => {
  it("only re-solves the slot that used the lost piece", () => {
    const p = planned();
    const { production, changes, affected } = replanWithout(p, "i-navy-coat");
    expect(affected).toEqual(["l-rowe-sea"]);
    expect(changes).toEqual([{ lookId: "l-rowe-sea", slot: "outer", from: "i-navy-coat", to: "x-pea-coat" }]);
    expect(production.plan!.basket.some((b) => b.itemId === "x-pea-coat" && b.total === 40)).toBe(true);
    expect(audit(production, production.plan!.assignment).filter((c) => c.severity === "hard")).toEqual([]);
  });

  it("re-keys exactly one render stage", () => {
    const p = planned();
    const before = new Set(allStages(p).map((s) => s.key));
    const after = allStages(replanWithout(p, "i-navy-coat").production);
    const rekeyed = after.filter((s) => !before.has(s.key));
    expect(rekeyed.map((s) => `${s.lookId}:${s.stage}`)).toEqual(["l-rowe-sea:outer"]);
  });
});

describe("headwear preview validation", () => {
  it("keeps the hat in the wardrobe plan without replacing a finished makeup portrait", () => {
    const p = planned();
    const look = p.looks.find((l) => l.id === "l-rowe-sea")!;
    look.makeup = { label: "Stage direction", smooth: 20 };
    expect(p.plan!.assignment[look.id].hat).toBeTruthy();
    const stages = stagesForLook(p, look);
    expect(stages.some((stage) => stage.feature === "hat")).toBe(false);
    const makeup = stages.find((stage) => stage.stage === "makeup")!;
    p.renders[makeup.key] = { key: makeup.key, lookId: look.id, stage: "makeup", status: "done", url: "https://example.com/approved-makeup.jpg" };
    p.renders["old-hat"] = { key: "old-hat", lookId: look.id, stage: "hat", status: "done", url: "https://example.com/repainted-scene.jpg" };
    expect(lookImages(p, look.id).portrait?.url).toBe("https://example.com/approved-makeup.jpg");
  });
});

describe("locks", () => {
  it("a full re-plan keeps locked looks exactly as approved", () => {
    const p = planned();
    p.looks = p.looks.map((l) => (l.id === "l-quill" ? { ...l, locked: true } : l));
    p.inventory.push({ ...p.inventory.find((i) => i.id === "i-frock-coat")!, id: "i-better", name: "Charcoal naval frock coat", tags: ["long", "coat", "period", "naval"] });
    const again = solve(p, { fixed: lockedPairs(p) });
    expect(again.assignment["l-quill"]).toEqual(p.plan!.assignment["l-quill"]);
  });
});

describe("budget", () => {
  it("never plans over budget; unaffordable needs become gaps", () => {
    const p = showcaseProduction();
    p.budget = 10;
    p.inventory = p.inventory.filter((i) => i.slot !== "outer");
    const plan = solve(p);
    expect(plan.cost).toBeLessThanOrEqual(10);
    expect(plan.gaps.some((g) => g.slot === "outer")).toBe(true);
  });
});
