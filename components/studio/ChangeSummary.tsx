"use client";
import { useStudio } from "@/lib/client/store";
import { allStages } from "@/lib/engine/render";
import { describeChanges } from "@/lib/engine/ops";

export function ChangeSummary({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p, changeReport: report, rendering } = useStudio();
  if (!p || !report) return null;
  const pending = report.changedKeys.filter((key) => p.renders[key]?.status !== "done");
  const cost = allStages(p).filter((stage) => pending.includes(stage.key)).reduce((sum, stage) => sum + stage.units, 0);
  const spent = report.changedKeys.filter((key) => !report.cachedKeys.includes(key)).reduce((sum, key) => sum + (p.renders[key]?.status === "done" ? p.renders[key].units ?? 0 : 0), 0);
  const ready = pending.length === 0;
  return (
    <section className="rise rounded-2xl border border-accent/40 bg-surface p-4 shadow-card" aria-label="Last plan change" role="status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">{report.changedKeys.length} of {report.total} layers changed. {report.kept} kept.</h2>
          <p className="mt-1 text-xs text-muted">
            {report.lookIds.length} look{report.lookIds.length === 1 ? "" : "s"} affected · {ready ? report.cachedKeys.length === report.changedKeys.length ? "Saved preview reused · 0 new units" : `Preview ready · ${spent} YouCam units` : `${rendering ? "Updating" : "Ready to update"} ${pending.length} layer${pending.length === 1 ? "" : "s"} · ~${cost} units`}
          </p>
        </div>
        {report.lookIds[0] ? <button onClick={() => onOpen(report.lookIds[0])} className="rounded-full border border-line px-4 py-2 text-xs hover:border-accent">Inspect changed look</button> : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-accent">{describeChanges(p, report.changes).map((line) => <li key={line}>{line.replace(" -> ", " → ")}</li>)}</ul>
    </section>
  );
}
