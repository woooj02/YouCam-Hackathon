/**
 * Render a showcase's looks live with the YouCam API and save every layer into
 * public/showcase/<dir>/renders, keyed by the render graph's content keys.
 *
 *   npm run showcase:render -- midsummer --dry-run
 *   npm run showcase:render -- gatsby --looks l-daisy --strategy composite
 *   npm run showcase:render -- gatsby --looks l-daisy --strategy direct
 *   npm run showcase:render -- gatsby --extra l-nick:outer=g-black-jacket     # the look-by-look conflict image (~2 units)
 *   add --extra-costume-only to render only the costume layers of an --extra (what the plan check shows)
 *
 * Prints the balance and the estimate first, stops after two failures, and
 * resumes from .local/<name>/render-state.json without resubmitting a task.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { allStages, estimateUnits, stagesForLook, type StageSpec } from "../lib/engine/render.ts";
import { DEFAULT_HEAD_BOX } from "../lib/engine/composite.ts";
import { solve } from "../lib/engine/solver.ts";
import type { CompleteLook, Production, RenderRecord, Slot } from "../lib/engine/types.ts";
import { buildBody, Job } from "../lib/youcam/bodies.ts";
import { FEATURES } from "../lib/youcam/features.ts";
import { Live, readBalance, StopRun } from "./lib/live.ts";
import { cropHeadFile, pasteHeadFile } from "./lib/images.ts";
import { plural } from "../lib/plural.ts";

export const SHOWCASES: Record<string, { json: string; renders: string }> = {
  gatsby: { json: "public/showcase/production.json", renders: "/showcase/gatsby/renders" },
  midsummer: { json: "public/showcase/midsummer/production.json", renders: "/showcase/midsummer/renders" },
};

export type Extra = { lookId: string; slot: Slot; itemId: string };
export function parseExtra(text: string): Extra {
  const m = /^([\w-]+):(base|outer|hat)=([\w-]+)$/.exec(text);
  if (!m) throw new Error(`--extra must look like l-nick:outer=g-black-jacket, got "${text}"`);
  return { lookId: m[1], slot: m[2] as Slot, itemId: m[3] };
}

/** The stages a run would create: unfinished stages of the chosen looks, plus alternates for --extra. */
export function plannedStages(p: Production, looks: string[] | undefined, extras: Extra[], extraCostumeOnly = false): StageSpec[] {
  const done = (key: string) => p.renders[key]?.status === "done" && !p.renders[key]?.demo;
  const out = allStages(p).filter((s) => !looks || looks.includes(s.lookId));
  for (const extra of extras) {
    const variant: Production = { ...p, plan: { ...p.plan!, assignment: { ...p.plan!.assignment, [extra.lookId]: { ...p.plan!.assignment[extra.lookId], [extra.slot]: extra.itemId } } } };
    const look = variant.looks.find((l) => l.id === extra.lookId);
    if (!look) throw new Error(`No look ${extra.lookId}`);
    // The plan check only shows the costume render, so --extra-costume-only skips the hair and makeup on top.
    out.push(...stagesForLook(variant, look).filter((s) => (extraCostumeOnly ? s.chain === "body" : s.chain !== "portrait")));
  }
  return [...new Map(out.filter((s) => !done(s.key)).map((s) => [s.key, s])).values()];
}

const file = (url: string) => `public${url}`;
const bytes = (url: string) => readFileSync(file(url));

