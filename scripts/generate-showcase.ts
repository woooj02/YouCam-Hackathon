/**
 * Generate the Midsummer showcase's fictional performer and garment photos with
 * YouCam text-to-image, then record them in lib/midsummer-assets.ts.
 *
 *   npm run showcase:generate -- --dry-run                    # prompts, count, no network
 *   npm run showcase:generate -- --units-per-image N [--only p-elliot-body,m-black-jacket]
 *
 * --units-per-image is the price from your API console: the script does not
 * guess it. After the first image it re-reads the balance and stops if the real
 * cost differs. State lives in .local/midsummer/generate-state.json, so a rerun
 * resumes running tasks and never submits a finished prompt twice.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { ALL_PROMPTS, NEGATIVE, PERFORMER_PROMPTS } from "./showcase-prompts.ts";
import { Live, readBalance, shortHash, StopRun } from "./lib/live.ts";

export const T2I_PATH = "/s2s/v2.0/task/text-to-image/youcam";
const STATE = ".local/midsummer/generate-state.json";
const ASSETS = "lib/midsummer-assets.ts";

export function textToImageBody(prompt: string) {
  if (prompt.length >= 800) throw new Error(`Prompt is ${prompt.length} characters; keep it under 800.`);
  return { model: "youcam-image-v2", prompt, negative_prompt: NEGATIVE, size: "1104*1472", prompt_extend: false };
}

export function assetPath(id: string, hash: string) {
  return id in PERFORMER_PROMPTS ? `/showcase/midsummer/cast/${id}-${hash}.jpg` : `/showcase/midsummer/rack/${id}-${hash}.jpg`;
}

export function readAssets(): Record<string, string> {
  const text = readFileSync(ASSETS, "utf8");
  const json = /= (\{[\s\S]*\});/.exec(text)?.[1] ?? "{}";
  return JSON.parse(json);
}

export function writeAssets(assets: Record<string, string>) {
  const sorted = Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)));
  const head = readFileSync(ASSETS, "utf8").split("export const")[0];
  writeFileSync(ASSETS, `${head}export const midsummerAssets: Record<string, string> = ${JSON.stringify(sorted, null, 2)};\n`);
}

async function main() {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean" }, "units-per-image": { type: "string" }, only: { type: "string" } } });
  const assets = readAssets();
  const wanted = Object.keys(ALL_PROMPTS).filter((id) => (!values.only || values.only.split(",").includes(id)) && !assets[id]);
  for (const id of wanted) textToImageBody(ALL_PROMPTS[id]); // Validate every prompt before any network call.
  console.log(`${wanted.length} images to generate (${Object.keys(assets).length} already saved).`);
  if (values["dry-run"]) { for (const id of wanted) console.log(`- ${id}: ${ALL_PROMPTS[id].length} chars`); return; }
  const per = Number(values["units-per-image"]);
  if (!Number.isFinite(per) || per <= 0) throw new StopRun("Pass --units-per-image with the text-to-image price from your API console.");
  if (!wanted.length) return;
  let balance = await Live.gate("generate-showcase", wanted.length * per);
  const live = new Live(STATE, "generate-showcase");
  let first = true;
  for (const id of wanted) {
    try {
      const tmp = `.local/midsummer/generated/${id}.jpg`;
      await live.task(`t2i:${id}`, T2I_PATH, textToImageBody(ALL_PROMPTS[id]), per, tmp);
      const jpeg = await sharp(readFileSync(tmp)).jpeg({ quality: 88 }).toBuffer();
      const path = assetPath(id, shortHash(jpeg));
      mkdirSync(dirname(`public${path}`), { recursive: true });
      writeFileSync(`public${path}`, jpeg);
      assets[id] = path;
      writeAssets(assets);
      if (first) {
        first = false;
        const after = await readBalance();
        console.log(`Balance after the first image: ${after} (${balance - after} units used)`);
        if (balance - after > per) throw new StopRun(`The first image cost ${balance - after} units, not ${per}. Rerun with the real price.`);
        balance = after;
      }
    } catch (error) {
      if (error instanceof StopRun) throw error;
    }
  }
  console.log(`Done. Spent ~${live.spentThisRun} units this run. Balance now: ${await readBalance()}. Next: npm run showcase:build, then npm run showcase:render.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}
