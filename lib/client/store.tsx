"use client";
/** Production state, deterministic planner changes and a resumable render queue. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOp, type Op, type OpResult } from "../engine/ops";
import { allStages, dependencies, pendingStages, renderImpact, repairCost, type RenderImpact, type RepairCost, type StageSpec } from "../engine/render";
import { cropHead, pasteHead } from "./composite";
import { DEFAULT_HEAD_BOX } from "../engine/composite";
import type { Production, RenderRecord } from "../engine/types";
import { showcaseProduction } from "../showcase";
import { sketchFor } from "../sketch";
import { idbGet, idbSet } from "./idb";
import { imageDataUrl } from "./images";

type Status = { demo: boolean; agent: boolean };
export type Highlight = { lookIds: string[]; itemIds: string[]; at: number };
export type ChangeReport = RenderImpact & { at: number; summary: string; changes: OpResult["changes"]; cost: RepairCost };
type Ctx = {
  production: Production | null; status: Status | null;
  setProduction: (p: Production | ((prev: Production) => Production)) => void;
  op: (op: Op) => OpResult | null; replay: (ops: Op[]) => OpResult[];
  highlight: Highlight | null; changeReport: ChangeReport | null;
  flash: (h: Omit<Highlight, "at">) => void;
  render: (lookIds?: string[]) => void; rendering: boolean;
  progress: { done: number; total: number }; unitsSpent: number;
  resetToShowcase: () => Promise<void>; restoreRack: () => void;
  redo: (lookId: string, keys: string[]) => void;
};
const StoreCtx = createContext<Ctx | null>(null);
const KEY = "production:v1", FILES_KEY = "fileIds:v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Polled = { kind: "success"; url: string } | { kind: "error"; code?: string; message: string } | { kind: "failed"; message: string } | { kind: "timeout" };

/** Poll a YouCam task until it finishes. "error" is the engine's verdict; "failed" is the connection. */
async function pollTask(feature: string, taskId: string): Promise<Polled> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const response = await fetch(`/api/youcam/task?feature=${feature}&taskId=${encodeURIComponent(taskId)}`);
    const state = await response.json();
    if (response.status === 429) continue;
    if (!response.ok) return { kind: "failed", message: state.message ?? "Connection interrupted. Render again to resume this task." };
    if (state.status === "success" && state.url) return { kind: "success", url: state.url };
    if (state.status === "error") return { kind: "error", code: state.code, message: state.message ?? state.code };
  }
  return { kind: "timeout" };
}

/** Which public showcase this tab loaded: "1" is the Gatsby party, any other slug is /showcase/<slug>/. */
let showcaseName = "1";
export const showcaseUrl = (name: string) => (/^[a-z0-9-]+$/.test(name) && name !== "1" ? `/showcase/${name}/production.json` : "/showcase/production.json");

