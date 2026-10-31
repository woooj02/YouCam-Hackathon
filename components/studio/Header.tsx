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
  const [check, setCheck] = useState(false);

  useEffect(() => {
    if (status && !status.demo) {
      fetch("/api/youcam/credits").then((r) => r.json()).then((j) => setBalance(j.balance ?? null)).catch(() => {});
    }
  }, [status, rendering]);

  const naive = useMemo(() => (p && check ? naivePlan(p) : null), [p, check]);
  if (!p) return null;
  const pending = pendingStages(p);
  const hard = (p.plan?.conflicts ?? []).filter((c) => c.severity === "hard");
  const pct = Math.min(100, ((p.plan?.cost ?? 0) / Math.max(1, p.budget)) * 100);

  return (
    <header className="no-print space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="font-[family-name:var(--font-display)] text-sm font-extrabold tracking-[0.25em] text-gold">
            ENCORE
          </Link>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">{p.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{p.logline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/studio/setup" className="rounded-full border border-line px-4 py-2 text-sm hover:border-gold">Cast & rack</Link>
          <Link href="/studio/print" className="rounded-full border border-line px-4 py-2 text-sm hover:border-gold">Fitting cards</Link>
          <button onClick={() => op({ type: "plan" })} className="rounded-full border border-line px-4 py-2 text-sm hover:border-gold">Re-plan</button>
          <button onClick={() => exportProduction(p)} className="rounded-full px-3 py-2 text-xs text-muted hover:text-paper" title="Download this production with renders inlined, for public/showcase/production.json">
            Export
          </button>
          <button
            onClick={() => confirm("Start over with the showcase production? Photos, renders and changes will be replaced.") && resetToShowcase()}
            className="rounded-full px-3 py-2 text-xs text-muted hover:text-paper"
          >
            Start over
          </button>
          <button
            onClick={() => render()}
            disabled={rendering || !pending.length}
            className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink shadow-[0_0_30px_rgba(232,176,75,.3)] disabled:opacity-50"
          >
            {rendering ? `Rendering ${progress.done}/${progress.total}` : pending.length ? `See opening night · ${pending.length} renders` : "All looks rendered"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sourcing" value={`${money(p, p.plan?.cost ?? 0)} / ${money(p, p.budget)}`} bar={pct} k={p.plan?.cost} />
        <Stat
          label="Plan check"
          value={hard.length ? `${hard.length} conflict${hard.length > 1 ? "s" : ""}` : `0 conflicts · ${p.plan?.gaps.length ?? 0} gaps`}
          tone={hard.length ? "alarm" : "ok"}
          onClick={() => setCheck((c) => !c)}
          hint="Compare with look-by-look"
        />
        <Stat label="YouCam units" value={status?.demo ? "Demo mode · 0 spent" : `${unitsSpent} this session${balance !== null ? ` · ${balance} left` : ""}`} hint={pending.length ? `~${estimateUnits(pending)} to render the rest` : undefined} />
        <Stat label="Looks" value={`${p.looks.length} looks · ${p.performers.length} performers · ${p.scenes.length} scenes`} onClick={restoreRack} hint="Restore rack & re-plan (keeps photos and renders)" />
      </div>

      {naive ? (
        <div className="rise grid gap-3 rounded-2xl border border-line bg-stage p-4 sm:grid-cols-2">
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
            <p className="mt-2 text-xs text-ok">Every piece is on one person per scene, and the plan fits the budget.</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Stat({ label, value, bar, tone, onClick, hint, k }: { label: string; value: string; bar?: number; tone?: "ok" | "alarm"; onClick?: () => void; hint?: string; k?: number }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={`rounded-2xl border border-line bg-stage p-4 text-left ${onClick ? "hover:border-gold/60" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div key={k} className={`tick mt-1 text-sm font-medium ${tone === "alarm" ? "text-alarm" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
      {bar !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
          <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${bar}%` }} />
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </C>
  );
}
