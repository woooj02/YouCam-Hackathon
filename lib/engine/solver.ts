/**
 * The wardrobe planner: assigns physical pieces to every look in a production.
 *
 * Hard constraints
 *   - capacity: in any scene, a piece is worn by at most `qty` looks at once
 *   - availability and size: only available pieces that fit the performer
 *   - budget: rentals and purchases never exceed the production budget
 * Objective
 *   - maximise how well each piece matches its look's brief (tags, colours),
 *     minus a small cost penalty, with unfilled slots becoming sourcing gaps
 *
 * Search is branch and bound over (look, slot) variables in fewest-candidates
 * order, with an optimistic bound from the best remaining matches. Production-
 * sized problems (dozens of looks, a few hundred pieces) solve in milliseconds;
 * a node limit keeps worst cases bounded and the best plan found is returned.
 */
import type { Assignment, BasketLine, Conflict, Gap, Item, Look, Plan, Production, Requirement, Slot } from "./types";

export type SolveOptions = {
  /** (look, slot) pairs that must keep their current piece. */
  fixed?: Assignment;
  /** Weight of cost relative to match quality (cost is normalised by budget). */
  alpha?: number;
  /** Minimum match for a piece to be considered at all. */
  minMatch?: number;
  nodeLimit?: number;
};

const GAP_PENALTY = -1;

const norm = (s: string) => s.trim().toLowerCase();

function words(item: Item): Set<string> {
  const out = new Set(item.tags.map(norm));
  for (const w of item.name.toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 2) out.add(w);
  return out;
}

/** 0..1: share of the brief's tags the piece carries, blended with colour fit. */
export function matchScore(item: Item, req: Requirement): number {
  if (item.slot !== req.slot) return 0;
  const have = words(item);
  const tags = req.tags.map(norm).filter(Boolean);
  const tagScore = tags.length ? tags.filter((t) => have.has(t)).length / tags.length : 0.6;
  if (!req.colors?.length) return tagScore;
  const colors = new Set(item.colors.map(norm));
  const colorScore = req.colors.some((c) => colors.has(norm(c))) ? 1 : 0;
  return 0.7 * tagScore + 0.3 * colorScore;
}

export const fits = (item: Item, size: string | undefined) =>
  item.sizes.some((s) => norm(s) === "os" || (size !== undefined && norm(s) === norm(size)));

export function describeNeed(req: Requirement, size?: string): string {
  const bits = [...(req.colors ?? []), ...req.tags].join(", ");
  return `${req.slot === "base" ? "costume" : req.slot === "outer" ? "outer layer" : "headwear"}: ${bits || "any"}${size ? `, size ${size}` : ""}`;
}

type Ctx = {
  p: Production;
  items: Map<string, Item>;
  scenesOf: Map<string, string[]>;
  sizeOf: Map<string, string | undefined>;
  performerOf: Map<string, string | undefined>;
};

export function context(p: Production): Ctx {
  const items = new Map<string, Item>();
  for (const it of [...p.inventory, ...p.shop]) items.set(it.id, it);
  const performerByRole = new Map(p.roles.map((r) => [r.id, r.performerId]));
  const sizeByPerformer = new Map(p.performers.map((x) => [x.id, x.size]));
  const scenesOf = new Map<string, string[]>();
  const sizeOf = new Map<string, string | undefined>();
  const performerOf = new Map<string, string | undefined>();
  for (const l of p.looks) {
    scenesOf.set(l.id, l.sceneIds);
    const perf = performerByRole.get(l.roleId);
    performerOf.set(l.id, perf);
    sizeOf.set(l.id, perf ? sizeByPerformer.get(perf) : undefined);
  }
  return { p, items, scenesOf, sizeOf, performerOf };
}

/** Units of each piece needed at peak (max simultaneous wearers across scenes). */
function peakUnits(ctx: Ctx, assignment: Assignment): Map<string, number> {
  const usage = new Map<string, Map<string, number>>();
  for (const [lookId, slots] of Object.entries(assignment)) {
    for (const itemId of Object.values(slots)) {
      if (!itemId) continue;
      const m = usage.get(itemId) ?? new Map<string, number>();
      for (const s of ctx.scenesOf.get(lookId) ?? []) m.set(s, (m.get(s) ?? 0) + 1);
      if (!(ctx.scenesOf.get(lookId) ?? []).length) m.set("_", (m.get("_") ?? 0) + 1);
      usage.set(itemId, m);
    }
  }
  const peak = new Map<string, number>();
  for (const [id, m] of usage) peak.set(id, Math.max(1, ...m.values()));
  return peak;
}

