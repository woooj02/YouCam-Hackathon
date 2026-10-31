"use client";
/**
 * Studio state: the production, op replay, highlights for animations, and the
 * render queue. Task ids are written into the production before polling, so a
 * reload resumes in-flight renders instead of paying for them twice (the
 * YouCam API has no idempotency key).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOp, type Op, type OpResult } from "../engine/ops";
import { pendingStages, type StageSpec } from "../engine/render";
import type { Production, RenderRecord } from "../engine/types";
import { showcaseProduction } from "../showcase";
import { sketchFor } from "../sketch";
import { idbGet, idbSet } from "./idb";

type Status = { demo: boolean; agent: boolean };
export type Highlight = { lookIds: string[]; itemIds: string[]; at: number };

type Ctx = {
  production: Production | null;
  status: Status | null;
  setProduction: (p: Production | ((prev: Production) => Production)) => void;
  op: (op: Op) => OpResult | null;
  replay: (ops: Op[]) => OpResult[];
  highlight: Highlight | null;
  flash: (h: Omit<Highlight, "at">) => void;
  render: (lookIds?: string[]) => void;
  rendering: boolean;
  progress: { done: number; total: number };
  unitsSpent: number;
  resetToShowcase: () => Promise<void>;
  /** Put every piece back on the rack and re-plan, keeping photos and renders. For rehearsing the demo. */
  restoreRack: () => void;
  /** Drop a stage's render and every later stage in its chain, then render the look again. */
  redo: (lookId: string, keys: string[]) => void;
};

