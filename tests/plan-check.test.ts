import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { headlineClash, renderUnder } from "@/components/studio/PlanCheck";
import { gatsbyProduction } from "@/lib/gatsby";
import { midsummerProduction } from "@/lib/midsummer";
import { naivePlan, solve } from "@/lib/engine/solver";
import evalResult from "@/lib/eval-result.json";
import { readFileSync } from "node:fs";
import type { Production } from "@/lib/engine/types";

describe("plan check", () => {
  it("shows the Gatsby jacket clash: Gatsby and Nick in one black jacket at the party", () => {
    const p = gatsbyProduction();
    const clash = headlineClash(naivePlan(p).conflicts)!;
    expect(clash).toMatchObject({ itemId: "g-black-jacket", sceneId: "party", lookIds: ["l-gatsby", "l-nick"] });
  });

  it("picks the widest Midsummer clash: three suitors for one dinner jacket", () => {
    const clash = headlineClash(naivePlan(midsummerProduction()).conflicts)!;
    expect(clash.itemId).toBe("m-black-jacket");
    expect(clash.lookIds).toHaveLength(3);
  });

  it("finds the saved Gatsby render for the naive jacket and reports Nick's as not rendered", () => {
    const p: Production = JSON.parse(readFileSync("public/showcase/production.json", "utf8"));
    const naive = naivePlan(p);
    expect(renderUnder(p, naive, p.looks.find((l) => l.id === "l-gatsby")!)?.url).toMatch(/^\/showcase\//);
    const nick = renderUnder(p, naive, p.looks.find((l) => l.id === "l-nick")!);
    // Rendered only once the 2-unit live render has been run (scripts/render-showcase.ts --extra).
    if (nick) expect(nick.demo).toBeFalsy(); else expect(nick).toBeUndefined();
    expect(solve(p).assignment["l-nick"].outer).toBe("g-charcoal-jacket");
  });

  it("shows the benchmark numbers the eval script produces, not typed-in ones", () => {
    const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/eval.ts", "200"], { encoding: "utf8" });
    const row = (name: string) => out.split("\n").find((line) => line.startsWith(`| ${name}`))!.split("|").map((c) => c.trim());
    expect(row("Look-by-look")[2]).toBe(`${(evalResult.feasible.naive * 100).toFixed(1)}%`);
    expect(row("ENCORE")[2]).toBe(`${(evalResult.feasible.encore * 100).toFixed(1)}%`);
    expect(evalResult.productions).toBe(200);
  });
});
