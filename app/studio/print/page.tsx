"use client";
import Link from "next/link";
import { useStudio } from "@/lib/client/store";
import { itemById, lookState, money, SLOT_LABEL, SOURCE_LABEL } from "@/lib/client/view";

/** One card per look, grouped by performer: what to pull, what to fit, what to check. */
export default function PrintCards() {
  const { production: p } = useStudio();
  if (!p) return null;
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
        <button onClick={() => window.print()} className="rounded-full grad px-5 py-2 text-sm font-medium text-white">Print fitting cards</button>
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{p.title}: fitting cards</h1>
      <p className="text-sm text-muted">Previews show appearance. Fit, comfort and quick-change timing are confirmed at the fitting.</p>
      {p.notice ? <p className="mt-2 text-xs text-muted">{p.notice}</p> : null}
      {p.performers.map((perf) => {
        const roles = p.roles.filter((r) => r.performerId === perf.id);
        const looks = p.looks.filter((l) => roles.some((r) => r.id === l.roleId));
        return (
          <section key={perf.id} className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">{perf.name} <span className="text-base text-muted">· size {perf.size} · {roles.map((r) => r.name).join(", ")}</span></h2>
            {looks.map((l) => {
              const s = lookState(p, l.id);
              const a = p.plan?.assignment[l.id] ?? {};
              const soft = (p.plan?.conflicts ?? []).filter((c) => c.severity === "soft" && c.lookIds.includes(l.id));
              return (
                <article key={l.id} className="print-card mt-4 grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-[160px_1fr]">
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(s.complete ?? s.body)?.url ? <img src={(s.complete ?? s.body)!.url} alt={s.complete?.composite ? "Complete look (composite)" : ""} className="w-full rounded-lg" /> : <div className="aspect-[2/3] rounded-lg bg-panel" />}
                    {s.complete?.composite ? <p className="text-[10px] text-muted">Complete look · composite</p> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.portrait?.url ? <img src={s.portrait.url} alt="" className="w-full rounded-lg" /> : null}
                  </div>
                  <div className="text-sm">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">{l.name}</h3>
                    <p className="text-muted">Scene{l.sceneIds.length === 1 ? "" : "s"}: {l.sceneIds.map((id) => { const sc = p.scenes.find((x) => x.id === id); return sc ? `${sc.order}. ${sc.name}` : id; }).join(" · ")}</p>
                    {l.direction ? <p className="mt-2 text-xs text-muted">{l.direction}</p> : null}
                    <table className="mt-3 w-full">
                      <tbody>
                        {l.requirements.map((r) => {
                          const it = itemById(p, a[r.slot]);
                          return (
                            <tr key={r.slot} className="border-t border-line/60">
                              <td className="py-1.5 pr-3 text-muted">{SLOT_LABEL[r.slot]}</td>
                              <td className="py-1.5">{it ? it.name : <em>To source: {[...(r.colors ?? []), ...r.tags].join(", ")}</em>}</td>
                              <td className="py-1.5 text-right text-muted">{it ? <>{SOURCE_LABEL[it.source]}{it.cost ? ` · ${money(p, it.cost)}` : ""}{it.vendor ? <span className="block text-xs">{it.vendor}</span> : null}</> : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {l.hair ? <p className="mt-2">Hair: {l.hair.label}{l.hair.keepColor ? " (own colour)" : ""}</p> : null}
                    {l.makeup ? <p className="mt-1">Makeup: {l.makeup.label}{l.makeup.lip ? ` · lip ${l.makeup.lip.color}` : ""}</p> : null}
                    <div className="mt-3 rounded-lg bg-panel/60 p-2 text-xs">
                      <div className="font-medium">At the fitting</div>
                      <ul className="mt-1 list-disc pl-4">
                        <li>Check fit and movement in every piece.</li>
                        {a.hat ? <li>Fit headwear in person; it is excluded from the preview.</li> : null}
                        {soft.map((c, i) => <li key={i}>{c.message}: rehearse {c.kind === "quick-change" ? "the change" : "the handoff"}.</li>)}
                        {l.locked ? <li>Look approved and locked.</li> : null}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}
