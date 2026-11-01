import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { Live, StopRun, type Transport } from "@/scripts/lib/live";
import { cropHeadFile, pasteHeadFile } from "@/scripts/lib/images";
import { ALL_PROMPTS } from "@/scripts/showcase-prompts";
import { T2I_PATH, textToImageBody } from "@/scripts/generate-showcase";
import { parseExtra, plannedStages } from "@/scripts/render-showcase";
import { gatsbyProduction } from "@/lib/gatsby";
import { solve } from "@/lib/engine/solver";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "encore-live-"));
  process.env.ENCORE_LEDGER = join(dir, "ledger.json");
});

/** A fake YouCam: counts creations, answers polls with success after one "running". */
function fakeApi(opts: { fail?: boolean } = {}) {
  const calls = { create: 0, poll: 0 };
  const transport: Transport = async (path, init) => {
    if (init?.method === "POST") { calls.create++; return { data: { task_id: `t${calls.create}` } }; }
    calls.poll++;
    if (opts.fail) return { data: { task_status: "error", error: "('Use a full-body shot', 'error_bad_pose')" } };
    return calls.poll % 2 ? { data: { task_status: "running" } } : { data: { task_status: "success", results: { url: "https://example.com/out.jpg" } } };
  };
  return { calls, transport };
}
const download = async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe("live client safety", () => {
  it("creates a task once, saves it, and a rerun reuses the result without resubmitting", async () => {
    const api = fakeApi();
    const state = join(dir, "state.json"), out = join(dir, "out.jpg");
    const first = new Live(state, "test", api.transport, 1);
    await first.task("look", T2I_PATH, { prompt: "x" }, 2, out, download);
    expect(api.calls.create).toBe(1);
    expect(existsSync(out)).toBe(true);
    const again = new Live(state, "test", api.transport, 1);
    await again.task("look", T2I_PATH, { prompt: "x" }, 2, out, download);
    expect(api.calls.create).toBe(1);
    expect(JSON.parse(readFileSync(process.env.ENCORE_LEDGER!, "utf8")).spent).toBe(2);
  });

  it("resumes a saved task id instead of creating a new task", async () => {
    const api = fakeApi();
    const state = join(dir, "state.json");
    const live = new Live(state, "test", api.transport, 1);
    const signatureOwner = new Live(join(dir, "probe.json"), "test", api.transport, 1);
    await signatureOwner.task("look", T2I_PATH, { prompt: "x" }, 2, join(dir, "probe.jpg"), download);
    live.state.tasks.look = { ...signatureOwner.state.tasks.look, status: undefined, file: undefined, taskId: "already-paid" };
    const before = api.calls.create;
    await live.task("look", T2I_PATH, { prompt: "x" }, 2, join(dir, "o.jpg"), download);
    expect(api.calls.create).toBe(before);
  });

  it("holds a task whose creation outcome is unknown, and stops after two failures", async () => {
    const api = fakeApi({ fail: true });
    const live = new Live(join(dir, "state.json"), "test", api.transport, 1);
    live.state.tasks.held = { signature: "", creating: true, units: 2 };
    // Signature mismatch on a held creation is still refused, never resubmitted.
    await expect(live.task("held", T2I_PATH, { prompt: "x" }, 2, join(dir, "a.jpg"), download)).rejects.toThrow();
    expect(api.calls.create).toBe(0);
    await expect(live.task("bad", T2I_PATH, { prompt: "y" }, 2, join(dir, "b.jpg"), download)).rejects.toBeInstanceOf(StopRun);
    expect(api.calls.create).toBe(1);
  });

  it("refuses a run that exceeds the balance or the unit cap", async () => {
    await expect(Live.gate("t", 10, async () => 5)).rejects.toBeInstanceOf(StopRun);
    await expect(Live.gate("t", 301, async () => 1000)).rejects.toBeInstanceOf(StopRun);
    await expect(Live.gate("t", 20, async () => 100)).resolves.toBe(100);
  });
});

describe("showcase generation and render plans", () => {
  it("keeps every text-to-image prompt under 800 characters and sends the documented body", () => {
    for (const prompt of Object.values(ALL_PROMPTS)) expect(prompt.length).toBeLessThan(800);
    expect(textToImageBody("a coat")).toMatchObject({ model: "youcam-image-v2", size: "1104*1472", prompt_extend: false });
    expect(() => textToImageBody("x".repeat(800))).toThrow();
  });

  it("plans only the missing render for the look-by-look conflict image", () => {
    const p = gatsbyProduction(); p.plan = solve(p);
    const stages = plannedStages({ ...p, renders: {} }, ["l-none"], [parseExtra("l-nick:outer=g-black-jacket")]);
    expect(stages.map((s) => [s.lookId, s.stage, s.label])).toEqual([["l-nick", "base", "White evening shirt & black trousers"], ["l-nick", "outer", "Black satin-lapel dinner jacket"]]);
    expect(() => parseExtra("nick black jacket")).toThrow();
  });

  it("crops the head and pastes it back without touching the costume below", async () => {
    const W = 200, H = 300;
    const clothed = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 20, g: 120, b: 40 } } }).jpeg().toBuffer();
    const box = { x: 0.4, y: 0.05, w: 0.2, h: 0.15 };
    const crop = await cropHeadFile(clothed, box);
    expect((await sharp(crop).metadata()).width).toBe(1024);
    const head = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 230, g: 30, b: 30 } } }).jpeg().toBuffer();
    const out = await sharp(await pasteHeadFile(clothed, head, box)).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => out.data[(y * out.info.width + x) * out.info.channels];
    expect(out.info.width).toBe(W);
    expect(px(100, 38)).toBeGreaterThan(200); // face: the styled head
    expect(px(100, 250)).toBeLessThan(40);    // costume: unchanged
  });
});
