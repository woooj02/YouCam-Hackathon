/**
 * Catalogue feed adapter: how a costume hire house, shop or secondhand dealer
 * plugs its stock into ENCORE. A supplier publishes one JSON file in this
 * shape (JSON Schema: docs/catalogue-feed.schema.json); ENCORE validates it
 * with zod and maps every row to a catalogue Item the planner can choose.
 * Nothing is fetched or ordered automatically.
 */
import { z } from "zod";
import type { Item, ItemSource, Production } from "../engine/types";

const Slug = z.string().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/, "use letters, digits, dot, dash or underscore");

export const FeedItem = z.object({
  sku: Slug.describe("The supplier's own stock code; unique within the feed"),
  name: z.string().min(1).max(120),
  slot: z.enum(["base", "outer", "hat"]).describe("base = the costume, outer = coat/jacket/shawl, hat = headwear"),
  garmentCategory: z.enum(["upper_body", "lower_body", "full_body", "outer", "auto"]).default("auto"),
  colors: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)).default([]),
  sizes: z.array(z.string().min(1)).min(1).describe('Sizes in stock; "OS" for one size'),
  stock: z.number().int().min(0).describe("Units available for the production's dates"),
  price: z.object({
    amount: z.number().min(0),
    per: z.enum(["run", "week", "item"]).describe("run = hire fee for the whole run, week = hire fee per week, item = purchase price"),
  }),
  image: z.url().optional().describe("https URL of a front-on product photo, used as the try-on garment reference"),
  condition: z.string().max(200).optional(),
});

export const CatalogueFeed = z.object({
  feed: z.literal("encore.catalogue.v1"),
  supplier: z.object({
    name: z.string().min(1).max(120),
    kind: z.enum(["hire", "retail", "secondhand"]),
    contact: z.string().max(200).optional(),
  }),
  currency: z.string().min(1).max(3).describe('Display symbol or code, e.g. "$"'),
  updated: z.iso.date().optional(),
  items: z.array(FeedItem).min(1).max(5000),
});
export type CatalogueFeed = z.infer<typeof CatalogueFeed>;

const SOURCE: Record<CatalogueFeed["supplier"]["kind"], ItemSource> = { hire: "rental", retail: "shop", secondhand: "secondhand" };

export type FeedResult = { items: Item[]; supplier: string; warnings: string[] };

/** Validate a feed and map it to catalogue items. Throws one readable message on invalid input. */
export function loadCatalogueFeed(input: unknown, opts: { runWeeks?: number; currency?: string } = {}): FeedResult {
  const parsed = CatalogueFeed.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "feed"}: ${i.message}`);
    throw new Error(`This catalogue feed isn't valid. ${issues.join("; ")}`);
  }
  const feed = parsed.data;
  const warnings: string[] = [];
  if (opts.currency && feed.currency !== opts.currency) warnings.push(`Feed prices are in ${feed.currency}; the production budget is in ${opts.currency}.`);
  const seen = new Set<string>();
  const supplierId = feed.supplier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const weeks = Math.max(1, opts.runWeeks ?? 1);
  const items: Item[] = [];
  for (const row of feed.items) {
    if (seen.has(row.sku)) { warnings.push(`Duplicate SKU ${row.sku} skipped.`); continue; }
    seen.add(row.sku);
    if (row.stock === 0) { warnings.push(`${row.name} has no stock and was skipped.`); continue; }
    if (feed.supplier.kind !== "hire" && row.price.per !== "item") warnings.push(`${row.name}: a ${feed.supplier.kind} price should be per item.`);
    const cost = row.price.per === "week" ? row.price.amount * weeks : row.price.amount;
    items.push({
      id: `feed:${supplierId}:${row.sku}`,
      name: row.name,
      slot: row.slot,
      garmentCategory: row.slot === "outer" ? "outer" : row.garmentCategory,
      colors: row.colors.map((c) => c.toLowerCase()),
      tags: row.tags.map((t) => t.toLowerCase()),
      sizes: row.sizes,
      qty: row.stock,
      source: SOURCE[feed.supplier.kind],
      cost: Math.round(cost * 100) / 100,
      vendor: feed.supplier.name,
      image: row.image,
      available: true,
      condition: row.condition,
    });
  }
  return { items, supplier: feed.supplier.name, warnings };
}

/** Replace this supplier's previous feed items in the catalogue; the rack is untouched. */
export function mergeFeed(p: Production, result: FeedResult): Production {
  return { ...p, shop: [...p.shop.filter((i) => i.vendor !== result.supplier || !i.id.startsWith("feed:")), ...result.items] };
}

/** The JSON Schema published in docs/, generated from the zod schema so they cannot drift. */
export const catalogueFeedJsonSchema = () => z.toJSONSchema(CatalogueFeed, { io: "input" });
