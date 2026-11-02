import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFeedJsonSchema, loadCatalogueFeed, mergeFeed } from "@/lib/catalogue/feed";
import { midsummerProduction } from "@/lib/midsummer";
import { solve } from "@/lib/engine/solver";

const sample = () => JSON.parse(readFileSync("public/feeds/sample-hire-feed.json", "utf8"));

describe("catalogue feed adapter", () => {
  it("maps a hire house's feed to catalogue items, pricing weekly hire over the run", () => {
    const { items, supplier, warnings } = loadCatalogueFeed(sample(), { runWeeks: 3, currency: "$" });
    expect(supplier).toBe("Gaslight Wardrobe Hire (fictional)");
    expect(items.map((i) => [i.id, i.source, i.cost, i.qty])).toEqual([
      ["feed:gaslight-wardrobe-hire-fictional:DJ-BLK-014", "rental", 45, 3],
      ["feed:gaslight-wardrobe-hire-fictional:GWN-IVR-203", "rental", 60, 1],
      ["feed:gaslight-wardrobe-hire-fictional:CPE-VLV-031", "rental", 30, 2],
    ]);
    expect(warnings).toEqual(["Blue drop-waist day dress has no stock and was skipped."]);
  });

  it("rejects an invalid feed with a readable message and spends nothing", () => {
    const bad = sample(); bad.items[0].slot = "shoes"; delete bad.items[1].price;
    expect(() => loadCatalogueFeed(bad)).toThrow(/items\.0\.slot.*items\.1\.price/);
    expect(() => loadCatalogueFeed({ feed: "other" })).toThrow(/isn't valid/);
  });

  it("warns on currency mismatch and duplicate SKUs", () => {
    const feed = sample(); feed.currency = "£"; feed.items.push({ ...feed.items[0] });
    const { warnings } = loadCatalogueFeed(feed, { currency: "$" });
    expect(warnings).toContain("Feed prices are in £; the production budget is in $.");
    expect(warnings).toContain("Duplicate SKU DJ-BLK-014 skipped.");
  });

  it("plugs into the planner: a cheaper hire jacket replaces the dearer one", () => {
    const p = midsummerProduction();
    const before = solve(p);
    const next = mergeFeed(p, loadCatalogueFeed(sample(), { runWeeks: 2 }));
    const again = mergeFeed(next, loadCatalogueFeed(sample(), { runWeeks: 2 }));
    expect(again.shop.length).toBe(next.shop.length); // Re-importing replaces, never duplicates.
    const after = solve(next);
    expect(after.conflicts.filter((c) => c.severity === "hard")).toEqual([]);
    expect(after.cost).toBeLessThan(before.cost);
    expect(after.assignment["l-demetrius"].outer).toBe("feed:gaslight-wardrobe-hire-fictional:DJ-BLK-014");
  });

  it("publishes a JSON Schema that matches the zod schema", () => {
    expect(JSON.parse(readFileSync("docs/catalogue-feed.schema.json", "utf8"))).toEqual(JSON.parse(JSON.stringify(catalogueFeedJsonSchema())));
  });
});
