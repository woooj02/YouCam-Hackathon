"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/client/store";
import { itemById, lookState, money, performerOf, SLOT_LABEL, SOURCE_LABEL } from "@/lib/client/view";
import { API_NAME } from "@/lib/engine/render";
import type { HairSpec } from "@/lib/engine/types";
import { swatchFor } from "@/lib/sketch";

type Template = { id: string; title: string; thumb: string };

export function LookDrawer({ lookId, onClose }: { lookId: string; onClose: () => void }) {
  const { production: p, setProduction, op, render, rendering } = useStudio();
  const [templates, setTemplates] = useState<Template[] | null>(null);

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

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rise scrollbar-thin h-full w-full max-w-3xl overflow-y-auto border-l border-line bg-ink p-6" onClick={(e) => e.stopPropagation()}>
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
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-paper">
            Close
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => render([look.id])} disabled={rendering} className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-50">
            {s.done ? "Re-check renders" : "Render this look"}
          </button>
          <button onClick={() => op({ type: "lock", lookId: look.id, locked: !look.locked })} className="rounded-full border border-line px-4 py-2 text-sm hover:border-gold">
            {look.locked ? "Unlock look" : "Approve & lock look"}
          </button>
        </div>

        {(["body", "portrait"] as const).map((c) => (
          <section key={c} className="mt-8">
            <h3 className="text-xs uppercase tracking-wider text-muted">{c === "body" ? "Costume chain" : "Hair, makeup & headwear chain"}</h3>
            <div className="scrollbar-thin mt-3 flex gap-3 overflow-x-auto pb-2">
              <Stage title={c === "body" ? "Full-body photo" : "Close-up photo"} img={root(c)} sub={performer?.name ?? ""} error={root(c) ? undefined : "Add a photo in Cast & rack"} />
              {chain(c).map(({ spec, record }) => (
                <Stage
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
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {look.requirements.map((r) => {
              const it = itemById(p, a[r.slot]);
              return (
                <li key={r.slot} className="rounded-xl border border-line p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted">{SLOT_LABEL[r.slot]}{r.optional ? " · optional" : ""}</div>
                  {it ? (
                    <div className="mt-2 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image?.startsWith("data:") || it.image?.startsWith("http") ? it.image : swatchFor(it)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm">{it.name}</div>
                        <div className="text-[11px] text-muted">{SOURCE_LABEL[it.source]}{it.cost ? ` · ${money(p, it.cost)}` : ""}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gold">To source</div>
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
              className="accent-[#e8b04b]"
            />
            Keep {performer?.name}&apos;s own hair colour
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button onClick={() => setHair(undefined)} className={`rounded-xl border p-2 text-xs ${!look.hair ? "border-gold text-gold" : "border-line text-muted"}`}>
              Their own hair
            </button>
            {(templates ?? []).slice(0, 14).map((t) => (
              <button
                key={t.id}
                onClick={() => setHair({ templateId: t.id, label: t.title, thumb: t.thumb, keepColor: look.hair?.keepColor ?? true })}
                className={`overflow-hidden rounded-xl border text-xs ${look.hair?.templateId === t.id ? "border-gold text-gold" : "border-line text-muted"}`}
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
          </section>
        ) : (
          <div className="pb-24" />
        )}
      </div>
    </div>
  );
}

function Stage({ title, sub, img, api, units, busy, error, demo }: { title: string; sub: string; img?: string; api?: string; units?: number; busy?: boolean; error?: string; demo?: boolean }) {
  return (
    <div className="w-44 shrink-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-panel">
        {busy ? <div className="shimmer absolute inset-0" /> : null}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={title} className="curtain h-full w-full object-cover" />
        ) : !busy ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted">{error ?? "Not rendered"}</div>
        ) : null}
        {demo ? <span className="absolute left-2 top-2 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] text-gold">sketch</span> : null}
      </div>
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="truncate text-xs text-muted">{sub}</div>
      {api ? (
        <div className="mt-1 text-[10px] uppercase tracking-wide text-gold/80">
          {api}
          {units ? ` · ${units}u` : ""}
        </div>
      ) : null}
      {error && img ? <div className="mt-1 text-[11px] text-alarm">{error}</div> : null}
    </div>
  );
}