export function basketFor(ctx: Ctx, assignment: Assignment): BasketLine[] {
  const lines: BasketLine[] = [];
  for (const [id, units] of peakUnits(ctx, assignment)) {
    const it = ctx.items.get(id);
    if (!it || it.source === "owned" || it.cost <= 0) continue;
    lines.push({ itemId: id, units, unitCost: it.cost, total: units * it.cost, source: it.source, vendor: it.vendor });
  }
  return lines.sort((a, b) => b.total - a.total);
}

/** Everything wrong with an assignment, whoever produced it. */
export function audit(p: Production, assignment: Assignment): Conflict[] {
  const ctx = context(p);
  const out: Conflict[] = [];
  const byItemScene = new Map<string, string[]>();
  for (const [lookId, slots] of Object.entries(assignment)) {
    for (const itemId of Object.values(slots)) {
      if (!itemId) continue;
      const it = ctx.items.get(itemId);
      if (it && !fits(it, ctx.sizeOf.get(lookId))) {
        out.push({ kind: "size", itemId, lookIds: [lookId], message: `${it.name} isn't listed in size ${ctx.sizeOf.get(lookId)}`, severity: "hard" });
      }
      for (const s of ctx.scenesOf.get(lookId) ?? []) {
        const k = `${itemId}|${s}`;
        byItemScene.set(k, [...(byItemScene.get(k) ?? []), lookId]);
      }
    }
  }
  for (const [k, lookIds] of byItemScene) {
    const [itemId, sceneId] = k.split("|");
    const it = ctx.items.get(itemId);
    if (it && lookIds.length > it.qty) {
      const scene = p.scenes.find((s) => s.id === sceneId)?.name ?? sceneId;
      out.push({
        kind: "double-booked",
        itemId,
        sceneId,
        lookIds,
        message: `${it.name} is on ${lookIds.length} people in "${scene}" but the rack has ${it.qty}`,
        severity: "hard",
      });
    }
  }
  const cost = basketFor(ctx, assignment).reduce((s, l) => s + l.total, 0);
  if (cost > p.budget) {
    out.push({ kind: "over-budget", lookIds: [], message: `Sourcing costs ${p.currency}${cost} against a ${p.currency}${p.budget} budget`, severity: "hard" });
  }
  // Soft: the same piece changing performers between back-to-back scenes needs a fast handoff.
  const order = new Map(p.scenes.map((s) => [s.id, s.order]));
  const wearers = new Map<string, { lookId: string; perf?: string; orders: number[] }[]>();
  for (const [lookId, slots] of Object.entries(assignment)) {
    for (const itemId of Object.values(slots)) {
      if (!itemId) continue;
      const orders = (ctx.scenesOf.get(lookId) ?? []).map((s) => order.get(s) ?? 0);
      wearers.set(itemId, [...(wearers.get(itemId) ?? []), { lookId, perf: ctx.performerOf.get(lookId), orders }]);
    }
  }
  for (const [itemId, ws] of wearers) {
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        if (ws[i].perf === ws[j].perf) continue;
        const adjacent = ws[i].orders.some((a) => ws[j].orders.some((b) => Math.abs(a - b) === 1));
        if (adjacent) {
          const it = ctx.items.get(itemId);
          out.push({
            kind: "tight-handoff",
            itemId,
            lookIds: [ws[i].lookId, ws[j].lookId],
            message: `${it?.name ?? itemId} passes between performers across back-to-back scenes`,
            severity: "soft",
          });
        }
      }
    }
  }
  return out;
}

type Var = { look: Look; req: Requirement; domain: { item: Item; match: number }[]; fixed?: string };

