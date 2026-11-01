/** Live YouCam check. --preflight creates no render tasks; full run is ~9 units. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { buildBody, type Job } from "../lib/youcam/bodies.ts";
import { FEATURES, type FeatureId } from "../lib/youcam/features.ts";
import { findBalance, findImageUrl } from "../lib/youcam/result.ts";
import { normaliseTemplates } from "../lib/youcam/templates.ts";

const BASE = "https://yce-api-01.makeupar.com";
const LOCAL = ".local/youcam-smoke";
const FIX = "tests/fixtures/youcam";
const STATE = `${LOCAL}/state.json`;
const HELP = `YouCam smoke test (Node 22; reads .env.local)
  npm run smoke -- --preflight
    Check authentication, balance and hair templates. No render tasks.
  npm run smoke -- --body body.jpg --face face.jpg --garment dress.jpg --outer coat.jpg --hat cap.jpg [--gender male|female]
    Check both layered chains (~9 units). Default gender: male.
    Re-running resumes saved tasks and reuses finished results.
  Add --retry-failed to deliberately retry tasks the API marked as failed.
Raw responses and task ids: ${LOCAL}/ (private, ignored by git).
Sanitized response shapes: ${FIX}/.`;

type Body = Record<string, any>;
type SavedTask = { signature: string; taskId?: string; creating?: boolean; response?: Body };
type State = { uploads: Record<string, string>; tasks: Record<string, SavedTask> };
const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { uploads: {}, tasks: {} };
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
let retryFailed = false;

function save() {
  mkdirSync(LOCAL, { recursive: true });
  writeFileSync(`${STATE}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${STATE}.tmp`, STATE);
}

/** Preserve response structure without publishing image access or upload credentials. */
function sanitize(value: unknown): unknown {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return "https://example.com/redacted-image.jpg";
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
    /^(task_id|file_id|headers|next_token)$/i.test(key) ? "[redacted]" : sanitize(v),
  ]));
}

function fixture(name: string, body: unknown) {
  mkdirSync(LOCAL, { recursive: true });
  mkdirSync(FIX, { recursive: true });
  writeFileSync(`${LOCAL}/${name}.json`, JSON.stringify(body, null, 2));
  writeFileSync(`${FIX}/${name}.json`, JSON.stringify(sanitize(body), null, 2) + "\n");
}

async function api(path: string, init?: RequestInit): Promise<Body> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json() as Body;
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${body.error_code ?? body.error ?? "request failed"}`);
  return body;
}

function photo(path: string): { bytes: Buffer; type: string } {
  const ext = extname(path).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) throw new Error(`${path}: use a JPEG or PNG photo`);
  const bytes = readFileSync(path);
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error(`${path}: photo must be nonempty and at most 10 MB`);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (ext === ".png" ? !png : !jpeg) throw new Error(`${path}: contents do not match the image extension`);
  return { bytes, type: png ? "image/png" : "image/jpeg" };
}

async function upload(path: string): Promise<string> {
  const { bytes, type } = photo(path);
  const key = digest(bytes);
  if (state.uploads[key]) return state.uploads[key];
  const reg = await api("/s2s/v2.0/file", { method: "POST", body: JSON.stringify({ files: [{ content_type: type, file_name: basename(path), file_size: bytes.byteLength }] }) });
  const file = reg.data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) throw new Error("File registration returned no file_id or upload URL");
  const put = await fetch(request.url, { method: request.method ?? "PUT", headers: request.headers ?? { "Content-Type": type }, body: new Uint8Array(bytes).buffer, signal: AbortSignal.timeout(30_000) });
  if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status}`);
  state.uploads[key] = file.file_id;
  save();
  return file.file_id;
}

