"use client";
import Link from "next/link";
import { useState } from "react";
import { useStudio } from "@/lib/client/store";
import { fileToDataUrl } from "@/lib/client/idb";
import { money, SLOT_LABEL, SOURCE_LABEL } from "@/lib/client/view";
import { applyBreakdown, type BreakdownData } from "@/lib/breakdown";
import { applyOp } from "@/lib/engine/ops";
import type { GarmentCategory, Item, ItemSource, Slot } from "@/lib/engine/types";
import { swatchFor } from "@/lib/sketch";

type Tab = "brief" | "cast" | "rack";

export default function Setup() {
  const [tab, setTab] = useState<Tab>("cast");
  const { production: p } = useStudio();
  if (!p) return null;
  return (
    <main className="spotlight min-h-screen pb-24">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/studio" className="font-[family-name:var(--font-display)] text-sm font-extrabold tracking-[0.25em] grad-text">
            ENCORE
          </Link>
          <Link href="/studio" className="rounded-full grad px-5 py-2 text-sm font-medium text-white">Back to the studio</Link>
        </div>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl">{p.title}</h1>
        <div className="mt-6 flex gap-1 rounded-full border border-line bg-surface p-1 text-sm">
          {(["brief", "cast", "rack"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full px-4 py-2 capitalize ${tab === t ? "bg-panel text-fg" : "text-muted"}`}>
              {t === "brief" ? "1 · Brief" : t === "cast" ? "2 · Cast photos" : "3 · Rack"}
            </button>
          ))}
        </div>
        <div className="mt-8">{tab === "brief" ? <Brief /> : tab === "cast" ? <Cast /> : <Rack />}</div>
      </div>
    </main>
  );
}

function Brief() {
  const { production: p, setProduction } = useStudio();
  const [brief, setBrief] = useState(p!.brief);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BreakdownData | null>(null);

  async function breakdown() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/breakdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      setDraft(j.breakdown);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Describe the show the way you would to your wardrobe team. ENCORE drafts the breakdown; you correct it before anything is planned.</p>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={12} className="w-full rounded-2xl border border-line bg-surface shadow-card p-4 text-sm leading-relaxed outline-none focus:border-accent" />
      <button onClick={breakdown} disabled={busy} className="rounded-full grad px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Reading the brief…" : "Draft the breakdown"}
      </button>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      {draft ? (
        <div className="rise space-y-4 rounded-2xl border border-line bg-surface shadow-card p-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl">{draft.title}</div>
            <p className="text-sm text-muted">{draft.logline}</p>
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted">Scenes</div>
              <ol className="mt-1 list-decimal pl-5">{draft.scenes.map((s) => <li key={s.name}>{s.name}</li>)}</ol>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted">Roles</div>
              <ul className="mt-1">{draft.roles.map((r) => <li key={r.name}>{r.name} <span className="text-muted">· {r.performer}</span></li>)}</ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted">Looks</div>
              <ul className="mt-1">{draft.looks.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
            </div>
          </div>
          {draft.questions.length ? (
            <div className="rounded-xl bg-panel p-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-accent">Worth confirming</div>
              <ul className="mt-1 list-disc pl-5">{draft.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          ) : null}
          <button
            onClick={() => {
              setProduction((prev) => applyOp(applyBreakdown(prev, draft, brief), { type: "plan" }).production);
              setDraft(null);
            }}
            className="rounded-full grad px-5 py-2 text-sm font-medium text-white"
          >
            Use this breakdown and plan it
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Cast() {
  const { production: p, setProduction } = useStudio();
  const update = (id: string, patch: Record<string, unknown>) =>
    setProduction((prev) => ({ ...prev, performers: prev.performers.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  async function photo(id: string, kind: "bodyPhoto" | "portraitPhoto", file?: File) {
    if (!file) return;
    const url = await fileToDataUrl(file, kind === "bodyPhoto" ? 1600 : 1200);
    setProduction((prev) => ({
      ...prev,
      performers: prev.performers.map((x) => (x.id === id ? { ...x, [kind]: url, photoVersion: x.photoVersion + 1 } : x)),
    }));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        One full-body photo (head to toe, plain background, arms slightly away from the body) and one close-up (face forward, even light) per performer.
        Only photograph adults who have agreed to it. Photos stay in this browser and go only to the YouCam API to render.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {p!.performers.map((perf) => (
          <div key={perf.id} className="rounded-2xl border border-line bg-surface shadow-card p-4">
            <div className="flex flex-wrap gap-2">
              <input value={perf.name} onChange={(e) => update(perf.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm" />
              <select value={perf.size} onChange={(e) => update(perf.id, { size: e.target.value })} className="rounded-lg border border-line bg-panel px-2 text-sm">
                {["XS", "S", "M", "L", "XL", "XXL"].map((s) => <option key={s}>{s}</option>)}
              </select>
              <select aria-label="Hat fit" title="Hat fit" value={perf.hatFit ?? "female"} onChange={(e) => update(perf.id, { hatFit: e.target.value as "male" | "female" })} className="basis-full rounded-lg border border-line bg-panel px-2 py-1.5 text-sm">
                <option value="female">Women&apos;s hats</option>
                <option value="male">Men&apos;s hats</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["bodyPhoto", "portraitPhoto"] as const).map((k) => (
                <label key={k} className="relative block aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-dashed border-line bg-panel hover:border-accent">
                  {perf[k] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={perf[k]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted">{k === "bodyPhoto" ? "Full-body photo" : "Close-up photo"}</span>
                  )}
                  <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => photo(perf.id, k, e.target.files?.[0])} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY = { name: "", slot: "base" as Slot, garmentCategory: "auto" as GarmentCategory, colors: "", tags: "", sizes: "M", qty: 1, source: "owned" as ItemSource, cost: 0, vendor: "" };

function Rack() {
  const { production: p, setProduction, op } = useStudio();
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    const url = await fileToDataUrl(file, 1024);
    setImage(url);
    setTagging(true);
    setNote(null);
    try {
      const res = await fetch("/api/tag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: url }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      const t = j.tag;
      if (!t.usable) setNote("That photo may not show one clear piece. Check the tags.");
      setForm((f) => ({ ...f, name: t.name, slot: t.slot, garmentCategory: t.garmentCategory, colors: t.colors.join(", "), tags: t.tags.join(", ") }));
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setTagging(false);
    }
  }

  function add() {
    const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const item: Item = {
      id: `i-${Date.now().toString(36)}`,
      name: form.name || "Untitled piece",
      slot: form.slot,
      garmentCategory: form.slot === "outer" ? "outer" : form.garmentCategory,
      colors: list(form.colors),
      tags: list(form.tags),
      sizes: form.sizes.split(/[,/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
      qty: Math.max(1, form.qty),
      source: form.source,
      cost: form.source === "owned" ? 0 : form.cost,
      vendor: form.vendor || undefined,
      image: image ?? undefined,
      available: true,
    };
    setProduction((prev) => ({ ...prev, inventory: [...prev.inventory, item] }));
    setForm(EMPTY);
    setImage(null);
    setTimeout(() => op({ type: "plan" }), 50);
  }

  async function replacePhoto(id: string, file?: File) {
    if (!file) return;
    const url = await fileToDataUrl(file, 1024);
    setProduction((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => (i.id === id ? { ...i, image: url } : i)),
      shop: prev.shop.map((i) => (i.id === id ? { ...i, image: url } : i)),
    }));
  }

  const rename = (id: string, name: string) =>
    setProduction((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => (i.id === id ? { ...i, name } : i)),
      shop: prev.shop.map((i) => (i.id === id ? { ...i, name } : i)),
    }));

  const input = "w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent";
  return (
    <div className="space-y-8">
      <div className="grid gap-4 rounded-2xl border border-line bg-surface shadow-card p-5 sm:grid-cols-[180px_1fr]">
        <label className="relative block aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-dashed border-line bg-panel hover:border-accent">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-muted">Photograph a piece, flat or on a hanger</span>
          )}
          {tagging ? <div className="shimmer absolute inset-0 opacity-70" /> : null}
          <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${input} sm:col-span-2`} />
          <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value as Slot })} className={input}>
            {(["base", "outer", "hat"] as Slot[]).map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
          </select>
          <select value={form.garmentCategory} onChange={(e) => setForm({ ...form, garmentCategory: e.target.value as GarmentCategory })} className={input}>
            {["auto", "full_body", "upper_body", "lower_body", "outer"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Colours (navy, gold)" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} className={input} />
          <input placeholder="Tags (coat, wool, 1920s)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={input} />
          <input placeholder="Sizes (S/M or OS)" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className={input} />
          <input type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className={input} />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ItemSource })} className={input}>
            {(["owned", "rental", "shop"] as ItemSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
          {form.source !== "owned" ? (
            <input type="number" min={0} placeholder="Cost" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={input} />
          ) : null}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button onClick={add} disabled={!form.name} className="rounded-full grad px-5 py-2 text-sm font-medium text-white disabled:opacity-50">Add to rack</button>
            {tagging ? <span className="text-xs text-muted">Reading the photo…</span> : null}
            {note ? <span className="text-xs text-accent">{note}</span> : null}
          </div>
        </div>
      </div>

      {[{ title: "On the rack", items: p!.inventory }, { title: "Partner catalogue (hire and buy)", items: p!.shop }].map(({ title, items }) => (
        <div key={title}>
          <h3 className="mb-3 text-xs uppercase tracking-wider text-muted">{title}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
                <label className="relative h-16 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg" title="Replace photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image?.startsWith("data:") || it.image?.startsWith("http") ? it.image : swatchFor(it)} alt="" className="h-full w-full object-cover" />
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => replacePhoto(it.id, e.target.files?.[0])} />
                </label>
                <div className="min-w-0 flex-1 text-sm">
                  <input
                    value={it.name}
                    onChange={(e) => rename(it.id, e.target.value)}
                    className="w-full truncate rounded bg-transparent outline-none focus:bg-panel"
                    aria-label="Piece name"
                  />
                  <div className="truncate text-[11px] text-muted">
                    {SLOT_LABEL[it.slot]} · {it.sizes.join("/")} · {SOURCE_LABEL[it.source]}{it.cost ? ` · ${money(p!, it.cost)}` : ""}
                    {it.image?.startsWith("data:") || it.image?.startsWith("http") ? "" : " · needs a photo"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
