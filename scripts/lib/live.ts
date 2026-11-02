/**
 * Shared live YouCam client for the showcase scripts.
 *
 * Safety rules, enforced here rather than by convention:
 *  - keys come only from process.env and are never printed or written;
 *  - every task is recorded in a private state file (.local/, git-ignored)
 *    before polling, so a rerun resumes it and never submits it twice;
 *  - a task whose creation outcome is unknown is held, not resubmitted;
 *  - the balance and the unit estimate are printed before any paid call;
 *  - a ledger caps total units across every script run (default 300);
 *  - the run stops after two failures.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { accountAccessToken } from "../../lib/youcam/auth.ts";
import { findBalance, findImageUrl } from "../../lib/youcam/result.ts";

export const BASE = "https://yce-api-01.makeupar.com";
export const ledgerPath = () => process.env.ENCORE_LEDGER ?? ".local/live-ledger.json";
export const UNIT_CAP = Number(process.env.ENCORE_UNIT_CAP ?? 300);
export const MAX_FAILURES = 2;

export type SavedTask = { signature: string; taskId?: string; creating?: boolean; status?: "success" | "error"; file?: string; error?: string; units: number };
export type LiveState = { uploads: Record<string, string>; tasks: Record<string, SavedTask> };
type Ledger = { spent: number; runs: { at: string; script: string; units: number }[] };

export const digest = (v: string | Buffer | Uint8Array) => createHash("sha256").update(v).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
  renameSync(`${path}.tmp`, path);
}

export class StopRun extends Error {}

export type Transport = (path: string, init?: RequestInit) => Promise<Record<string, any>>;

/** Real HTTP. Errors never include the request headers or the key. */
export const httpTransport: Transport = async (path, init) => {
  const key = process.env.YOUCAM_API_KEY?.trim();
  if (!key) throw new StopRun("YOUCAM_API_KEY is not set.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`${path.split("?")[0]}: HTTP ${res.status} ${body.error_code ?? ""}`.trim());
  return body;
};

export async function readBalance(): Promise<number> {
  const token = await accountAccessToken();
  const res = await fetch(`${BASE}/s2s/v1.0/client/credit`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new StopRun(`Balance check failed: HTTP ${res.status}`);
  const balance = findBalance(await res.json());
  if (balance === undefined) throw new StopRun("Balance response was not recognised.");
  return balance;
}

export class Live {
  readonly state: LiveState;
  failures = 0;
  spentThisRun = 0;
  readonly stateFile: string;
  readonly script: string;
  readonly transport: Transport;
  readonly pollMs: number;
  constructor(stateFile: string, script: string, transport: Transport = httpTransport, pollMs = 3000) {
    this.stateFile = stateFile; this.script = script; this.transport = transport; this.pollMs = pollMs;
    // Older tools wrote other shapes to the same path; keep only what this class understands.
    const saved = readJson<Partial<LiveState>>(stateFile, {});
    this.state = { uploads: saved.uploads ?? {}, tasks: saved.tasks ?? {} };
  }
  save() { writeJson(this.stateFile, this.state); }

  static ledger(): Ledger { return readJson<Ledger>(ledgerPath(), { spent: 0, runs: [] }); }

  /** Print the balance and estimate; refuse if either the balance or the cap would be exceeded. */
  static async gate(script: string, estimate: number, balance: () => Promise<number> = readBalance): Promise<number> {
    const ledger = Live.ledger();
    const units = await balance();
    console.log(`Balance: ${units} units · this run: ~${estimate} units · spent so far by ENCORE scripts: ${ledger.spent} of a ${UNIT_CAP}-unit cap`);
    if (estimate > units) throw new StopRun(`The run needs ~${estimate} units but the account has ${units}.`);
    if (ledger.spent + estimate > UNIT_CAP) throw new StopRun(`The run would take ENCORE scripts past the ${UNIT_CAP}-unit cap (${ledger.spent} spent).`);
    void script;
    return units;
  }

  private charge(units: number) {
    const ledger = Live.ledger();
    ledger.spent += units;
    ledger.runs.push({ at: new Date().toISOString(), script: this.script, units });
    writeJson(ledgerPath(), ledger);
    this.spentThisRun += units;
  }

  private fail(name: string, message: string): never {
    this.failures++;
    console.error(`FAIL ${name}: ${message}`);
    if (this.failures >= MAX_FAILURES) throw new StopRun(`Stopped after ${this.failures} failures. Fix the cause, then rerun to resume.`);
    throw new Error(message);
  }

  /** Register a file and PUT its bytes; reused by content hash. */
  async upload(bytes: Buffer, type: "image/jpeg" | "image/png", name = "photo.jpg"): Promise<string> {
    const key = digest(bytes);
    if (this.state.uploads[key]) return this.state.uploads[key];
    const reg = await this.transport("/s2s/v2.0/file", { method: "POST", body: JSON.stringify({ files: [{ content_type: type, file_name: name, file_size: bytes.byteLength }] }) });
    const file = reg.data?.files?.[0];
    const request = file?.requests?.[0];
    if (!file?.file_id || !request?.url) throw new Error("File registration returned no file_id or upload URL");
    const put = await fetch(request.url, { method: request.method ?? "PUT", headers: request.headers ?? { "Content-Type": type }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(60_000) });
    if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status}`);
    this.state.uploads[key] = file.file_id;
    this.save();
    return file.file_id;
  }

  /**
   * Create (once) and poll a task, then download its image to `out`.
   * Returns the local file path. Never submits a task that state says exists.
   */
  async task(name: string, taskPath: string, body: Record<string, unknown>, units: number, out: string, download: (url: string) => Promise<Buffer> = fetchBytes): Promise<string> {
    const signature = digest(JSON.stringify({ taskPath, body }));
    let saved: SavedTask | undefined = this.state.tasks[name];
    if (saved?.status === "success" && saved.file && saved.signature === signature && existsSync(saved.file)) return saved.file;
    if (saved && saved.signature !== signature && !saved.taskId && !saved.creating) saved = undefined;
    if (saved && saved.signature !== signature) this.fail(name, "Inputs changed since this task was submitted. Rename the task or clear it from the state file deliberately.");
    if (saved?.status === "error") this.fail(name, `The API marked this task as failed: ${saved.error}. Clear it from the state file to retry.`);
    if (saved?.creating && !saved.taskId) this.fail(name, `Creation outcome unknown. Check the account activity before clearing it from ${this.stateFile}.`);
    if (!saved) {
      saved = this.state.tasks[name] = { signature, creating: true, units };
      this.save();
      let created: Record<string, any>;
      try {
        created = await this.transport(taskPath, { method: "POST", body: JSON.stringify(body) });
      } catch (error) {
        // A refused request (4xx) did not start a task; anything else stays held.
        if (/HTTP 4\d\d/.test((error as Error).message)) { delete this.state.tasks[name]; this.save(); }
        this.fail(name, (error as Error).message);
      }
      const taskId = created.data?.task_id;
      if (!taskId) this.fail(name, "Task creation returned no task_id");
      saved.taskId = taskId; saved.creating = false;
      this.save();
      this.charge(units);
    }
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      await sleep(this.pollMs);
      let res: Record<string, any>;
      try { res = await this.transport(`${taskPath}/${encodeURIComponent(saved.taskId!)}`); } catch { continue; }
      const status = res.data?.task_status;
      if (status === "error") {
        saved.status = "error"; saved.error = String(res.data?.error ?? "unknown error"); this.save();
        this.fail(name, saved.error);
      }
      if (status === "success") {
        const url = findImageUrl(res.data?.results);
        if (!url) { saved.status = "error"; saved.error = "Succeeded without an image URL"; this.save(); this.fail(name, saved.error); }
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, await download(url));
        saved.status = "success"; saved.file = out; this.save();
        console.log(`OK   ${name}`);
        return out;
      }
    }
    this.fail(name, "Still processing after 4 minutes. Rerun to resume the same task.");
  }
}

export async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Short content hash for file names, like the existing showcase assets. */
export const shortHash = (bytes: Buffer) => digest(bytes).slice(0, 10);