export function solve(p: Production, opts: SolveOptions = {}): Plan {
  const t0 = Date.now();
  const alpha = opts.alpha ?? 0.35;
  const minMatch = opts.minMatch ?? 0.3;
  const nodeLimit = opts.nodeLimit ?? 250_000;
  const ctx = context(p);
  const all = [...p.inventory, ...p.shop].filter((i) => i.available);
  const budget = Math.max(1, p.budget);

  const vars: Var[] = [];
  for (const look of p.looks) {
    for (const req of look.requirements) {
      const fixedId = opts.fixed?.[look.id]?.[req.slot];
      const domain = all
        .filter((it) => it.slot === req.slot && fits(it, ctx.sizeOf.get(look.id)))
        .map((item) => ({ item, match: matchScore(item, req) }))
        .filter((c) => c.match >= minMatch)
        .sort((a, b) => b.match - alpha * (a.item.cost / budget) - (a.match - alpha * (b.item.cost / budget)));
      vars.push({ look, req, domain, fixed: fixedId });
    }
  }
  // Fixed first, then fewest candidates first.
  vars.sort((a, b) => Number(!!b.fixed) - Number(!!a.fixed) || a.domain.length - b.domain.length);

  const gapValue = (v: Var) => (v.req.optional ? 0 : GAP_PENALTY);
  const suffix = new Array(vars.length + 1).fill(0);
  for (let i = vars.length - 1; i >= 0; i--) {
    const v = vars[i];
    const bestMatch = v.fixed ? 1 : Math.max(gapValue(v), v.domain[0]?.match ?? gapValue(v));
    suffix[i] = suffix[i + 1] + bestMatch;
  }

  const usage = new Map<string, Map<string, number>>(); // item -> scene -> wearers
  const units = new Map<string, number>(); // item -> peak units
  const choice: (string | null)[] = new Array(vars.length).fill(null);
  let best: { score: number; choice: (string | null)[]; cost: number } = { score: -Infinity, choice: [], cost: 0 };
  let nodes = 0;

  const scenesFor = (look: Look) => (look.sceneIds.length ? look.sceneIds : ["_"]);

  function place(item: Item, look: Look): { ok: boolean; delta: number } {
    const m = usage.get(item.id) ?? new Map<string, number>();
    let peak = units.get(item.id) ?? 0;
    for (const s of scenesFor(look)) {
      const n = (m.get(s) ?? 0) + 1;
      if (n > item.qty) return { ok: false, delta: 0 };
      peak = Math.max(peak, n);
    }
    const delta = item.source === "owned" ? 0 : (peak - (units.get(item.id) ?? 0)) * item.cost;
    return { ok: true, delta };
  }
  function apply(item: Item, look: Look, sign: 1 | -1) {
    const m = usage.get(item.id) ?? new Map<string, number>();
    for (const s of scenesFor(look)) m.set(s, (m.get(s) ?? 0) + sign);
    usage.set(item.id, m);
    units.set(item.id, Math.max(0, ...m.values()));
  }

  function dfs(i: number, score: number, cost: number) {
    if (++nodes > nodeLimit) return;
    if (i === vars.length) {
      if (score > best.score) best = { score, choice: [...choice], cost };
      return;
    }
    if (score + suffix[i] <= best.score + 1e-9) return;
    const v = vars[i];
    if (v.fixed) {
      const item = ctx.items.get(v.fixed);
      if (item?.available) {
        const { delta } = place(item, v.look);
        apply(item, v.look, 1);
        choice[i] = item.id;
        dfs(i + 1, score + matchScore(item, v.req), cost + delta);
        apply(item, v.look, -1);
        choice[i] = null;
        return;
      }
    }
    for (const { item, match } of v.domain) {
      const { ok, delta } = place(item, v.look);
      if (!ok || cost + delta > p.budget) continue;
      apply(item, v.look, 1);
      choice[i] = item.id;
      dfs(i + 1, score + match - (alpha * delta) / budget, cost + delta);
      apply(item, v.look, -1);
      choice[i] = null;
      if (nodes > nodeLimit) return;
    }
    dfs(i + 1, score + gapValue(v), cost);
  }
  dfs(0, 0, 0);

  const assignment: Assignment = {};
  const gaps: Gap[] = [];
  vars.forEach((v, i) => {
    const id = best.choice[i];
    if (id) (assignment[v.look.id] ??= {})[v.req.slot] = id;
    else if (!v.req.optional) gaps.push({ lookId: v.look.id, slot: v.req.slot, need: describeNeed(v.req, ctx.sizeOf.get(v.look.id)) });
  });
  for (const l of p.looks) assignment[l.id] ??= {};

  const basket = basketFor(ctx, assignment);
  return {
    assignment,
    score: Math.round(best.score * 1000) / 1000,
    cost: basket.reduce((s, l) => s + l.total, 0),
    basket,
    gaps,
    conflicts: audit(p, assignment),
    nodes,
    ms: Date.now() - t0,
  };
}

