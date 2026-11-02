"use client";
import { useStudio } from "@/lib/client/store";
import { allStages, UNIT_COST } from "@/lib/engine/render";
import { describeChanges } from "@/lib/engine/ops";
import { plural } from "@/lib/plural";

export function ChangeSummary({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p, changeReport: report, rendering } = useStudio();
  if (!p || !report) return null;
  const pending = report.changedKeys.filter((key) => p.renders[key]?.status !== "done");
  const cost = allStages(p).filter((stage) => pending.includes(stage.key)).reduce((sum, stage) => sum + stage.units, 0);
  const spent = report.changedKeys.filter((key) => !report.cachedKeys.includes(key)).reduce((sum, key) => sum + (p.renders[key]?.status === "done" ? p.renders[key].units ?? 0 : 0), 0);
  const ready = pending.length === 0;
  const c = report.cost;
  return (
    <section className="rise rounded-2xl border border-accent/40 bg-surface p-4 shadow-card" aria-label="Last plan change" role="status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            {ready ? "Re-rendered" : rendering ? "Re-rendering" : "Re-render"} {c.changedApiLayers} of {plural(c.apiLayers, "layer")}: {plural(c.units, "unit")} instead of {c.fullCastUnits} for the whole cast
          </h2>
          <p className="mt-1 text-xs text-muted">
            {report.kept} of {plural(report.total, "layer")} kept · {plural(report.lookIds.length, "look")} affected
            {c.recomposited ? ` · ${plural(c.recomposited, "head composite")} redone locally (0 units)` : ""} · {ready ? report.cachedKeys.length === report.changedKeys.length ? "Saved preview reused · 0 new units" : `Preview ready · ${plural(spent, "YouCam unit")}` : `${rendering ? "Updating" : "Ready to update"} ${plural(pending.length, "layer")} · ~${plural(cost, "unit")}`}
          </p>
          <p className="mt-1 text-[11px] text-muted">From the render graph and the per-call unit costs: clothes {UNIT_COST.cloth}, hairstyle {UNIT_COST["hair-transfer"]}, makeup {UNIT_COST["makeup-vto"]}.</p>
        </div>
        {report.lookIds[0] ? <button onClick={() => onOpen(report.lookIds[0])} className="rounded-full border border-line px-4 py-2 text-xs hover:border-accent">Inspect changed look</button> : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-accent">{describeChanges(p, report.changes).map((line) => <li key={line}>{line.replace(" -> ", " → ")}</li>)}</ul>
    </section>
  );
}
