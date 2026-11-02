"use client";
import { useMemo } from "react";
import { useStudio } from "@/lib/client/store";
import { itemById, lookState, money, performerOf } from "@/lib/client/view";
import { stagesForLook } from "@/lib/engine/render";
import { naivePlan } from "@/lib/engine/solver";
import type { Conflict, Item, Look, Plan, Production, RenderRecord } from "@/lib/engine/types";
import { plural } from "@/lib/plural";
import evalResult from "@/lib/eval-result.json";
import { ItemImage } from "./ItemImage";

export const EVAL_DOC = "https://github.com/woooj02/YouCam-Hackathon/blob/main/docs/EVAL.md";

/** The finished costume render for a look under a given plan, if that exact combination was ever rendered. */
export function renderUnder(p: Production, plan: Plan, look: Look): RenderRecord | undefined {
  const body = stagesForLook({ ...p, plan }, look).filter((s) => s.chain === "body").at(-1);
  const record = body ? p.renders[body.key] : undefined;
  return record?.status === "done" ? record : undefined;
}

/** The clash to show: the first double-booking of a single piece, the most legible one. */
export function headlineClash(conflicts: Conflict[]): Conflict | undefined {
  const doubles = conflicts.filter((c) => c.kind === "double-booked");
  return doubles.sort((a, b) => b.lookIds.length - a.lookIds.length)[0];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function PlanCheck() {
  const { production: p } = useStudio();
  const naive = useMemo(() => (p ? naivePlan(p) : null), [p]);
  if (!p?.plan || !naive) return null;
  const plan = p.plan;
  const clash = headlineClash(naive.conflicts);
  const item = itemById(p, clash?.itemId);
  const scene = p.scenes.find((s) => s.id === clash?.sceneId);
  const looks = (clash?.lookIds ?? []).map((id) => p.looks.find((l) => l.id === id)!).filter(Boolean).slice(0, 3);
  const naiveHard = naive.conflicts.filter((c) => c.severity === "hard");
  const hard = plan.conflicts.filter((c) => c.severity === "hard");

  return (
    <section className="rise rounded-2xl border border-line bg-surface p-4 shadow-card" aria-label="Plan check">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">Look-by-look: each look picked on its own</div>
          <p className={`mt-1 text-sm ${naiveHard.length ? "text-alarm" : "text-ok"}`}>{plural(naiveHard.length, "hard conflict")} · {money(p, naive.cost)} of {money(p, p.budget)}</p>
          {clash && item ? (
            <div className="mt-3 rounded-xl border border-alarm/50 bg-alarm/5 p-3">
              <div className="flex flex-wrap items-end gap-3">
                {looks.map((look) => <Thumb key={look.id} p={p} look={look} record={renderUnder(p, naive, look)} item={item} bad />)}
              </div>
              <p className="mt-3 text-sm font-semibold text-alarm" role="note">Same scene. The rack has {item.qty}.</p>
              <p className="mt-1 text-xs text-muted">{item.name} on {plural(clash.lookIds.length, "performer")} in &ldquo;{scene?.name}&rdquo;.</p>
            </div>
          ) : <p className="mt-3 text-xs text-muted">No piece is double-booked when each look is picked on its own.</p>}
          <ul className="mt-2 space-y-0.5 text-[11px] text-alarm">{naiveHard.filter((c) => c !== clash).slice(0, 3).map((c, i) => <li key={i}>{c.message}</li>)}</ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">ENCORE: the whole cast at once</div>
          <p className={`mt-1 text-sm ${hard.length ? "text-alarm" : "text-ok"}`}>{plural(hard.length, "hard conflict")} · {money(p, plan.cost)} of {money(p, p.budget)} · {plural(plan.nodes, "option")} weighed in {plan.ms} ms</p>
          {clash ? (
            <div className="mt-3 rounded-xl border border-ok/40 bg-ok/5 p-3">
              <div className="flex flex-wrap items-end gap-3">
                {looks.map((look) => {
                  const slot = item?.slot ?? "outer";
                  const got = itemById(p, plan.assignment[look.id]?.[slot]);
                  const s = lookState(p, look.id);
                  return <Thumb key={look.id} p={p} look={look} record={s.complete ?? s.body} item={got} />;
                })}
              </div>
              <p className="mt-3 text-sm font-semibold text-ok">One piece per person per scene{plan.cost ? `, ${money(p, plan.cost)} to source` : ", all from the rack"}.</p>
            </div>
          ) : null}
          <p className={`mt-2 text-xs ${hard.length || plan.gaps.length ? "text-accent" : "text-ok"}`}>{hard.length ? "Resolve the flagged conflicts before approving this plan." : plan.gaps.length ? "Unfilled slots are listed as sourcing needs, ready for the wardrobe team." : "Every piece is on one person per scene, and the plan fits the budget."}</p>
        </div>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        <span className="font-medium text-fg">Synthetic benchmark, {evalResult.productions} generated productions:</span>{" "}
        look-by-look plans are feasible {pct(evalResult.feasible.naive)} of the time, ENCORE {pct(evalResult.feasible.encore)}.{" "}
        <a href={EVAL_DOC} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">How it was measured (docs/EVAL.md)</a>
      </p>
    </section>
  );
}

function Thumb({ p, look, record, item, bad }: { p: Production; look: Look; record?: RenderRecord; item?: Item; bad?: boolean }) {
  const { role, performer } = performerOf(p, look);
  const src = record?.url ?? performer?.bodyPhoto;
  return (
    <figure className="w-28">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-panel">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${role?.name} in ${item?.name ?? "the planned costume"}`} className={`h-full w-full object-cover ${record ? "" : "opacity-50 grayscale"}`} />
        ) : null}
        {!record ? <span className="absolute left-1 top-1 rounded bg-white/90 px-1 py-0.5 text-[9px] text-muted">not rendered</span> : record.demo ? <span className="absolute left-1 top-1 rounded bg-white/90 px-1 py-0.5 text-[9px] text-accent">sketch</span> : null}
        {item ? (
          <div className={`absolute bottom-1 right-1 overflow-hidden rounded-md border-2 bg-white ${bad ? "border-alarm" : "border-ok"}`} title={item.name}>
            <ItemImage item={item} className="h-10 w-10 object-cover" />
          </div>
        ) : null}
      </div>
      <figcaption className="mt-1 text-[11px] leading-tight">
        <span className="font-medium">{role?.name}</span>
        <span className={`block ${bad ? "text-alarm" : "text-muted"}`}>{item?.name ?? "to source"}</span>
      </figcaption>
    </figure>
  );
}
