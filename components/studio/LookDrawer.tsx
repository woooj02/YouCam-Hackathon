"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/client/store";
import { itemById, lookState, money, performerOf, SLOT_LABEL, SOURCE_LABEL } from "@/lib/client/view";
import { API_NAME } from "@/lib/engine/render";
import type { HairSpec } from "@/lib/engine/types";
import { ImageComparison } from "./ImageComparison";
import { ItemImage } from "./ItemImage";

type Template = { id: string; title: string; thumb: string };

export function LookDrawer({ lookId, onClose }: { lookId: string; onClose: () => void }) {
  const { production: p, setProduction, op, render, rendering, redo } = useStudio();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [selected, setSelected] = useState("costume");
  const [hairSearch, setHairSearch] = useState("");

  useEffect(() => {
    fetch("/api/youcam/templates?feature=hair-transfer")
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!p) return null;
  const look = p.looks.find((l) => l.id === lookId);
  if (!look) return null;
  const { role, performer } = performerOf(p, look);
  const s = lookState(p, look.id);
  const a = p.plan?.assignment[look.id] ?? {};

  const setHair = (hair: HairSpec | undefined) =>
    setProduction((prev) => ({ ...prev, looks: prev.looks.map((l) => (l.id === look.id ? { ...l, hair } : l)) }));

  const chain = (c: "body" | "portrait") => s.stages.filter((x) => x.spec.chain === c);
  const root = (c: "body" | "portrait") => (c === "body" ? performer?.bodyPhoto : performer?.portraitPhoto);
  const selectedStage = selected === "costume" ? chain("body").at(-1) : s.stages.find((stage) => stage.spec.stage === selected);
  const before = selected === "costume" ? root("body") : selectedStage?.spec.parentKey ? p.renders[selectedStage.spec.parentKey]?.url : selectedStage && root(selectedStage.spec.chain);
  const after = selectedStage?.record?.url;
  const comparisonLabel = selected === "costume" ? "Complete costume" : selectedStage?.spec.label ?? selected;

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end bg-fg/25 backdrop-blur-sm" onClick={onClose}>
      <div className="rise scrollbar-thin h-full w-full max-w-3xl overflow-y-auto border-l border-line bg-canvas p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">
              {role?.name} · {performer?.name} · size {performer?.size}
            </div>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl">{look.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Scenes: {look.sceneIds.map((id) => p.scenes.find((x) => x.id === id)?.name).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-fg">
            Close
          </button>
        </div>

        {look.direction ? <p className="mt-4 rounded-xl bg-panel p-4 text-sm leading-relaxed">{look.direction}</p> : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]" aria-label="Look comparison">
          <div>
            {before && after ? <ImageComparison key={`${look.id}:${selected}:${after.slice(-30)}`} before={before} after={after} label={comparisonLabel} framing={selectedStage?.spec.chain === "body" ? performer?.bodyFraming : undefined} /> : <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-panel p-6 text-center text-sm text-muted">{selectedStage?.record?.error ?? "Render this layer to compare it with its source photo."}</div>}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted">Inspect the changes</h3>
            <div className="mt-3 flex flex-col gap-2">
              {[{ id: "costume", title: "Complete costume" }, ...s.stages.filter((stage) => stage.spec.stage !== "base").map(({ spec }) => ({ id: spec.stage, title: spec.stage === "outer" ? "Outer layer only" : spec.stage === "hair" ? "Hair only" : "Makeup only" }))].map((option) => <button key={option.id} onClick={() => setSelected(option.id)} aria-pressed={selected === option.id} className={`rounded-xl border px-3 py-3 text-left text-sm ${selected === option.id ? "border-accent bg-accent/5 text-accent" : "border-line text-muted hover:border-accent"}`}>{option.title}</button>)}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">Costume and close-up styling use separate source photos. Compare a single layer to see exactly what it changed.</p>
            {selectedStage ? <p className="mt-3 text-[11px] text-accent">{API_NAME[selectedStage.spec.feature]} · {selectedStage.spec.units} units per new render</p> : null}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => render([look.id])} disabled={rendering} className="rounded-full grad px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {s.done ? "Re-check renders" : "Render this look"}
          </button>
          <button onClick={() => op({ type: "lock", lookId: look.id, locked: !look.locked })} disabled={rendering || (!s.done && !look.locked)} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-40">
            {look.locked ? "Unlock look" : "Approve & lock look"}
          </button>
        </div>

        {(["body", "portrait"] as const).map((c) => (
          <section key={c} className="mt-8">
            <h3 className="text-xs uppercase tracking-wider text-muted">{c === "body" ? "Costume chain" : "Hair & makeup chain"}</h3>
            <div className="scrollbar-thin mt-3 flex gap-3 overflow-x-auto pb-2">
              <Stage title={c === "body" ? "Full-body photo" : "Close-up photo"} img={root(c)} sub={performer?.name ?? ""} error={root(c) ? undefined : "Add a photo in Cast & rack"} />
              {chain(c).map(({ spec, record }, i, all) => (
                <Stage
                  onRedo={!rendering && (record?.status === "done" || record?.status === "error") ? () => redo(look.id, all.slice(i).map((x) => x.spec.key)) : undefined}
                  onInspect={() => setSelected(spec.stage)}
                  key={spec.key}
                  title={spec.stage === "base" ? "Costume" : spec.stage === "outer" ? "Outer layer" : spec.stage === "hair" ? "Hairstyle" : spec.stage === "makeup" ? "Makeup" : "Headwear"}
                  sub={spec.label}
                  api={API_NAME[spec.feature]}
                  units={spec.units}
                  img={record?.url}
                  busy={record?.status === "running"}
                  error={record?.status === "error" ? record.error : undefined}
                  demo={record?.demo}
                />
              ))}
              {!chain(c).length ? <p className="self-center text-sm text-muted">Nothing planned for this chain yet.</p> : null}
            </div>
          </section>
        ))}

        <section className="mt-8">
          <h3 className="text-xs uppercase tracking-wider text-muted">Pieces from the plan</h3>
          {a.hat ? <p className="mt-2 text-xs text-muted">Headwear is included in the pull list. Confirm its appearance at the physical fitting; it is not rendered in this preview.</p> : null}
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {look.requirements.map((r) => {
              const it = itemById(p, a[r.slot]);
              return (
                <li key={r.slot} className="rounded-xl border border-line p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted">{SLOT_LABEL[r.slot]}{r.optional ? " · optional" : ""}</div>
                  {it ? (
                    <div className="mt-2 flex items-center gap-2">
                      <ItemImage item={it} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm">{it.name}</div>
                        <div className="text-[11px] text-muted">{SOURCE_LABEL[it.source]}{it.cost ? ` · ${money(p, it.cost)}` : ""}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-accent">To source</div>
                  )}
                  <div className="mt-2 text-[11px] text-muted">Brief: {[...(r.colors ?? []), ...r.tags].join(", ")}</div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-8">
          <h3 className="text-xs uppercase tracking-wider text-muted">Hair direction</h3>
          <p className="mt-1 text-xs text-muted">A direction for the wig or styling team, rendered on the performer. It doesn&apos;t certify a specific wig.</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={look.hair?.keepColor ?? true}
              onChange={(e) => look.hair && setHair({ ...look.hair, keepColor: e.target.checked })}
              className="accent-[#d23a74]"
            />
            Keep {performer?.name}&apos;s own hair colour
          </label>
          {look.hair ? <p className="mt-3 text-sm text-accent">Selected: {look.hair.label}</p> : null}
          <input aria-label="Search hairstyles" placeholder="Search hairstyles…" value={hairSearch} onChange={(event) => setHairSearch(event.target.value)} className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button onClick={() => setHair(undefined)} className={`rounded-xl border p-2 text-xs ${!look.hair ? "border-accent text-accent" : "border-line text-muted"}`}>
              Their own hair
            </button>
            {(templates ?? []).filter((t) => `${t.title} ${t.id}`.toLowerCase().includes(hairSearch.toLowerCase())).slice(0, 24).map((t) => (
              <button
                key={t.id}
                onClick={() => setHair({ templateId: t.id, label: t.title, thumb: t.thumb, keepColor: look.hair?.keepColor ?? true })}
                className={`overflow-hidden rounded-xl border text-xs ${look.hair?.templateId === t.id ? "border-accent text-accent" : "border-line text-muted"}`}
              >
                {t.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumb} alt="" className="aspect-square w-full object-cover" />
                ) : null}
                <div className="truncate p-1.5">{t.title}</div>
              </button>
            ))}
            {templates === null ? <div className="shimmer col-span-2 h-16 rounded-xl" /> : null}
          </div>
        </section>

        {look.makeup ? (
          <section className="mt-8 pb-24">
            <h3 className="text-xs uppercase tracking-wider text-muted">Makeup direction</h3>
            <div className="mt-2 flex items-center gap-3 text-sm">
              {look.makeup.lip ? <span className="h-6 w-6 rounded-full border border-line" style={{ background: look.makeup.lip.color }} /> : null}
              {look.makeup.foundation ? <span className="h-6 w-6 rounded-full border border-line" style={{ background: look.makeup.foundation.color }} /> : null}
              <span>{look.makeup.label}</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {look.makeup.lip ? <li>Lip: {look.makeup.lip.color} · {look.makeup.lip.texture} · intensity {look.makeup.lip.intensity ?? 70}/100</li> : null}
              {look.makeup.foundation ? <li>Foundation: {look.makeup.foundation.color} · coverage {look.makeup.foundation.coverage}/100 · glow {look.makeup.foundation.glow ?? 20}/100</li> : null}
              {look.makeup.smooth !== undefined ? <li>Skin smoothing: {look.makeup.smooth}/100</li> : null}
            </ul>
          </section>
        ) : (
          <div className="pb-24" />
        )}
      </div>
    </div>
  );
}

function Stage({ title, sub, img, api, units, busy, error, demo, onRedo, onInspect }: { title: string; sub: string; img?: string; api?: string; units?: number; busy?: boolean; error?: string; demo?: boolean; onRedo?: () => void; onInspect?: () => void }) {
  return (
    <div className="w-44 shrink-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-panel">
        {busy ? <div className="shimmer absolute inset-0" /> : null}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={title} className="curtain h-full w-full object-contain" />
        ) : !busy ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted">{error ?? "Not rendered"}</div>
        ) : null}
        {demo ? <span className="absolute left-2 top-2 rounded bg-white/90 shadow-sm backdrop-blur px-1.5 py-0.5 text-[10px] text-accent">sketch</span> : null}
      </div>
      {onInspect ? <button onClick={onInspect} className="mt-2 text-[11px] text-accent underline underline-offset-2">Compare this layer</button> : null}
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="truncate text-xs text-muted">{sub}</div>
      {api ? (
        <div className="mt-1 text-[10px] uppercase tracking-wide text-accent/80">
          {api}
          {units ? ` · ${units}u` : ""}
        </div>
      ) : null}
      {error && img ? <div className="mt-1 text-[11px] text-alarm">{error}</div> : null}
      {onRedo ? (
        <button onClick={onRedo} className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline">
          Redo this layer
        </button>
      ) : null}
    </div>
  );
}
