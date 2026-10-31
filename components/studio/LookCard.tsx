"use client";
import { useStudio } from "@/lib/client/store";
import { conflictsFor, gapsFor, itemById, lookState, performerOf } from "@/lib/client/view";
import type { Look } from "@/lib/engine/types";

export function LookCard({ look, onOpen, index }: { look: Look; onOpen: () => void; index: number }) {
  const { production: p, highlight } = useStudio();
  if (!p) return null;
  const s = lookState(p, look.id);
  const { role, performer } = performerOf(p, look);
  const conflicts = conflictsFor(p, look.id).filter((c) => c.severity === "hard");
  const gaps = gapsFor(p, look.id);
  const hot = highlight && Date.now() - highlight.at < 4000 && highlight.lookIds.includes(look.id);
  const assigned = p.plan?.assignment[look.id] ?? {};
  const bodySrc = s.body?.url ?? performer?.bodyPhoto;
  const faceSrc = s.portrait?.url ?? performer?.portraitPhoto;

  return (
    <button
      onClick={onOpen}
      key={hot ? `hot-${highlight!.at}` : look.id}
      className={`rise group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-stage text-left transition hover:-translate-y-0.5 hover:border-gold/60 ${
        conflicts.length ? "border-alarm/70" : "border-line"
      } ${hot ? "glow-gold" : ""}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-panel">
        {s.rendering && !s.body ? <div className="shimmer absolute inset-0" /> : null}
        {bodySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={bodySrc.slice(-40)} src={bodySrc} alt={`${look.name} on ${performer?.name}`} className={`h-full w-full object-cover ${s.body ? "curtain" : "opacity-40 grayscale"}`} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted">Not rendered yet</div>
        )}
        {s.rendering ? (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] text-gold">Rendering…</span>
        ) : null}
        {s.body?.demo ? <span className="absolute bottom-3 left-3 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] text-gold">sketch</span> : null}
        {look.locked ? <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] text-ok">Locked</span> : null}
        {faceSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faceSrc} alt="" className={`absolute bottom-3 right-3 h-16 w-16 rounded-full border-2 border-ink object-cover shadow-xl ${s.portrait ? "curtain" : "opacity-50 grayscale"}`} />
        ) : null}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="font-[family-name:var(--font-display)] text-base leading-tight">{look.name}</h3>
        <p className="text-[11px] text-muted">
          {role?.name} · scenes {look.sceneIds.map((id) => p.scenes.find((x) => x.id === id)?.order).join(", ")}
        </p>
        <ul className="space-y-0.5">
          {(["base", "outer", "hat"] as const).map((slot) => {
            const it = itemById(p, assigned[slot]);
            if (!it) return null;
            const changed = hot && highlight!.itemIds.includes(it.id);
            return (
              <li key={slot} className={`truncate text-[11px] ${changed ? "tick font-medium text-gold" : "text-paper/75"}`}>
                {changed ? "★ " : "· "}
                {it.name}
              </li>
            );
          })}
        </ul>
        {conflicts.length ? <p className="text-xs text-alarm">{conflicts[0].message}</p> : null}
        {gaps.length ? <p className="text-xs text-gold">Needs sourcing: {gaps.map((g) => g.need).join("; ")}</p> : null}
        {s.error ? <p className="text-xs text-alarm/90">{s.error}</p> : null}
      </div>
    </button>
  );
}
