import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { allStages, pendingStages, renderImpact, stagesForLook } from "@/lib/engine/render";
import { replanWithout, naivePlan } from "@/lib/engine/solver";
import { portableProduction } from "@/lib/client/export";
import type { Production } from "@/lib/engine/types";

const showcase = (): Production => JSON.parse(readFileSync("public/showcase/production.json", "utf8"));

describe("the complete public showcase", () => {
  it("ships a fictional cast, every rack photo and 23 actual completed layers", () => {
    const p = showcase();
    expect(p.performers).toHaveLength(3);
    expect(p.performers.every((performer) => performer.reference === "fictional")).toBe(true);
    expect(p.looks).toHaveLength(6);
    expect(new Set(p.looks.map((look) => look.hair?.templateId)).size).toBe(6);
    expect(allStages(p)).toHaveLength(23);
    expect(pendingStages(p, undefined, true)).toEqual([]);
    expect(p.plan?.gaps).toEqual([]);
    expect(p.plan?.conflicts.filter((c) => c.severity === "hard")).toEqual([]);
    const urls = [
      ...p.performers.flatMap((performer) => [performer.bodyPhoto, performer.portraitPhoto]),
      ...[...p.inventory, ...p.shop].map((item) => item.image),
      ...Object.values(p.renders).map((record) => record.url),
    ];
    for (const url of urls) {
      expect(url).toMatch(/^\/(rack|showcase)\//);
      expect(existsSync(resolve("public" + url))).toBe(true);
    }
    for (const record of Object.values(p.renders)) {
      expect(record.demo).toBe(false);
      expect(record.status).toBe("done");
      expect(record.taskId).toBeUndefined();
    }
    expect(JSON.stringify(p)).not.toMatch(/data:|\.local\/|\/home\/|X-Amz-|access_token|secret_key/i);
  });

  it("demonstrates the shared-rack conflict and a one-layer $40 repair without a key", () => {
    const p = showcase();
    expect(naivePlan(p).conflicts.some((c) => c.kind === "double-booked" && c.itemId === "i-navy-coat")).toBe(true);
    const repaired = replanWithout(p, "i-navy-coat");
    const impact = renderImpact(p, repaired.production);
    expect(repaired.changes).toEqual([{ lookId: "l-rowe-sea", slot: "outer", from: "i-navy-coat", to: "x-pea-coat" }]);
    expect(p.plan?.cost).toBe(0);
    expect(repaired.production.plan?.cost).toBe(40);
    expect(impact).toMatchObject({ total: 23, kept: 22, lookIds: ["l-rowe-sea"] });
    expect(impact.changedKeys).toHaveLength(1);
    expect(impact.cachedKeys).toEqual(impact.changedKeys);
    expect(pendingStages(repaired.production, undefined, true)).toEqual([]);
  });

  it("scopes roots to a production and bills a shared hairstyle only once", () => {
    const p = showcase();
    const first = p.looks[0], second = p.looks[1];
    second.hair = first.hair;
    p.renders = {};
    const one = stagesForLook(p, first).find((stage) => stage.stage === "hair")!;
    const two = stagesForLook(p, second).find((stage) => stage.stage === "hair")!;
    expect(one.key).toBe(two.key);
    expect(pendingStages(p).filter((stage) => stage.key === one.key)).toHaveLength(1);
    expect(pendingStages(p, [second.id]).find((stage) => stage.key === two.key)?.lookId).toBe(second.id);
    const other = { ...p, id: "a-different-production" };
    expect(stagesForLook(other, first).find((stage) => stage.stage === "hair")?.key).not.toBe(one.key);
  });

  it("exports all input photos with valid finished render keys and fails on missing images", async () => {
    const p = showcase();
    const inline = vi.fn(async (url: string) => `data:image/jpeg;base64,${Buffer.from(url).toString("base64")}`);
    const out = await portableProduction(p, inline);
    expect(out.performers.every((performer) => performer.bodyPhoto?.startsWith("data:image/") && performer.portraitPhoto?.startsWith("data:image/"))).toBe(true);
    expect([...out.inventory, ...out.shop].every((item) => item.image?.startsWith("data:image/"))).toBe(true);
    expect(pendingStages(out, undefined, true)).toEqual([]);
    expect(allStages(out).every((stage) => out.renders[stage.key]?.url?.startsWith("data:image/"))).toBe(true);
    expect(new Set(inline.mock.calls.map(([url]) => url)).size).toBe(inline.mock.calls.length);
    await expect(portableProduction(p, async () => { throw new Error("Missing photo"); })).rejects.toThrow("Missing photo");
  });
});