/**
 * What most teams do by hand: pick the best piece for each look on its own,
 * ignoring who else needs it and what it costs. Used as the evaluation baseline.
 */
export function naivePlan(p: Production): Plan {
  const t0 = Date.now();
  const ctx = context(p);
  const all = [...p.inventory, ...p.shop].filter((i) => i.available);
  const assignment: Assignment = {};
  const gaps: Gap[] = [];
  for (const look of p.looks) {
    assignment[look.id] = {};
    for (const req of look.requirements) {
      const bestItem = all
        .filter((it) => it.slot === req.slot && fits(it, ctx.sizeOf.get(look.id)))
        .map((item) => ({ item, match: matchScore(item, req) }))
        .filter((c) => c.match >= 0.3)
        .sort((a, b) => b.match - a.match)[0];
      if (bestItem) assignment[look.id][req.slot] = bestItem.item.id;
      else if (!req.optional) gaps.push({ lookId: look.id, slot: req.slot, need: describeNeed(req, ctx.sizeOf.get(look.id)) });
    }
  }
  const basket = basketFor(ctx, assignment);
  const score = p.looks.reduce(
    (s, l) => s + l.requirements.reduce((t, r) => {
      const id = assignment[l.id][r.slot];
      const it = id ? ctx.items.get(id) : undefined;
      return t + (it ? matchScore(it, r) : r.optional ? 0 : GAP_PENALTY);
    }, 0),
    0,
  );
  return { assignment, score, cost: basket.reduce((s, l) => s + l.total, 0), basket, gaps, conflicts: audit(p, assignment), nodes: 0, ms: Date.now() - t0 };
}

export type SlotChange = { lookId: string; slot: Slot; from?: string; to?: string };

export function diffAssignments(before: Assignment, after: Assignment): SlotChange[] {
  const out: SlotChange[] = [];
  const looks = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const lookId of looks) {
    for (const slot of ["base", "outer", "hat"] as Slot[]) {
      const from = before[lookId]?.[slot];
      const to = after[lookId]?.[slot];
      if (from !== to) out.push({ lookId, slot, from, to });
    }
  }
  return out;
}

/** Everything except these (look, slot) pairs stays exactly as it is. */
export function freezeExcept(assignment: Assignment, free: { lookId: string; slot: Slot }[]): Assignment {
  const fixed: Assignment = {};
  for (const [lookId, slots] of Object.entries(assignment)) {
    for (const [slot, itemId] of Object.entries(slots) as [Slot, string][]) {
      if (free.some((f) => f.lookId === lookId && f.slot === slot)) continue;
      (fixed[lookId] ??= {})[slot] = itemId;
    }
  }
  return fixed;
}

/** Fixed pairs for every locked look, so a full re-plan never touches approved looks. */
export function lockedPairs(p: Production): Assignment {
  const out: Assignment = {};
  if (!p.plan) return out;
  for (const l of p.looks) if (l.locked && p.plan.assignment[l.id]) out[l.id] = { ...p.plan.assignment[l.id] };
  return out;
}

export function usesOf(p: Production, itemId: string): { lookId: string; slot: Slot }[] {
  const out: { lookId: string; slot: Slot }[] = [];
  for (const [lookId, slots] of Object.entries(p.plan?.assignment ?? {})) {
    for (const [slot, id] of Object.entries(slots) as [Slot, string][]) if (id === itemId) out.push({ lookId, slot });
  }
  return out;
}

/**
 * A piece is gone (torn, lost, rental fell through). Only the (look, slot)
 * pairs that used it are re-solved; every other choice is frozen, so approved
 * looks and their renders survive untouched.
 */
export function replanWithout(p: Production, itemId: string): { production: Production; changes: SlotChange[]; affected: string[] } {
  const next: Production = {
    ...p,
    inventory: p.inventory.map((i) => (i.id === itemId ? { ...i, available: false } : i)),
    shop: p.shop.map((i) => (i.id === itemId ? { ...i, available: false } : i)),
  };
  const before = p.plan?.assignment ?? {};
  const free = usesOf(p, itemId);
  const plan = solve(next, { fixed: freezeExcept(before, free) });
  const changes = diffAssignments(before, plan.assignment);
  return { production: { ...next, plan }, changes, affected: [...new Set(free.map((f) => f.lookId))] };
}
