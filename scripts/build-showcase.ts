/**
 * Writes public/showcase/<name>/production.json from its source in lib/, with
 * the plan solved and every saved render whose key is still in the graph kept.
 *
 *   npm run showcase:build -- midsummer
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { midsummerProduction } from "../lib/midsummer.ts";
import { allStages } from "../lib/engine/render.ts";
import { solve } from "../lib/engine/solver.ts";
import type { Production } from "../lib/engine/types.ts";

const SOURCES: Record<string, () => Production> = { midsummer: midsummerProduction };

export function showcasePath(name: string) {
  return `public/showcase/${name}/production.json`;
}

export function buildShowcase(name: string): Production {
  const make = SOURCES[name];
  if (!make) throw new Error(`Unknown showcase "${name}". Known: ${Object.keys(SOURCES).join(", ")}`);
  const p = make();
  p.plan = solve(p);
  const path = showcasePath(name);
  const prior: Production | undefined = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  const keys = new Set(allStages(p).map((s) => s.key));
  // Keep finished renders that the current graph still uses (plus the repair alternates, keyed by content).
  for (const [key, record] of Object.entries(prior?.renders ?? {})) {
    if (record.status === "done" && record.url && (keys.has(key) || record.url.startsWith(`/showcase/${name}/`))) p.renders[key] = { ...record, taskId: undefined, creationPending: undefined };
  }
  return p;
}

export function writeShowcase(name: string, p: Production) {
  mkdirSync(`public/showcase/${name}`, { recursive: true });
  writeFileSync(showcasePath(name), JSON.stringify(p, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2] ?? "midsummer";
  const p = buildShowcase(name);
  writeShowcase(name, p);
  console.log(`Wrote ${showcasePath(name)}: ${p.looks.length} looks, ${Object.keys(p.renders).length} saved renders, plan $${p.plan!.cost} of $${p.budget}.`);
}
