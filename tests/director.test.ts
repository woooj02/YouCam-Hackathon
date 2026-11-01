import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { directOffline } from "@/lib/director";
import { applyOp } from "@/lib/engine/ops";
import { allStages } from "@/lib/engine/render";
import { showcaseProduction } from "@/lib/showcase";

describe("the no-model recording flow", () => {
  it("turns the exact coat sentence into a $40 replacement and changes only one layer", () => {
    const before = applyOp(showcaseProduction(), { type: "plan" }).production;
    const result = directOffline(before, "The navy greatcoat has moth damage, we can't use it");
    expect(result.offline).toBe(true);
    expect(result.affected).toEqual(["l-rowe-sea"]);
    const after = result.ops.reduce((p, op) => applyOp(p, op).production, before);
    expect(after.plan!.cost).toBe(40);
    expect(after.plan!.assignment["l-rowe-sea"].outer).toBe("x-pea-coat");
    const keys = new Set(allStages(before).map((stage) => stage.key));
    expect(allStages(after).filter((stage) => !keys.has(stage.key)).map((stage) => stage.stage)).toEqual(["outer"]);
  });
});

describe("every suggested no-model command", () => {
  it("approves a named look and unlocks it without changing the plan", () => {
    const p = applyOp(showcaseProduction(), { type: "plan" }).production;
    const approval = directOffline(p, "Lock Elsie's masquerade look, the director approved it");
    expect(approval.ops).toEqual([{ type: "lock", lookId: "l-elsie-party", locked: true }]);
    const locked = applyOp(p, approval.ops[0]).production;
    expect(locked.plan?.assignment).toEqual(p.plan?.assignment);
    expect(directOffline(locked, "Unlock Elsie's masquerade look").ops).toEqual([{ type: "lock", lookId: "l-elsie-party", locked: false }]);
    expect(directOffline(p, "Lock Elsie's look").ops).toEqual([]);
  });

  it("enforces a reduced budget after damage and lists an unaffordable need as a gap", () => {
    const p = applyOp(applyOp(showcaseProduction(), { type: "plan" }).production, { type: "unavailable", itemId: "i-navy-coat" }).production;
    const result = directOffline(p, "Our sourcing budget just dropped to $30");
    expect(result.ops).toEqual([{ type: "budget", budget: 30 }]);
    const after = applyOp(p, result.ops[0]).production;
    expect(after.plan!.cost).toBeLessThanOrEqual(30);
    expect(after.plan!.conflicts.filter((conflict) => conflict.severity === "hard")).toEqual([]);
    const noRackCoats = { ...p, inventory: p.inventory.filter((item) => item.slot !== "outer"), shop: p.shop.map((item) => ({ ...item, cost: Math.max(40, item.cost) })) };
    expect(applyOp(noRackCoats, result.ops[0]).production.plan!.gaps.some((gap) => gap.slot === "outer")).toBe(true);
    expect(directOffline(p, "Set budget to $0").ops).toEqual([{ type: "budget", budget: 0 }]);
  });

  it("restores a repaired named piece before a separate re-plan", () => {
    const p = applyOp(applyOp(showcaseProduction(), { type: "plan" }).production, { type: "unavailable", itemId: "i-navy-coat" }).production;
    expect(directOffline(p, "The navy greatcoat has been repaired").ops).toEqual([{ type: "restore", itemId: "i-navy-coat" }]);
    expect(directOffline(p, "The navy greatcoat has moth damage").ops).toEqual([]);
  });
});
