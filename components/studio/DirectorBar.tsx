"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/client/store";
import { describeChanges } from "@/lib/engine/ops";
import { lightweight } from "@/lib/engine/light";
import { pendingStages, renderImpact } from "@/lib/engine/render";

type Turn = { role: "user" | "assistant"; text: string };

export function DirectorBar() {
  const { production: p, replay, render, status, rendering } = useStudio();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [last, setLast] = useState<{ reply: string; lines: string[]; offline: boolean; rerender?: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const firstLook = p?.looks[0];
  const outerId = firstLook && p?.plan?.assignment[firstLook.id]?.outer;
  const piece = p && [...p.inventory, ...p.shop].find((item) => item.id === outerId);
  const suggestions = [
    piece ? `${piece.name} is damaged, we can't use it` : "Re-plan the cast",
    firstLook ? `Lock ${firstLook.name}, the director approved it` : "Re-plan the cast",
    "Our sourcing budget just dropped to $30",
  ];

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 12000);
    return () => clearTimeout(t);
  }, [last]);

  async function send(message: string) {
    if (!p || !message.trim() || busy || rendering) return;
    setBusy(true);
    setText("");
    setLast(null);
    try {
      const res = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ production: lightweight(p), message, history: turns }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? "The director is busy.");
      const results = replay(j.ops ?? []);
      const lines = results.flatMap((r) => describeChanges(r.production, r.changes));
      const after = results[results.length - 1]?.production;
      const affectedLooks = [...new Set(results.flatMap((r) => r.affected))];
      const redo = after && affectedLooks.length ? pendingStages(after, affectedLooks, !status?.demo).length : 0;
      const impact = after && renderImpact(p, after);
      const rerender = impact?.changedKeys.length ? `${impact.changedKeys.length} of ${impact.total} layers changed; ${impact.kept} kept. ${redo ? `Updating ${redo} layer${redo === 1 ? "" : "s"}.` : "Saved previews reused; no new units."}` : undefined;
      setLast({ reply: j.reply, lines, offline: j.offline, rerender });
      setTurns((t) => [...t, { role: "user" as const, text: message }, { role: "assistant" as const, text: j.reply }].slice(-12));
      if (affectedLooks.length) setTimeout(() => render(affectedLooks), 600);
    } catch (e) {
      setLast({ reply: (e as Error).message, lines: [], offline: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-8">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        {last ? (
          <div className="rise mb-3 rounded-2xl border border-accent/40 bg-surface/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed">{last.reply}</p>
              <button onClick={() => setLast(null)} className="text-xs text-muted hover:text-fg" aria-label="Dismiss">
                ✕
              </button>
            </div>
            {last.lines.length ? (
              <ul className="mt-2 space-y-1 text-xs text-accent">
                {last.lines.map((l, i) => (
                  <li key={i} className="tick" style={{ animationDelay: `${i * 120}ms` }}>
                    ↳ {l}
                  </li>
                ))}
              </ul>
            ) : null}
            {last.rerender ? <p className="tick mt-2 text-xs text-ok">↻ {last.rerender}</p> : null}
          </div>
        ) : null}
        {focused && !busy ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onMouseDown={(e) => e.preventDefault()} onClick={() => send(s)} className="rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur hover:border-accent hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2 rounded-full border border-line bg-surface/95 p-1.5 pl-5 shadow-2xl backdrop-blur focus-within:border-accent"
        >
          <span className="font-[family-name:var(--font-display)] text-accent">✦</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={busy ? "Re-planning…" : rendering ? "Updating the changed layers…" : "Tell ENCORE what changed…"}
            disabled={busy || rendering}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted"
          />
          <button disabled={busy || rendering || !text.trim()} className="rounded-full grad px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
