"use client";
import { useStudio } from "@/lib/client/store";
import { itemById, performerOf } from "@/lib/client/view";

/** Rows are looks, columns are scenes: who wears what, when, and where pieces collide. */
export function SceneTimeline({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p, highlight } = useStudio();
  if (!p) return null;
  const scenes = [...p.scenes].sort((a, b) => a.order - b.order);
  const clash = new Set(
    (p.plan?.conflicts ?? []).filter((c) => c.kind === "double-booked").flatMap((c) => c.lookIds.map((l) => `${l}|${c.sceneId}`)),
  );
  const hot = (id: string) => highlight && Date.now() - highlight.at < 4000 && highlight.lookIds.includes(id);
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="w-56 px-4 py-3 font-medium">Look</th>
            {scenes.map((s) => (
              <th key={s.id} className="px-3 py-3 font-medium">
                <span className="text-accent">{s.order}</span> {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.looks.map((l) => {
            const { performer } = performerOf(p, l);
            const a = p.plan?.assignment[l.id] ?? {};
            const pieces = (["base", "outer", "hat"] as const).map((s) => itemById(p, a[s])).filter(Boolean);
            return (
              <tr key={l.id} className={`border-t border-line/70 ${hot(l.id) ? "glow-accent" : ""}`}>
                <td className="px-4 py-2.5">
                  <button onClick={() => onOpen(l.id)} className="text-left hover:text-accent">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted">{performer?.name}</div>
                  </button>
                </td>
                {scenes.map((s) => {
                  const on = l.sceneIds.includes(s.id);
                  const bad = clash.has(`${l.id}|${s.id}`);
                  return (
                    <td key={s.id} className="px-2 py-2 align-top">
                      {on ? (
                        <div className={`rounded-lg px-2 py-1.5 text-[11px] leading-snug ${bad ? "glow-alarm bg-alarm/15 text-alarm" : "bg-panel text-fg/85"}`}>
                          {pieces.map((it) => (
                            <div key={it!.id} className={`truncate ${highlight?.itemIds.includes(it!.id) && hot(l.id) ? "tick text-accent" : ""}`}>
                              {it!.name}
                            </div>
                          ))}
                          {!pieces.length ? <span className="text-muted">nothing yet</span> : null}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
