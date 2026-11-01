"use client";
import { useState } from "react";
import { CastBoard } from "@/components/studio/CastBoard";
import { DirectorBar } from "@/components/studio/DirectorBar";
import { Header } from "@/components/studio/Header";
import { LookDrawer } from "@/components/studio/LookDrawer";
import { SceneTimeline } from "@/components/studio/SceneTimeline";
import { SidePanel } from "@/components/studio/SidePanel";
import { useStudio } from "@/lib/client/store";
import type { Item } from "@/lib/engine/types";
import { ChangeSummary } from "@/components/studio/ChangeSummary";

export default function Studio() {
  const { production: p, status, op, render } = useStudio();
  const [open, setOpen] = useState<string | null>(null);

  if (!p) {
    return (
      <main className="spotlight flex min-h-screen items-center justify-center">
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-[0.3em] text-accent">ENCORE</span>
      </main>
    );
  }

  const lost = (item: Item) => {
    const r = op({ type: "unavailable", itemId: item.id, reason: "marked lost on the rack" });
    if (r?.affected.length) setTimeout(() => render(r.affected), 600);
  };

  return (
    <main className="spotlight min-h-screen pb-40">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 pt-6 sm:px-8">
        {p.notice ? <div className="no-print rounded-xl border border-line bg-surface px-4 py-2 text-xs text-muted">{p.notice}</div> : null}
        {status?.demo && !Object.values(p.renders).some((record) => record.status === "done" && !record.demo) ? (
          <div className="no-print rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-xs text-accent">
            Demo mode: no YouCam key is set, so renders are costume sketches. Add YOUCAM_API_KEY to render on real performer photos.
          </div>
        ) : null}
        <Header />
        <ChangeSummary onOpen={setOpen} />
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <CastBoard onOpen={setOpen} />
            <div>
              <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Scene plot</h2>
              <SceneTimeline onOpen={setOpen} />
            </div>
          </div>
          <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <SidePanel onLost={lost} />
          </div>
        </div>
      </div>
      <DirectorBar />
      {open ? <LookDrawer lookId={open} onClose={() => setOpen(null)} /> : null}
    </main>
  );
}
