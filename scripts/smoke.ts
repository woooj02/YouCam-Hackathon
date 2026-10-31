/**
 * Live smoke test against the real YouCam API. Run this first with a real key:
 * it proves the layered pipeline (costume -> outer layer, hair -> makeup ->
 * headwear) on your own photos, prints every result URL to eyeball, and pins
 * the raw responses as fixtures.
 *
 *   npm run smoke -- \   (reads YOUCAM_API_KEY from .env.local)
 *     --body me-full.jpg --face me-face.jpg --garment dress.jpg --outer coat.jpg --hat cap.jpg [--gender male|female (default male)]
 *
 * Spends roughly 9 units. Every step is independent: a failure is reported and
 * the next step still runs where it can.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildBody, type Job } from "../lib/youcam/bodies.ts";
import { FEATURES, type FeatureId } from "../lib/youcam/features.ts";

const BASE = "https://yce-api-01.makeupar.com";
const KEY = process.env.YOUCAM_API_KEY;
if (!KEY) {
  console.error("Set YOUCAM_API_KEY in .env.local first.");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const FIX = "tests/fixtures/youcam";
mkdirSync(FIX, { recursive: true });

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init?.headers } });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return body as Record<string, any>;
}

async function upload(path: string): Promise<string> {
  const bytes = readFileSync(path);
  const type = path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const reg = await api("/s2s/v2.0/file", { method: "POST", body: JSON.stringify({ files: [{ content_type: type, file_name: path.split("/").pop(), file_size: bytes.byteLength }] }) });
  const f = reg.data.files[0];
  const r = f.requests[0];
  const put = await fetch(r.url, { method: r.method ?? "PUT", headers: r.headers ?? { "Content-Type": type }, body: bytes });
  if (!put.ok) throw new Error(`PUT failed ${put.status}`);
  return f.file_id;
}

function findUrl(x: unknown): string | undefined {
  if (typeof x === "string") return /^https?:\/\//.test(x) ? x : undefined;
  if (Array.isArray(x)) return x.map(findUrl).find(Boolean);
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return findUrl(o.url) ?? Object.values(o).map(findUrl).find(Boolean);
  }
  return undefined;
}

async function run(name: string, feature: FeatureId, job: Job, src: Record<string, string>, ref?: Record<string, string>) {
  const t0 = Date.now();
  try {
    const created = await api(FEATURES[feature].taskPath, { method: "POST", body: JSON.stringify(buildBody(job, src, ref)) });
    const taskId = created.data.task_id;
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const polled = await api(`${FEATURES[feature].taskPath}/${taskId}`);
      const status = polled.data?.task_status;
      if (status === "success" || status === "error") {
        writeFileSync(`${FIX}/${name}.json`, JSON.stringify(polled, null, 2));
        const url = findUrl(polled.data?.results);
        console.log(`${status === "success" ? "OK  " : "FAIL"} ${name.padEnd(14)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${status === "success" ? url : polled.data?.error}`);
        return status === "success" ? url : undefined;
      }
    }
  } catch (e) {
    console.log(`FAIL ${name.padEnd(14)} ${(e as Error).message}`);
    return undefined;
  }
}

const balance = async () => JSON.stringify(await api("/s2s/v1.0/client/credit").then((b) => b.data ?? b).catch((e) => ({ error: String(e) })));

(async () => {
  console.log("Balance before:", await balance());
  if (args.body && args.garment) {
    const [body, garment] = [await upload(args.body), await upload(args.garment)];
    const costume = await run("cloth-base", "cloth", { feature: "cloth", ref: "x", category: "auto" }, { src_file_id: body }, { ref_file_id: garment });
    if (costume && args.outer) {
      await run("cloth-outer", "cloth", { feature: "cloth", ref: "x", category: "outer" }, { src_file_url: costume }, { ref_file_id: await upload(args.outer) });
    }
  }
  if (args.face) {
    const face = await upload(args.face);
    const templates = await api(`${FEATURES["hair-transfer"].templatePath}?page_size=5`).catch((e) => ({ error: String(e) }));
    writeFileSync(`${FIX}/hair-templates.json`, JSON.stringify(templates, null, 2));
    const t = (templates as any)?.data?.templates?.[0] ?? (templates as any)?.data?.results?.[0];
    const tid = t?.id ?? t?.template_id;
    console.log("Hair template:", tid ?? "none found (see tests/fixtures/youcam/hair-templates.json)");
    let src: Record<string, string> = { src_file_id: face };
    if (tid) {
      const hair = await run("hair-transfer", "hair-transfer", { feature: "hair-transfer", templateId: String(tid), hairColor: "src" }, src);
      if (hair) src = { src_file_url: hair };
    }
    const made = await run("makeup-vto", "makeup-vto", { feature: "makeup-vto", makeup: { label: "test", lip: { color: "#8e1b2b", texture: "matte" }, foundation: { color: "#e9c7b0", coverage: 45 }, smooth: 40 } }, src);
    if (args.hat) {
      await run("hat", "hat", { feature: "hat", ref: "x", gender: args.gender === "female" ? "female" : "male" }, made ? { src_file_url: made } : src, { ref_file_id: await upload(args.hat) });
    }
  }
  console.log("Balance after: ", await balance());
  console.log(`\nRaw responses saved in ${FIX}/. Open each URL above and check the face and garment held up through the chain.`);
})();