const StoreCtx = createContext<Ctx | null>(null);
const KEY = "production:v1";
const FILES_KEY = "fileIds:v1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A production exported after a real render session, if one is deployed with the app. */
async function bundledShowcase(): Promise<Production | undefined> {
  try {
    const res = await fetch("/showcase/production.json");
    if (!res.ok) return undefined;
    const p = (await res.json()) as Production;
    return p.looks?.length ? p : undefined;
  } catch {
    return undefined;
  }
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [production, setP] = useState<Production | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [unitsSpent, setUnitsSpent] = useState(0);
  const ref = useRef<Production | null>(null);
  const fileIds = useRef<Record<string, string>>({});
  const inflight = useRef(new Set<string>());
  const queueRun = useRef(false);

  const setProduction = useCallback((next: Production | ((prev: Production) => Production)) => {
    setP((prev) => {
      const value = typeof next === "function" ? (prev ? next(prev) : prev) : next;
      ref.current = value;
      return value;
    });
  }, []);

  // Load: ?showcase=1 forces the sample production; otherwise the saved one.
  useEffect(() => {
    (async () => {
      const forceShowcase = new URLSearchParams(location.search).has("showcase");
      const saved = forceShowcase ? undefined : await idbGet<Production>(KEY);
      fileIds.current = (await idbGet<Record<string, string>>(FILES_KEY)) ?? {};
      const p = saved ?? (await bundledShowcase()) ?? applyOp(showcaseProduction(), { type: "plan" }).production;
      ref.current = p;
      setP(p);
      try {
        setStatus(await (await fetch("/api/status")).json());
      } catch {
        setStatus({ demo: true, agent: false });
      }
    })();
  }, []);

  // Persist, debounced.
  useEffect(() => {
    if (!production) return;
    const t = setTimeout(() => idbSet(KEY, production), 400);
    return () => clearTimeout(t);
  }, [production]);

  const flash = useCallback((h: Omit<Highlight, "at">) => setHighlight({ ...h, at: Date.now() }), []);

  const op = useCallback(
    (o: Op) => {
      const cur = ref.current;
      if (!cur) return null;
      const r = applyOp(cur, o);
      ref.current = r.production;
      setP(r.production);
      const itemIds = r.changes.flatMap((c) => [c.from, c.to].filter(Boolean) as string[]);
      if ("itemId" in o) itemIds.push(o.itemId);
      flash({ lookIds: r.affected, itemIds });
      return r;
    },
    [flash],
  );

  const replay = useCallback((ops: Op[]) => ops.map((o) => op(o)).filter((r): r is OpResult => r !== null), [op]);

  const putRecord = useCallback((rec: RenderRecord) => {
    setProduction((prev) => ({ ...prev, renders: { ...prev.renders, [rec.key]: rec } }));
  }, [setProduction]);

  const runStage = useCallback(
    async (spec: StageSpec) => {
      const p = ref.current!;
      const look = p.looks.find((l) => l.id === spec.lookId)!;
      const prior = p.renders[spec.key];
      const base: RenderRecord = { key: spec.key, lookId: spec.lookId, stage: spec.stage, status: "running", startedAt: Date.now() };
      const fail = (error: string) => putRecord({ ...base, status: "error", error, finishedAt: Date.now() });

      if (status?.demo) {
        putRecord(base);
        await sleep(700 + Math.random() * 1100);
        putRecord({ ...base, status: "done", url: sketchFor(ref.current!, look, spec.stage), demo: true, finishedAt: Date.now() });
        return;
      }

      let taskId = prior?.status === "running" ? prior.taskId : undefined;
      if (!taskId) {
        const body: Record<string, unknown> = { job: spec.job };
        if (spec.parentKey) {
          const parent = p.renders[spec.parentKey];
          if (!parent?.url || parent.demo) return fail("Waiting on the previous stage");
          body.srcUrl = parent.url;
        } else {
          const role = p.roles.find((r) => r.id === look.roleId);
          const perf = p.performers.find((x) => x.id === role?.performerId);
          const photo = spec.chain === "body" ? perf?.bodyPhoto : perf?.portraitPhoto;
          if (!perf || !photo) return fail(`Add a ${spec.chain === "body" ? "full-body" : "close-up"} photo of ${perf?.name ?? "this performer"} in Setup`);
          const fk = `${perf.id}:${perf.photoVersion}:${spec.chain}`;
          if (!fileIds.current[fk]) {
            const up = await fetch("/api/youcam/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: photo }) });
            const uj = await up.json();
            if (!up.ok) return fail(uj.message ?? "Upload failed");
            fileIds.current[fk] = uj.fileId;
            idbSet(FILES_KEY, fileIds.current);
          }
          body.fileId = fileIds.current[fk];
        }
        const res = await fetch("/api/youcam/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await res.json();
        if (!res.ok) return fail(j.message ?? "Couldn't start the render");
        taskId = j.taskId as string;
        setUnitsSpent((u) => u + spec.units);
      }
      putRecord({ ...base, taskId });

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await sleep(2000);
        const res = await fetch(`/api/youcam/task?feature=${spec.feature}&taskId=${encodeURIComponent(taskId)}`);
        const j = await res.json();
        if (!res.ok) return fail(j.message ?? "Lost track of the render");
        if (j.status === "success") return putRecord({ ...base, taskId, status: "done", url: j.url, finishedAt: Date.now() });
        if (j.status === "error") return fail(j.message ?? j.code);
      }
      fail("Timed out. Try again.");
    },
    [putRecord, status],
  );

  const render = useCallback(
    (lookIds?: string[]) => {
      if (queueRun.current) return;
      queueRun.current = true;
      setRendering(true);
      (async () => {
        const total = pendingStages(ref.current!, lookIds).length;
        setProgress({ done: 0, total });
        let done = 0;
        const attempted = new Set<string>();
        for (;;) {
          const p = ref.current!;
          const pending = pendingStages(p, lookIds).filter((s) => !inflight.current.has(s.key) && !attempted.has(s.key));
          const ready = pending.filter((s) => !s.parentKey || p.renders[s.parentKey]?.status === "done");
          if (!ready.length && !inflight.current.size) break;
          const batch = ready.slice(0, Math.max(0, 4 - inflight.current.size));
          if (!batch.length) {
            await sleep(250);
            continue;
          }
          for (const s of batch) {
            inflight.current.add(s.key);
            attempted.add(s.key);
            runStage(s).finally(() => {
              inflight.current.delete(s.key);
              done++;
              setProgress({ done, total });
            });
          }
          await sleep(150);
        }
        queueRun.current = false;
        setRendering(false);
      })();
    },
    [runStage],
  );

  const resetToShowcase = useCallback(async () => {
    const p = (await bundledShowcase()) ?? applyOp(showcaseProduction(), { type: "plan" }).production;
    ref.current = p;
    setP(p);
  }, []);

  const restoreRack = useCallback(() => {
    const cur = ref.current;
    if (!cur) return;
    const back = {
      ...cur,
      inventory: cur.inventory.map((i) => ({ ...i, available: true })),
      shop: cur.shop.map((i) => ({ ...i, available: true })),
      looks: cur.looks.map((l) => ({ ...l, locked: false })),
      plan: null,
    };
    const p = applyOp(back, { type: "plan" }).production;
    ref.current = p;
    setP(p);
  }, []);

  const redo = useCallback(
    (lookId: string, keys: string[]) => {
      setProduction((prev) => {
        const renders = { ...prev.renders };
        for (const k of keys) delete renders[k];
        return { ...prev, renders };
      });
      setTimeout(() => render([lookId]), 50);
    },
    [render, setProduction],
  );

  const value = useMemo<Ctx>(
    () => ({ production, status, setProduction, op, replay, highlight, flash, render, rendering, progress, unitsSpent, resetToShowcase, restoreRack, redo }),
    [production, status, setProduction, op, replay, highlight, flash, render, rendering, progress, unitsSpent, resetToShowcase, restoreRack, redo],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStudio(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}
