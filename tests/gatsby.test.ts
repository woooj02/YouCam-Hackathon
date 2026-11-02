import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gatsbyProduction } from "@/lib/gatsby";
import { naivePlan, solve } from "@/lib/engine/solver";
import { allStages, renderImpact } from "@/lib/engine/render";
import { applyOp } from "@/lib/engine/ops";
import { directOffline } from "@/lib/director";

describe("Gatsby party wardrobe", () => {
  it("resolves the shared dinner jacket across all three actors", () => {
    const p = gatsbyProduction();
    expect(p.performers.every((performer) => performer.reference === "fictional")).toBe(true);
    expect(p.roles.map((role) => role.name)).toEqual(["Jay Gatsby", "Daisy Buchanan", "Nick Carraway"]);
    expect(naivePlan(p).conflicts.filter((conflict) => conflict.kind === "double-booked").map((conflict) => conflict.itemId)).toEqual(["g-black-jacket"]);
    const plan = solve(p);
    expect(plan.conflicts.filter((conflict) => conflict.severity === "hard")).toEqual([]);
    expect(plan.gaps).toEqual([]);
    expect(plan.cost).toBe(0);
    expect(plan.assignment["l-gatsby"].outer).toBe("g-black-jacket");
    expect(plan.assignment["l-nick"].outer).toBe("g-charcoal-jacket");
  });

  it("replaces only Gatsby's jacket with the $40 hire", () => {
    const p = gatsbyProduction(); p.plan = solve(p);
    const command = directOffline(p, "Gatsby's black dinner jacket is damaged. We can't use it.");
    expect(command.ops).toEqual([{ type: "unavailable", itemId: "g-black-jacket", reason: "reported by the designer" }]);
    const next = applyOp(p, command.ops[0]).production;
    expect(next.plan?.cost).toBe(40);
    expect(next.plan?.assignment["l-gatsby"].outer).toBe("g-ivory-jacket");
    expect(next.plan?.assignment["l-daisy"]).toEqual(p.plan.assignment["l-daisy"]);
    expect(next.plan?.assignment["l-nick"]).toEqual(p.plan.assignment["l-nick"]);
    const impact = renderImpact(p, next);
    expect(impact.lookIds).toEqual(["l-gatsby"]);
    expect(impact.total).toBe(12);
    expect(impact.kept).toBe(11);
    const changed = allStages(next).filter((stage) => impact.changedKeys.includes(stage.key));
    expect(changed.map((stage) => [stage.stage, stage.units])).toEqual([["outer", 2]]);
  });
});

describe("Gatsby repair numbers", () => {
  it("costs 2 units instead of 21 for the whole cast, from the graph and unit costs", async () => {
    const { repairCost, UNIT_COST } = await import("@/lib/engine/render");
    const p = gatsbyProduction(); p.plan = solve(p);
    const cost = repairCost(p, applyOp(p, { type: "unavailable", itemId: "g-black-jacket" }).production);
    expect(cost).toEqual({ apiLayers: 12, changedApiLayers: 1, units: UNIT_COST.cloth, fullCastUnits: 3 * (2 * UNIT_COST.cloth + UNIT_COST["hair-transfer"] + UNIT_COST["makeup-vto"]), recomposited: 0 });
    expect(cost.fullCastUnits).toBe(21);
  });
});