async function run(name: string, feature: FeatureId, job: Job, src: Record<string, string>, ref?: Record<string, string>): Promise<string | undefined> {
  const start = Date.now();
  const request = buildBody(job, src, ref);
  const signature = digest(JSON.stringify(request));
  let saved = state.tasks[name];
  try {
    if (saved?.signature !== signature || (retryFailed && saved.response?.data?.task_status === "error")) {
      saved = state.tasks[name] = { signature };
    }
    if (saved.creating && !saved.taskId) throw new Error(`Creation outcome is unknown. Inspect ${STATE} before creating another paid task.`);
    if (!saved.taskId) {
      saved.creating = true;
      save();
      const created = await api(FEATURES[feature].taskPath, { method: "POST", body: JSON.stringify(request) });
      if (!created.data?.task_id) throw new Error("Task creation returned no task_id");
      saved.taskId = created.data.task_id;
      saved.creating = false;
      save();
      fixture(`${name}-created`, created);
    }
    const deadline = Date.now() + 180_000;
    for (;;) {
      let response = saved.response;
      if (!response || !["success", "error"].includes(response.data?.task_status)) {
        await sleep(2000);
        response = await api(`${FEATURES[feature].taskPath}/${encodeURIComponent(saved.taskId!)}`);
        saved.response = response;
        save();
      }
      const status = response.data?.task_status;
      if (status === "success" || status === "error") {
        fixture(name, response);
        const url = findImageUrl(response.data?.results);
        if (status === "error" || !url) throw new Error(String(response.data?.error ?? "Task succeeded without a recognizable image URL"));
        console.log(`OK   ${name.padEnd(14)} ${((Date.now() - start) / 1000).toFixed(1)}s  ${url}`);
        return url;
      }
      if (Date.now() >= deadline) throw new Error("Polling timed out; re-run the same command to resume this task");
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${name.padEnd(14)} ${(error as Error).message}`);
    return undefined;
  }
}

async function main() {
  const { values: args } = parseArgs({ options: {
    help: { type: "boolean" }, preflight: { type: "boolean" }, "retry-failed": { type: "boolean" },
    body: { type: "string" }, face: { type: "string" }, garment: { type: "string" }, outer: { type: "string" }, hat: { type: "string" }, gender: { type: "string", default: "male" },
  } });
  if (args.help) return console.log(HELP);
  if (args.gender !== "male" && args.gender !== "female") throw new Error("--gender must be male or female");
  if (!args.preflight) {
    const missing = ["body", "face", "garment", "outer", "hat"].filter((key) => !args[key as keyof typeof args]);
    if (missing.length) throw new Error(`Missing photos: ${missing.map((key) => `--${key}`).join(", ")}\n${HELP}`);
    for (const path of [args.body, args.face, args.garment, args.outer, args.hat]) photo(path!);
  }
  if (!process.env.YOUCAM_API_KEY?.trim()) throw new Error("Set YOUCAM_API_KEY in .env.local first");
  retryFailed = args["retry-failed"] ?? false;

  // Abort before uploads or paid task creation if auth/templates are not ready.
  const credits = await api("/s2s/v1.0/client/credit");
  console.log("Balance before:", findBalance(credits) ?? JSON.stringify(credits.data ?? credits));
  const templates = await api(`${FEATURES["hair-transfer"].templatePath}?page_size=5`);
  fixture("hair-templates", templates);
  const first = normaliseTemplates(templates)[0];
  if (!first) throw new Error(`No hair templates found; inspect ${LOCAL}/hair-templates.json`);
  console.log("Hair template:", first.id, first.title);
  if (args.preflight) return console.log("Preflight passed. No uploads or render tasks created.");

  const body = await upload(args.body!);
  const garment = await upload(args.garment!);
  const costume = await run("cloth-base", "cloth", { feature: "cloth", ref: "x", category: "auto" }, { src_file_id: body }, { ref_file_id: garment });
  if (costume) await run("cloth-outer", "cloth", { feature: "cloth", ref: "x", category: "outer" }, { src_file_url: costume }, { ref_file_id: await upload(args.outer!) });
  else console.error("SKIP cloth-outer: base garment did not finish");

  const face = await upload(args.face!);
  const hair = await run("hair-transfer", "hair-transfer", { feature: "hair-transfer", templateId: first.id, hairColor: "src" }, { src_file_id: face });
  if (hair) {
    const made = await run("makeup-vto", "makeup-vto", { feature: "makeup-vto", makeup: { label: "test", lip: { color: "#8e1b2b", texture: "matte" }, foundation: { color: "#e9c7b0", coverage: 45 }, smooth: 40 } }, { src_file_url: hair });
    if (made) await run("hat", "hat", { feature: "hat", ref: "x", gender: args.gender }, { src_file_url: made }, { ref_file_id: await upload(args.hat!) });
    else console.error("SKIP hat: makeup did not finish");
  } else console.error("SKIP makeup-vto and hat: hairstyle did not finish");
  console.log("Balance after:", findBalance(await api("/s2s/v1.0/client/credit")) ?? "unknown");
  console.log(`Private responses and resume state: ${LOCAL}/. Sanitized fixtures: ${FIX}/. Inspect the output images before recording.`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
