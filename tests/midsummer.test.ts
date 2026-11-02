import { describe, expect, it } from "vitest";
import { midsummerProduction } from "@/lib/midsummer";
import { naivePlan, solve } from "@/lib/engine/solver";
import { allStages, isApiStage } from "@/lib/engine/render";

const hard = (plan: ReturnType<typeof solve>) => plan.conflicts.filter((c) => c.severity === "hard");

describe("Midsummer showcase production", () => {
  it("has a labelled fictional cast of 10, four scenes and two doubled performers", () => {
    const p = midsummerProduction();
    expect(p.performers).toHaveLength(10);
    expect(p.performers.every((x) => x.reference === "fictional")).toBe(true);
    expect(p.scenes.length).toBeGreaterThanOrEqual(3);
    const doubled = p.performers.filter((x) => p.roles.filter((r) => r.performerId === x.id).length > 1).map((x) => x.name);
    expect(doubled).toEqual(["Elliot", "Ama"]);
    expect(new Set([...p.shop].map((i) => i.source))).toEqual(new Set(["rental", "shop", "secondhand"]));
    expect(p.notice).toMatch(/Fictional performers, vendors and prices/);
  });

  it("look-by-look fails: the same jacket and gown on several people in one scene, and over budget", () => {
    const p = midsummerProduction();
    const naive = naivePlan(p);
    const doubles = hard(naive).filter((c) => c.kind === "double-booked").map((c) => `${c.itemId}@${c.sceneId}`);
    expect(doubles).toContain("m-black-jacket@court");
    expect(doubles).toContain("m-black-jacket@wedding");
    expect(doubles).toContain("m-ivory-gown@wedding");
    expect(hard(naive).some((c) => c.kind === "over-budget")).toBe(true);
    expect(naive.cost).toBeGreaterThan(p.budget);
  });

  it("ENCORE succeeds with non-obvious trade-offs inside the budget", () => {
    const p = midsummerProduction();
    const plan = solve(p);
    expect(hard(plan)).toEqual([]);
    expect(plan.gaps).toEqual([]);
    expect(plan.cost).toBeLessThanOrEqual(p.budget);
    const a = plan.assignment;
    // One owned black jacket: the Duke keeps it, Lysander moves to the navy one, Demetrius (size L) is hired.
    expect([a["l-theseus"].outer, a["l-lysander"].outer, a["l-demetrius"].outer]).toEqual(["m-black-jacket", "m-navy-jacket", "h-black-jacket"]);
    // Ama wears Titania's silver gown again as Hippolyta, which frees the ivory gown for Hermia's wedding.
    expect(a["l-hippolyta"].base).toBe(a["l-titania"].base);
    expect(a["l-hermia-wed"].base).toBe("m-ivory-gown");
    // Helena (size L) wears one secondhand dress in both of her looks.
    expect(a["l-helena"].base).toBe("s-ivory-dress");
    expect(a["l-helena-wed"].base).toBe("s-ivory-dress");
  });

  it("flags the doubled performer's quick change from the wood to the wedding", () => {
    const plan = solve(midsummerProduction());
    const quick = plan.conflicts.filter((c) => c.kind === "quick-change").map((c) => c.message);
    expect(quick).toContain("Quick change for Elliot: Oberon, in the wood to Theseus, the Duke between scenes 3 and 4");
    // Helena keeps the same dress, so there is nothing to change.
    expect(quick.some((m) => m.includes("Grace"))).toBe(false);
  });

  it("renders a complete look per look without close-up photos, inside the live unit budget", () => {
    const p = midsummerProduction(); p.plan = solve(p);
    const stages = allStages(p);
    expect(stages.some((s) => s.chain === "portrait")).toBe(false);
    expect(new Set(stages.filter((s) => s.chain === "look").map((s) => s.lookId)).size).toBe(15);
    const units = stages.filter(isApiStage).reduce((sum, s) => sum + s.units, 0);
    expect(units).toBeLessThan(100);
  });
});