async function bundledShowcase(): Promise<Production | undefined> {
  const params = new URLSearchParams(location.search);
  showcaseName = params.get("showcase") || showcaseName;
  const publicOnly = params.has("public") || showcaseName !== "1";
  const rehearsal = params.has("film") ? "/api/showcase?take=film" : "/api/showcase";
  const bundle = showcaseUrl(showcaseName);
  for (const url of publicOnly ? [bundle] : [rehearsal, bundle]) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const production = await response.json() as Production;
      if (production.looks?.length) return production;
    } catch { /* Continue to the next available bundle. */ }
  }
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [production, setP] = useState<Production | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [changeReport, setChangeReport] = useState<ChangeReport | null>(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [unitsSpent, setUnitsSpent] = useState(0);
  const ref = useRef<Production | null>(null);
  const fileIds = useRef<Record<string, string>>({});
  const uploading = useRef(new Map<string, Promise<string>>());
  const inflight = useRef(new Set<string>());
  const queueRun = useRef(false);
  const resumed = useRef(false);

  const setProduction = useCallback((next: Production | ((prev: Production) => Production)) => {
    const current = ref.current;
    if (!current && typeof next === "function") return;
    const value = typeof next === "function" ? next(current!) : next;
    ref.current = value;
    setP(value);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const force = new URLSearchParams(location.search).has("showcase");
      const saved = force ? undefined : await idbGet<Production>(KEY);
      fileIds.current = await idbGet<Record<string, string>>(FILES_KEY) ?? {};
      const p = saved ?? await bundledShowcase() ?? applyOp(showcaseProduction(), { type: "plan" }).production;
      if (!active) return;
      ref.current = p; setP(p);
      void idbSet(KEY, p);
      if (force) {
        // Loading the showcase is a one-time action. A reload must resume the
        // saved production and its task ids rather than overwrite it again.
        const url = new URL(location.href);
        url.searchParams.delete("showcase");
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      }
      try {
        const next = await (await fetch("/api/status")).json();
        if (active) setStatus(next);
      } catch { if (active) setStatus({ demo: true, agent: false }); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!production) return;
    const timer = setTimeout(() => { void idbSet(KEY, production); }, 400);
    return () => clearTimeout(timer);
  }, [production]);

  const flash = useCallback((h: Omit<Highlight, "at">) => setHighlight({ ...h, at: Date.now() }), []);
  const op = useCallback((operation: Op) => {
    const current = ref.current;
    if (!current) return null;
    const result = applyOp(current, operation);
    setProduction(result.production);
    void idbSet(KEY, result.production);
    const impact = renderImpact(current, result.production);
    if (impact.changedKeys.length) setChangeReport({ ...impact, at: Date.now(), summary: result.summary, changes: result.changes, cost: repairCost(current, result.production) });
    const itemIds = result.changes.flatMap((change) => [change.from, change.to].filter(Boolean) as string[]);
    if ("itemId" in operation) itemIds.push(operation.itemId);
    flash({ lookIds: result.affected, itemIds });
    return result;
  }, [flash, setProduction]);
  const replay = useCallback((ops: Op[]) => ops.map(op).filter((result): result is OpResult => result !== null), [op]);

  const putRecord = useCallback((record: RenderRecord) => {
    const current = ref.current!;
    const next = { ...current, renders: { ...current.renders, [record.key]: record } };
    setProduction(next);
    return next;
  }, [setProduction]);

  const ensureFile = useCallback(async (image: string, key: string) => {
    if (fileIds.current[key]) return fileIds.current[key];
    const pending = uploading.current.get(key);
    if (pending) return pending;
    const promise = (async () => {
      const source = await imageDataUrl(image);
      const response = await fetch("/api/youcam/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: source }) });
      const body = await response.json();
      if (!response.ok || !body.fileId) throw new Error(body.message ?? "Upload failed");
      fileIds.current[key] = body.fileId;
      await idbSet(FILES_KEY, fileIds.current);
      return body.fileId as string;
    })();
    uploading.current.set(key, promise);
    try { return await promise; } finally { uploading.current.delete(key); }
  }, []);

  const runStage = useCallback(async (spec: StageSpec) => {
    const p = ref.current!, look = p.looks.find((item) => item.id === spec.lookId)!;
    const prior = p.renders[spec.key];
    let taskId = prior?.taskId;
    let creationPending = prior?.creationPending ?? false;
    const base: RenderRecord = { key: spec.key, lookId: spec.lookId, stage: spec.stage, status: "running", startedAt: prior?.startedAt ?? Date.now() };
    const persist = async (record: RenderRecord) => { await idbSet(KEY, putRecord(record)); };
    const fail = async (error: string, terminal = false) => {
      await persist({ ...base, taskId: terminal ? undefined : taskId, creationPending, status: "error", error, finishedAt: Date.now() });
    };
    try {
      if (status?.demo) {
        putRecord(base); await sleep(700);
        await persist({ ...base, status: "done", url: sketchFor(ref.current!, look, spec.stage), demo: true, units: 0, finishedAt: Date.now() });
        return;
      }
      if (spec.feature === "composite") {
        // Local step: paste the styled head onto the clothed render. No API call, no units.
        const head = spec.parentKey ? ref.current!.renders[spec.parentKey] : undefined;
        const clothed = spec.baseKey ? ref.current!.renders[spec.baseKey] : undefined;
        if (!head?.url || !clothed?.url || !spec.crop) return await fail("Waiting on the styled head and the costume");
        const url = await pasteHead(await imageDataUrl(clothed.url), await imageDataUrl(head.url), spec.crop);
        return await persist({ ...base, status: "done", url, demo: false, composite: true, units: 0, finishedAt: Date.now() });
      }
      if (creationPending && !taskId) return await fail("The last request may have started. Check the account activity before choosing Redo this layer.");
      putRecord({ ...base, taskId });
      if (!taskId) {
        const body: Record<string, unknown> = { job: spec.job };
        if (spec.crop) {
          // Complete-look head: crop from the clothed render or the full-body photo, then upload the crop once.
          const role = p.roles.find((item) => item.id === look.roleId);
          const performer = p.performers.find((item) => item.id === role?.performerId);
          const source = spec.parentKey ? ref.current!.renders[spec.parentKey]?.url : performer?.bodyPhoto;
          if (!source) return await fail(spec.parentKey ? "Waiting on the costume render" : "Add a full-body photo in Cast & rack");
          const cropKey = `crop:${p.id}:${spec.key}`;
          body.fileId = fileIds.current[cropKey] ?? await ensureFile(await cropHead(await imageDataUrl(source), spec.crop), cropKey);
        } else if (spec.parentKey) {
          const parent = ref.current!.renders[spec.parentKey];
          if (!parent?.url || parent.demo) return await fail("Waiting on the previous stage");
          if (/^https:\/\//.test(parent.url)) body.srcUrl = parent.url;
          else body.fileId = await ensureFile(parent.url, `render:${p.id}:${parent.key}`);
        } else {
          const role = p.roles.find((item) => item.id === look.roleId);
          const performer = p.performers.find((item) => item.id === role?.performerId);
          const photo = spec.chain === "body" ? performer?.bodyPhoto : performer?.portraitPhoto;
          if (!performer || !photo) return await fail(`Add a ${spec.chain === "body" ? "full-body" : "close-up"} photo of ${performer?.name ?? "this performer"} in Cast & rack`);
          body.fileId = await ensureFile(photo, `photo:${p.id}:${performer.id}:${performer.photoVersion}:${spec.chain}`);
        }
        creationPending = true;
        await persist({ ...base, creationPending });
        const response = await fetch("/api/youcam/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const created = await response.json();
        if (!response.ok) { creationPending = response.status >= 500; return await fail(created.message ?? "Couldn't start the render"); }
        if (created.demo) {
          creationPending = false;
          return await persist({ ...base, status: "done", demo: true, units: 0, url: sketchFor(ref.current!, look, spec.stage), finishedAt: Date.now() });
        }
        if (!created.taskId) return await fail("The server returned no task id. Check activity before retrying.");
        taskId = created.taskId; creationPending = false;
      }
      // Persist the task id before polling; errors and timeouts keep it for resumption.
      await persist({ ...base, taskId, creationPending: false });
      const state = await pollTask(spec.feature, taskId!);
      if (state.kind === "success") {
        // Signed result URLs expire. Keep finished pixels with the production.
        const url = await imageDataUrl(state.url);
        setUnitsSpent((units) => units + spec.units);
        return await persist({ ...base, taskId, status: "done", url, demo: false, units: spec.units, finishedAt: Date.now() });
      }
      const parent = spec.parentKey ? ref.current!.renders[spec.parentKey] : undefined;
      if (state.kind === "error" && state.code === "error_no_face" && spec.stage === "look-makeup" && !spec.crop && parent?.url) {
        // In a full-length image the face can be too small for makeup to find. Retry on a head crop of the
        // same image and paste it back; the record says it is a composite. (The failed task is not charged.)
        const role = p.roles.find((item) => item.id === look.roleId);
        const box = p.performers.find((item) => item.id === role?.performerId)?.headBox ?? DEFAULT_HEAD_BOX;
        const parentImage = await imageDataUrl(parent.url);
        await persist({ ...base, taskId: undefined, creationPending: false });
        const fileId = await ensureFile(await cropHead(parentImage, box), `crop:${p.id}:${spec.key}:no-face`);
        const response = await fetch("/api/youcam/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job: spec.job, fileId }) });
        const created = await response.json();
        if (!response.ok || !created.taskId) return await fail(created.message ?? "Couldn't start the head-crop retry", true);
        const retry = await pollTask(spec.feature, created.taskId);
        if (retry.kind !== "success") return await fail(retry.kind === "error" ? retry.message : "The head-crop retry is still processing. Render again.", true);
        const url = await pasteHead(parentImage, await imageDataUrl(retry.url), box);
        setUnitsSpent((units) => units + spec.units);
        return await persist({ ...base, status: "done", url, demo: false, composite: true, units: spec.units, finishedAt: Date.now() });
      }
      if (state.kind === "error") return await fail(state.message, true);
      if (state.kind === "failed") return await fail(state.message);
      await fail("Still processing. Render again to resume this task.");
    } catch (error) { await fail(error instanceof Error ? error.message : "Render interrupted. Try again to resume."); }
  }, [ensureFile, putRecord, status]);

  const render = useCallback((lookIds?: string[]) => {
    if (!ref.current || !status || queueRun.current) return;
    queueRun.current = true; setRendering(true);
    void (async () => {
      const total = pendingStages(ref.current!, lookIds, !status.demo).length;
      let done = 0;
      const attempted = new Set<string>();
      setProgress({ done, total });
      try {
        for (;;) {
          const current = ref.current!;
          const pending = pendingStages(current, lookIds, !status.demo).filter((stage) => !inflight.current.has(stage.key) && !attempted.has(stage.key));
          const ready = pending.filter((stage) => dependencies(stage).every((key) => current.renders[key]?.status === "done" && (status.demo || !current.renders[key]?.demo)));
          if (!ready.length && !inflight.current.size) break;
          for (const stage of ready.slice(0, Math.max(0, 3 - inflight.current.size))) {
            inflight.current.add(stage.key); attempted.add(stage.key);
            void runStage(stage).catch((error) => {
              putRecord({ ...ref.current!.renders[stage.key], key: stage.key, lookId: stage.lookId, stage: stage.stage, status: "error", error: error instanceof Error ? error.message : "Render interrupted" });
            }).finally(() => { inflight.current.delete(stage.key); done++; setProgress({ done, total: Math.max(total, done) }); });
          }
          await sleep(150);
        }
      } finally { queueRun.current = false; setRendering(false); }
    })();
  }, [putRecord, runStage, status]);

  useEffect(() => {
    if (!production || !status || resumed.current) return;
    resumed.current = true;
    const interrupted = pendingStages(production, undefined, !status.demo).filter((stage) => {
      const record = production.renders[stage.key];
      return record?.status === "running" && record.taskId;
    });
    if (interrupted.length) render([...new Set(interrupted.map((stage) => stage.lookId))]);
  }, [production, render, status]);

  const resetToShowcase = useCallback(async () => {
    if (queueRun.current) return;
    setProduction(await bundledShowcase() ?? applyOp(showcaseProduction(), { type: "plan" }).production);
    setChangeReport(null); setHighlight(null);
  }, [setProduction]);
  const restoreRack = useCallback(() => {
    const current = ref.current;
    if (!current || queueRun.current) return;
    const restored = { ...current, inventory: current.inventory.map((item) => ({ ...item, available: true })), shop: current.shop.map((item) => ({ ...item, available: true })), looks: current.looks.map((look) => ({ ...look, locked: false })), plan: null };
    const next = applyOp(restored, { type: "plan" }).production;
    setProduction(next); void idbSet(KEY, next); setChangeReport(null); setHighlight(null);
  }, [setProduction]);
  const redo = useCallback((lookId: string, keys: string[]) => {
    if (queueRun.current) return;
    setProduction((current) => {
      // Also drop every finished layer that reads from a redone one (e.g. the composite).
      const drop = new Set(keys);
      const stages = allStages(current).filter((stage) => stage.lookId === lookId);
      for (let grew = true; grew;) {
        grew = false;
        for (const stage of stages) if (!drop.has(stage.key) && dependencies(stage).some((key) => drop.has(key))) { drop.add(stage.key); grew = true; }
      }
      const renders = { ...current.renders }; for (const key of drop) delete renders[key]; return { ...current, renders };
    });
    render([lookId]);
  }, [render, setProduction]);

  const value = useMemo<Ctx>(() => ({ production, status, setProduction, op, replay, highlight, changeReport, flash, render, rendering, progress, unitsSpent, resetToShowcase, restoreRack, redo }),
    [production, status, setProduction, op, replay, highlight, changeReport, flash, render, rendering, progress, unitsSpent, resetToShowcase, restoreRack, redo]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
export function useStudio(): Ctx { const value = useContext(StoreCtx); if (!value) throw new Error("useStudio must be used inside StudioProvider"); return value; }
