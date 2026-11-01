"use client";
import { useState } from "react";
import type { Performer } from "@/lib/engine/types";

export function ImageComparison({ before, after, label, framing }: { before: string; after: string; label: string; framing?: Performer["bodyFraming"] }) {
  const [position, setPosition] = useState(50);
  const style = framing ? { transform: `scale(${framing.zoom})`, transformOrigin: `${framing.x}% ${framing.y}%` } : undefined;
  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-panel" aria-label={label}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${label}, after`} className="absolute inset-0 h-full w-full object-contain" style={style} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={`${label}, before`} className="h-full w-full object-contain" style={style} />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-fg">Before</span>
        <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-fg">After</span>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-surface shadow-lg" style={{ left: `${position}%` }} />
      </div>
      <label className="block text-xs text-muted">
        Compare before and after
        <input type="range" min={0} max={100} value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label={`${label}: before and after`} className="mt-2 block w-full accent-[#d23a74]" />
      </label>
    </div>
  );
}
