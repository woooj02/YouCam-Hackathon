"use client";
import { useStudio } from "@/lib/client/store";
import { conflictsFor, lookState, performerOf } from "@/lib/client/view";

/** Every look of the production at once: one tile per look, the complete look as the picture. */
export function CastWall({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p, highlight } = useStudio();
  if (!p) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Cast wall">
      {p.looks.map((look, i) => {
        const s = lookState(p, look.id);
        const { role, performer } = performerOf(p, look);
        const hero = s.complete ?? s.body;
        const src = hero?.url ?? performer?.bodyPhoto;
        const clash = conflictsFor(p, look.id).some((c) => c.severity === "hard");
        const hot = highlight && Date.now() - highlight.at < 4000 && highlight.lookIds.includes(look.id);
        return (
          <li key={look.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
            <button onClick={() => onOpen(look.id)} className={`group relative block w-full overflow-hidden rounded-xl border bg-panel text-left ${clash ? "border-alarm/70" : "border-line"} ${hot ? "glow-accent" : ""}`}>
              <div className="relative aspect-[3/4]">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`${look.name} on ${performer?.name}`} className={`h-full w-full object-cover ${hero ? "" : "opacity-40 grayscale"}`} />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted">No photo yet</div>
                )}
                {s.rendering ? <div className="shimmer absolute inset-0" /> : null}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {hero?.demo ? <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-accent">sketch</span> : null}
                  {s.complete?.composite ? <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px]">composite</span> : null}
                  {!hero ? <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-muted">not rendered</span> : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8 text-white">
                  <div className="text-sm font-medium leading-tight">{role?.name}</div>
                  <div className="text-[11px] opacity-85">{look.name} · {performer?.name}</div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
