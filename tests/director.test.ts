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
