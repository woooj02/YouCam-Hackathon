/**
 * Planner evaluation: ENCORE's constrained planner vs. the look-by-look
 * baseline on seeded, synthetic productions. Synthetic by design and labelled
 * as such in docs/EVAL.md; it measures plan feasibility, not taste.
 *
 *   npm run eval            -> prints a markdown table
 */
import { naivePlan, solve } from "../lib/engine/solver.ts";
import type { Item, Look, Production, Slot } from "../lib/engine/types.ts";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const TAGS: Record<Slot, string[]> = {
  base: ["dress", "gown", "suit", "shirt", "1920s", "work", "evening", "period", "lace", "tweed"],
  outer: ["coat", "long", "wool", "cape", "shawl", "period", "naval", "evening"],
  hat: ["cap", "hat", "bowler", "top", "period", "flat"],
};
const COLORS = ["black", "navy", "grey", "ivory", "green", "brown", "red"];
const SIZES = ["S", "M", "L"];

function synth(seed: number): Production {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const some = <T,>(xs: T[], n: number) => [...xs].sort(() => r() - 0.5).slice(0, n);
  const nPerf = 3 + Math.floor(r() * 4);
  const nScenes = 4 + Math.floor(r() * 4);
  const performers = Array.from({ length: nPerf }, (_, i) => ({ id: `p${i}`, name: `P${i}`, size: pick(SIZES), photoVersion: 0 }));
  const roles = performers.map((p, i) => ({ id: `r${i}`, name: `R${i}`, performerId: p.id, summary: "" }));
  const scenes = Array.from({ length: nScenes }, (_, i) => ({ id: `s${i}`, name: `S${i}`, order: i + 1 }));
  const looks: Look[] = roles.flatMap((role, i) =>
    Array.from({ length: 1 + Math.floor(r() * 2) }, (_, j) => ({
      id: `l${i}-${j}`,
      roleId: role.id,
      name: `L${i}-${j}`,
      sceneIds: some(scenes, 1 + Math.floor(r() * 3)).map((s) => s.id),
      locked: false,
      requirements: (["base", "outer", "hat"] as Slot[])
        .filter((s) => s === "base" || r() < 0.6)
        .map((slot) => ({ slot, tags: some(TAGS[slot], 2 + Math.floor(r() * 2)), colors: [pick(COLORS)] })),
    })),
  );
  const item = (id: string, source: Item["source"]): Item => {
    const slot = pick(["base", "base", "outer", "hat"] as Slot[]);
    return {
      id,
      name: id,
      slot,
      garmentCategory: slot === "outer" ? "outer" : "auto",
      colors: [pick(COLORS)],
      tags: some(TAGS[slot], 3),
      sizes: slot === "hat" ? ["OS"] : some(SIZES, 1 + Math.floor(r() * 2)),
      qty: source === "owned" ? 1 : 2,
      source,
      cost: source === "owned" ? 0 : 15 + Math.floor(r() * 50),
      available: true,
    };
  };
  return {
    id: `synth-${seed}`, title: "", logline: "", brief: "", currency: "$",
    budget: 100 + Math.floor(r() * 200),
    performers, roles, scenes, looks,
    inventory: Array.from({ length: 12 + Math.floor(r() * 16) }, (_, i) => item(`o${i}`, "owned")),
    shop: Array.from({ length: 8 + Math.floor(r() * 10) }, (_, i) => item(`x${i}`, r() < 0.5 ? "rental" : "shop")),
    plan: null, renders: {}, history: [],
  };
}

const N = Number(process.argv[2] ?? 200);
const rows = { naive: { double: 0, over: 0, gaps: 0, feasible: 0, ms: 0, score: 0 }, encore: { double: 0, over: 0, gaps: 0, feasible: 0, ms: 0, score: 0 } };
let looks = 0;
for (let seed = 1; seed <= N; seed++) {
  const p = synth(seed);
  looks += p.looks.length;
  for (const [name, plan] of [["naive", naivePlan(p)], ["encore", solve(p)]] as const) {
    const row = rows[name];
    const double = plan.conflicts.filter((c) => c.kind === "double-booked").length;
    const over = plan.conflicts.some((c) => c.kind === "over-budget");
    row.double += double;
    row.over += Number(over);
    row.gaps += plan.gaps.length;
    row.feasible += Number(double === 0 && !over);
    row.ms += plan.ms;
    row.score += plan.score;
  }
}

const pct = (n: number) => `${((100 * n) / N).toFixed(1)}%`;
console.log(`Synthetic productions: ${N} (${looks} looks, 3-6 performers, 4-7 scenes, seeded 1..${N})\n`);
console.log("| Planner | Feasible plans | Double-bookings (total) | Over budget | Unfilled slots | Avg solve time |");
console.log("|---|---|---|---|---|---|");
for (const [name, r] of Object.entries(rows)) {
  console.log(`| ${name === "naive" ? "Look-by-look baseline" : "ENCORE planner"} | ${pct(r.feasible)} | ${r.double} | ${pct(r.over)} | ${r.gaps} | ${(r.ms / N).toFixed(1)} ms |`);
}
