"use client";
import { useStudio } from "@/lib/client/store";
import { LookCard } from "./LookCard";

export function CastBoard({ onOpen }: { onOpen: (lookId: string) => void }) {
  const { production: p } = useStudio();
  if (!p) return null;
  let i = 0;
  return (
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
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel font-[family-name:var(--font-display)] text-gold">{perf.name[0]}</span>
              )}
              <div>
                <div className="font-medium">{perf.name}</div>
                <div className="text-xs text-muted">{roles.map((r) => r.name).join(" · ")} · size {perf.size}</div>
              </div>
            </header>
            <div className="grid grid-cols-2 gap-3">
              {looks.map((l) => (
                <LookCard key={l.id} look={l} index={i++} onOpen={() => onOpen(l.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