async function runStage(live: Live, p: Production, spec: StageSpec, dir: string): Promise<RenderRecord> {
  const url = `${dir}/${spec.key}.jpg`;
  mkdirSync(`public${dir}`, { recursive: true });
  const look = p.looks.find((l) => l.id === spec.lookId)!;
  const perf = p.performers.find((x) => x.id === p.roles.find((r) => r.id === look.roleId)?.performerId)!;
  const parent = spec.parentKey ? p.renders[spec.parentKey] : undefined;
  if (spec.parentKey && (!parent?.url || parent.status !== "done")) throw new Error(`${spec.lookId} ${spec.stage}: waiting on its input layer`);
  if (spec.feature === "composite") {
    const base = p.renders[spec.baseKey!];
    if (!base?.url) throw new Error(`${spec.lookId}: no costume render to composite onto`);
    writeFileSync(file(url), await pasteHeadFile(bytes(base.url), bytes(parent!.url!), spec.crop!));
    console.log(`OK   ${spec.lookId} composite (local, 0 units)`);
    return { key: spec.key, lookId: spec.lookId, stage: spec.stage, status: "done", url, demo: false, composite: true, units: 0, finishedAt: Date.now() };
  }
  const sourceUrl = parent?.url ?? (spec.chain === "portrait" ? perf.portraitPhoto : perf.bodyPhoto);
  if (!sourceUrl || !existsSync(file(sourceUrl))) throw new StopRun(`${perf.name} has no saved photo. Run the generation script first.`);
  let source: Buffer = bytes(sourceUrl);
  if (spec.crop) source = await cropHeadFile(source, spec.crop);
  const src = { src_file_id: await live.upload(source, "image/jpeg") };
  const job = Job.parse(spec.job);
  let ref: Record<string, string> | undefined;
  if ("ref" in job) {
    if (!job.ref || !existsSync(file(job.ref))) throw new StopRun(`No garment photo for ${spec.label}. Run the generation script first.`);
    ref = { ref_file_id: await live.upload(bytes(job.ref), "image/jpeg", "garment.jpg") };
  }
  try {
    await live.task(`${p.id}:${spec.key}`, FEATURES[job.feature].taskPath, buildBody(job, src, ref), spec.units, file(url));
  } catch (error) {
    // In a full-length render the face can be too small for makeup to detect. Retry on a head crop of the
    // same image and paste it back: same pixels around the seam, and the record says it is a composite.
    if (!(spec.stage === "look-makeup" && !spec.crop && /error_no_face/.test((error as Error).message))) throw error;
    const box = perf.headBox ?? DEFAULT_HEAD_BOX;
    const crop = await cropHeadFile(source, box);
    const cropSrc = { src_file_id: await live.upload(crop, "image/jpeg", "head.jpg") };
    const headFile = file(url).replace(/\.jpg$/, ".head.jpg");
    await live.task(`${p.id}:${spec.key}:head-crop`, FEATURES[job.feature].taskPath, buildBody(job, cropSrc, ref), spec.units, headFile);
    writeFileSync(file(url), await pasteHeadFile(source, readFileSync(headFile), box));
    live.failures = Math.max(0, live.failures - 1); // Recovered, so it does not count towards the stop rule.
    console.log(`OK   ${spec.lookId} ${spec.stage} via head crop (composite)`);
    return { key: spec.key, lookId: spec.lookId, stage: spec.stage, status: "done", url, demo: false, composite: true, units: spec.units, finishedAt: Date.now() };
  }
  return { key: spec.key, lookId: spec.lookId, stage: spec.stage, status: "done", url, demo: false, units: spec.units, finishedAt: Date.now() };
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    looks: { type: "string" }, strategy: { type: "string" }, "crop-from": { type: "string" }, extra: { type: "string", multiple: true }, "extra-costume-only": { type: "boolean" }, "dry-run": { type: "boolean" },
  } });
  const name = positionals[0] ?? "midsummer";
  const showcase = SHOWCASES[name];
  if (!showcase) throw new Error(`Unknown showcase ${name}`);
  const p: Production = JSON.parse(readFileSync(showcase.json, "utf8"));
  if (values.strategy) {
    if (values.strategy !== "direct" && values.strategy !== "composite") throw new Error("--strategy is direct or composite");
    p.completeLook = values.strategy === "direct" ? { strategy: "direct" } : { strategy: "composite", cropFrom: values["crop-from"] === "clothed" ? "clothed" : "photo" } satisfies CompleteLook;
  }
  p.plan ??= solve(p);
  const looks = values.looks?.split(",");
  const stages = plannedStages(p, looks, (values.extra ?? []).map(parseExtra), values["extra-costume-only"]);
  const estimate = estimateUnits(stages);
  console.log(`${p.title}: ${plural(stages.length, "layer")} to make (${plural(stages.filter((s) => s.feature === "composite").length, "local composite")}), ~${plural(estimate, "unit")}.`);
  for (const s of stages) console.log(`  ${s.lookId.padEnd(14)} ${s.stage.padEnd(12)} ${String(s.units).padStart(2)}u  ${s.label}`);
  if (values["dry-run"] || !stages.length) return;
  await Live.gate(`render-showcase ${name}`, estimate);
  const live = new Live(`.local/${name}/render-state.json`, `render-showcase ${name}`);
  for (const spec of stages) {
    try {
      p.renders[spec.key] = await runStage(live, p, spec, showcase.renders);
      writeFileSync(showcase.json, JSON.stringify(p, null, 2) + "\n");
    } catch (error) {
      if (error instanceof StopRun) throw error;
      console.error(`SKIP ${spec.lookId} ${spec.stage}: ${(error as Error).message}`);
    }
  }
  console.log(`Spent ~${live.spentThisRun} units this run. Balance now: ${await readBalance()}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}
