"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStudio } from "@/lib/client/store";
import { money } from "@/lib/client/view";
import { estimateUnits, pendingStages } from "@/lib/engine/render";
import { naivePlan } from "@/lib/engine/solver";
import { exportProduction } from "@/lib/client/export";

export function Header() {
  const { production: p, op, render, rendering, progress, unitsSpent, status, resetToShowcase, restoreRack } = useStudio();
  const [balance, setBalance] = useState<number | null>(null);
  const [check, setCheck] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (status && !status.demo) {
      fetch("/api/youcam/credits").then((r) => r.json()).then((j) => setBalance(j.balance ?? null)).catch(() => {});
    }
  }, [status, rendering]);

  const naive = useMemo(() => (p && check ? naivePlan(p) : null), [p, check]);
  if (!p) return null;
  const pending = pendingStages(p, undefined, !status?.demo);
  const hard = (p.plan?.conflicts ?? []).filter((c) => c.severity === "hard");
  const pct = Math.min(100, ((p.plan?.cost ?? 0) / Math.max(1, p.budget)) * 100);

  return (
    <header className="no-print space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="font-[family-name:var(--font-display)] text-sm font-extrabold tracking-[0.25em] grad-text">
            ENCORE
          </Link>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">{p.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{p.logline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/studio/setup" className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">Cast & rack</Link>
          <Link href="/studio/print" className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">Fitting cards</Link>
          <button disabled={rendering} onClick={() => op({ type: "plan" })} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-40">Re-plan</button>
          <button disabled={exporting || rendering} onClick={async () => { setExporting(true); setError(""); try { await exportProduction(p); } catch (e) { setError((e as Error).message); } finally { setExporting(false); } }} className="rounded-full px-3 py-2 text-xs text-muted hover:text-fg disabled:opacity-40" title="Download the cast photos, rack and finished previews as one production file">
            {exporting ? "Exporting…" : "Export"}
          </button>
          <button
            onClick={() => confirm("Start over with the showcase production? Photos, renders and changes will be replaced.") && resetToShowcase()}
            disabled={rendering}
            className="rounded-full px-3 py-2 text-xs text-muted hover:text-fg"
          >
            Start over
          </button>
          <button
            onClick={() => render()}
            disabled={!status || rendering || !pending.length}
            className={`rounded-full px-5 py-2 text-sm font-medium ${
              pending.length || rendering ? "grad text-white shadow-[0_0_30px_rgba(210,58,116,.25)]" : "border border-ok/30 bg-surface text-ok"
            } ${rendering ? "animate-pulse" : ""}`}
          >
            {rendering ? `Rendering ${progress.done}/${progress.total}` : pending.length ? `See opening night · ${pending.length} renders` : "✓ All looks rendered"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sourcing" value={`${money(p, p.plan?.cost ?? 0)} / ${money(p, p.budget)}`} bar={pct} k={p.plan?.cost} onClick={() => { setBudget(String(p.budget)); setBudgetOpen(!budgetOpen); }} hint="Edit shared budget" />
        <Stat
          label="Plan check"
          value={hard.length ? `${hard.length} conflict${hard.length > 1 ? "s" : ""}` : `0 conflicts · ${p.plan?.gaps.length ?? 0} gaps`}
          tone={hard.length ? "alarm" : "ok"}
          onClick={() => setCheck((c) => !c)}
          hint="Compare with look-by-look"
        />
        <Stat label="YouCam units" value={status?.demo ? Object.values(p.renders).some((record) => record.status === "done" && !record.demo) ? "Saved previews · 0 new units" : "Sketches · 0 spent" : `${unitsSpent} this session${balance !== null ? ` · ${balance} left` : ""}`} hint={pending.length ? `~${estimateUnits(pending)} to render the rest` : undefined} />
        <Stat label="Looks" value={`${p.looks.length} looks · ${p.performers.length} performers · ${p.scenes.length} scenes`} onClick={restoreRack} hint="Restore rack & re-plan (keeps photos and renders)" />
      </div>
      {error ? <p role="alert" className="text-sm text-alarm">{error}</p> : null}
      {budgetOpen ? <form onSubmit={(event) => { event.preventDefault(); op({ type: "budget", budget: Number(budget) }); setBudgetOpen(false); }} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm"><label>Shared sourcing budget {p.currency}<input type="number" min={0} max={1000000} required value={budget} onChange={(event) => setBudget(event.target.value)} className="ml-2 w-28 rounded-lg border border-line bg-panel px-3 py-1.5" /></label><button disabled={rendering} className="rounded-full grad px-4 py-2 text-white disabled:opacity-40">Update & re-plan</button></form> : null}

      {naive ? (
        <div className="rise grid gap-3 rounded-2xl border border-line bg-surface shadow-card p-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Picking each look on its own</div>
            <p className="mt-1 text-sm">
              {naive.conflicts.filter((c) => c.severity === "hard").length} hard conflicts · {money(p, naive.cost)}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-alarm">
              {naive.conflicts.filter((c) => c.severity === "hard").slice(0, 3).map((c, i) => <li key={i}>{c.message}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">ENCORE, whole cast at once</div>
            <p className="mt-1 text-sm">
              {hard.length} hard conflicts · {money(p, p.plan?.cost ?? 0)} · {p.plan?.nodes.toLocaleString()} options weighed in {p.plan?.ms} ms
            </p>
            <p className={`mt-2 text-xs ${hard.length || p.plan?.gaps.length ? "text-accent" : "text-ok"}`}>{hard.length ? "Resolve the flagged conflicts before approving this plan." : p.plan?.gaps.length ? "Unavailable pieces are listed as sourcing needs, ready for the wardrobe team." : "Every piece is on one person per scene, and the plan fits the budget."}</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Stat({ label, value, bar, tone, onClick, hint, k }: { label: string; value: string; bar?: number; tone?: "ok" | "alarm"; onClick?: () => void; hint?: string; k?: number }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={`rounded-2xl border border-line bg-surface shadow-card p-4 text-left ${onClick ? "hover:border-accent/60" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div key={k} className={`tick mt-1 text-sm font-medium ${tone === "alarm" ? "text-alarm" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
      {bar !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
          <div className="h-full rounded-full grad transition-all duration-700" style={{ width: `${bar}%` }} />
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </C>
  );
}
