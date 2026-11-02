/**
 * The order sheet: the plan turned into what the wardrobe team pulls, hires,
 * buys and hunts secondhand, per performer, with the scene each piece is first
 * needed by and totals against the budget. Pure, so the page, the CSV export
 * and the tests share it.
 */
import { context, basketFor } from "./engine/solver.ts";
import type { Gap, Item, ItemSource, Production } from "./engine/types";

export type Wearer = { performer: string; size: string; role: string; look: string };
export type OrderLine = {
  itemId: string; name: string; source: ItemSource; vendor?: string;
  sizes: string[]; qty: number; unitCost: number; total: number;
  neededBy?: { order: number; name: string };
  wearers: Wearer[];
};
export type OrderGroup = { source: ItemSource; label: string; lines: OrderLine[]; subtotal: number };
export type OrderSheet = {
  title: string; currency: string; budget: number;
  groups: OrderGroup[]; total: number; remaining: number;
  unsourced: (Gap & { performer: string; look: string; neededBy?: { order: number; name: string } })[];
};

export const GROUP_LABEL: Record<ItemSource, string> = { owned: "On the rack", rental: "Hire", shop: "Buy", secondhand: "Secondhand" };
const ORDER: ItemSource[] = ["owned", "rental", "shop", "secondhand"];

export function orderSheet(p: Production): OrderSheet {
  const assignment = p.plan?.assignment ?? {};
  const ctx = context(p);
  const basket = new Map(basketFor(ctx, assignment).map((l) => [l.itemId, l]));
  const scene = (ids: string[]) => ids.map((id) => p.scenes.find((s) => s.id === id)).filter(Boolean).sort((a, b) => a!.order - b!.order)[0];
  const lookInfo = (lookId: string) => {
    const look = p.looks.find((l) => l.id === lookId)!;
    const role = p.roles.find((r) => r.id === look.roleId);
    const perf = p.performers.find((x) => x.id === role?.performerId);
    return { look, role, perf };
  };

  const lines = new Map<string, OrderLine>();
  const scenesOf = new Map<string, string[]>();
  for (const [lookId, slots] of Object.entries(assignment)) {
    for (const itemId of Object.values(slots)) {
      if (!itemId) continue;
      const item = ctx.items.get(itemId) as Item | undefined;
      if (!item) continue;
      const { look, role, perf } = lookInfo(lookId);
      const line = lines.get(itemId) ?? { itemId, name: item.name, source: item.source, vendor: item.vendor, sizes: [], qty: 0, unitCost: item.cost, total: 0, wearers: [] };
      if (!line.wearers.some((w) => w.performer === perf?.name && w.look === look.name)) line.wearers.push({ performer: perf?.name ?? "?", size: perf?.size ?? "?", role: role?.name ?? "?", look: look.name });
      if (perf?.size && !line.sizes.includes(perf.size)) line.sizes.push(perf.size);
      scenesOf.set(itemId, [...(scenesOf.get(itemId) ?? []), ...look.sceneIds]);
      lines.set(itemId, line);
    }
  }
  for (const line of lines.values()) {
    const paid = basket.get(line.itemId);
    // Units needed at once: from the basket for paid pieces, from the busiest scene for rack pieces.
    const perScene = new Map<string, number>();
    for (const [lookId, slots] of Object.entries(assignment)) if (Object.values(slots).includes(line.itemId)) for (const s of p.looks.find((l) => l.id === lookId)?.sceneIds ?? []) perScene.set(s, (perScene.get(s) ?? 0) + 1);
    line.qty = paid?.units ?? Math.max(1, ...perScene.values());
    line.total = paid?.total ?? 0;
    const first = scene(scenesOf.get(line.itemId) ?? []);
    line.neededBy = first ? { order: first.order, name: first.name } : undefined;
    line.sizes.sort();
  }

  const groups = ORDER.map((source) => {
    const ls = [...lines.values()].filter((l) => l.source === source).sort((a, b) => (a.neededBy?.order ?? 99) - (b.neededBy?.order ?? 99) || a.name.localeCompare(b.name));
    return { source, label: GROUP_LABEL[source], lines: ls, subtotal: ls.reduce((s, l) => s + l.total, 0) };
  }).filter((g) => g.lines.length);
  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  const unsourced = (p.plan?.gaps ?? []).map((gap) => {
    const { look, perf } = lookInfo(gap.lookId);
    const first = scene(look.sceneIds);
    return { ...gap, performer: perf?.name ?? "?", look: look.name, neededBy: first ? { order: first.order, name: first.name } : undefined };
  });
  return { title: p.title, currency: p.currency, budget: p.budget, groups, total, remaining: p.budget - total, unsourced };
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per piece; a spreadsheet or a supplier can read it as-is. */
export function orderCsv(sheet: OrderSheet): string {
  const rows: (string | number)[][] = [["source", "item", "supplier", "performers", "sizes", "qty", "unit_cost", "line_total", "needed_by_scene"]];
  for (const g of sheet.groups) for (const l of g.lines) {
    rows.push([g.label, l.name, l.vendor ?? "", [...new Set(l.wearers.map((w) => `${w.performer} (${w.size}) as ${w.role}`))].join("; "), l.sizes.join("/"), l.qty, l.unitCost, l.total, l.neededBy ? `${l.neededBy.order}. ${l.neededBy.name}` : ""]);
  }
  for (const u of sheet.unsourced) rows.push(["Still to source", u.need, "", `${u.performer} as ${u.look}`, "", 1, "", "", u.neededBy ? `${u.neededBy.order}. ${u.neededBy.name}` : ""]);
  rows.push(["Total", "", "", "", "", "", "", sheet.total, ""]);
  rows.push(["Budget", "", "", "", "", "", "", sheet.budget, ""]);
  rows.push(["Remaining", "", "", "", "", "", "", sheet.remaining, ""]);
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/**
 * Plain-text quote request for one supplier. ENCORE sends nothing itself:
 * the designer copies this into their own email.
 */
export function quoteRequest(sheet: OrderSheet, vendor: string): string {
  const lines = sheet.groups.flatMap((g) => g.lines.filter((l) => l.vendor === vendor && l.source !== "owned"));
  const money = (n: number) => `${sheet.currency}${n}`;
  return [
    `Quote request: ${sheet.title}`,
    "",
    `Hello ${vendor},`,
    "",
    "Could you confirm availability and price for these pieces?",
    "",
    ...lines.map((l) => `- ${l.name} · ${l.qty} × sizes ${l.sizes.join("/")} · ${GROUP_LABEL[l.source].toLowerCase()} · listed at ${money(l.unitCost)} each · needed by scene ${l.neededBy?.order ?? "?"} (${l.neededBy?.name ?? "?"})`),
    "",
    `Listed total: ${money(lines.reduce((s, l) => s + l.total, 0))}. Prices above are from your catalogue listing and may have changed.`,
    "",
    "Thank you,",
  ].join("\n");
}

export const vendorsToQuote = (sheet: OrderSheet) => [...new Set(sheet.groups.filter((g) => g.source !== "owned").flatMap((g) => g.lines.map((l) => l.vendor).filter((v): v is string => !!v)))];
