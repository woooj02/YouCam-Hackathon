"use client";
import { useStudio } from "@/lib/client/store";
import { LookCard } from "./LookCard";
import { useState } from "react";

export function CastBoard({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p } = useStudio();
  const [view, setView] = useState<"costume" | "styling">("costume");
  if (!p) return null;
  let i = 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-[family-name:var(--font-display)] text-2xl">Cast fitting room</h2><p className="mt-1 text-xs text-muted">Compare each performer's costume and styling directions.</p></div>
        <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="Cast board view">
          {(["costume", "styling"] as const).map((mode) => <button key={mode} onClick={() => setView(mode)} aria-pressed={view === mode} className={`rounded-full px-4 py-2 text-xs ${view === mode ? "grad text-white" : "text-muted"}`}>{mode === "costume" ? "Costumes" : "Hair & makeup"}</button>)}
        </div>
      </div>
    <div className="grid gap-6 lg:grid-cols-3">
      {p.performers.map((perf) => {
        const roles = p.roles.filter((r) => r.performerId === perf.id);
        const looks = p.looks.filter((l) => roles.some((r) => r.id === l.roleId));
        return (
          <section key={perf.id} className="space-y-3">
            <header className="flex items-center gap-3">
              {perf.portraitPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perf.portraitPhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel font-[family-name:var(--font-display)] text-accent">{perf.name[0]}</span>
              )}
              <div>
                <div className="font-medium">{perf.name}</div>
                <div className="text-xs text-muted">{roles.map((r) => r.name).join(" · ")} · size {perf.size}</div>
                <div className="mt-0.5 text-[10px] text-muted">{perf.reference === "fictional" ? "Fictional demo performer" : perf.reference === "provided" ? "Your supplied photos" : ""}</div>
              </div>
            </header>
            <div className="grid grid-cols-2 gap-3">
              {looks.map((l) => (
                <LookCard key={l.id} look={l} index={i++} onOpen={() => onOpen(l.id)} view={view} />
              ))}
            </div>
          </section>
        );
      })}
    </div></div>
  );
}
