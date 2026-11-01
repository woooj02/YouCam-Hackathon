"use client";
import { useState } from "react";
import { useStudio } from "@/lib/client/store";
import { money, SLOT_LABEL, SOURCE_LABEL, itemById } from "@/lib/client/view";
import { usesOf } from "@/lib/engine/solver";
import type { Item } from "@/lib/engine/types";
import { ItemImage } from "./ItemImage";
import { plural } from "@/lib/plural";

type Tab = "rack" | "basket" | "activity";

export function SidePanel({ onLost }: { onLost: (item: Item) => void }) {
  const [tab, setTab] = useState<Tab>("rack");
  const { production: p } = useStudio();
  if (!p) return null;
  const tabs: [Tab, string][] = [
    ["rack", `Rack · ${p.inventory.length}`],
    ["basket", `Sourcing · ${money(p, p.plan?.cost ?? 0)}`],
    ["activity", "Activity"],
  ];
  return (
    <aside className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex gap-1 border-b border-line p-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-lg px-3 py-2 text-sm ${tab === id ? "bg-panel text-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        {tab === "rack" ? <Rack onLost={onLost} /> : tab === "basket" ? <Basket /> : <Activity />}
      </div>
    </aside>
  );
}

function Rack({ onLost }: { onLost: (item: Item) => void }) {
  const { production: p, highlight } = useStudio();
  if (!p) return null;
  const groups = (["base", "outer", "hat"] as const).map((slot) => ({ slot, items: p.inventory.filter((i) => i.slot === slot) }));
  return (
    <div className="space-y-5">
      {groups.filter((group) => group.items.length).map(({ slot, items }) => (
        <div key={slot}>
          <h4 className="mb-2 text-xs uppercase tracking-wider text-muted">{SLOT_LABEL[slot]}</h4>
          <ul className="space-y-1.5">
            {items.map((it) => {
              const uses = usesOf(p, it.id);
              const hot = highlight && Date.now() - highlight.at < 4000 && highlight.itemIds.includes(it.id);
              return (
                <li key={it.id} className={`flex items-center gap-3 rounded-xl p-2 ${hot ? "glow-accent" : ""} ${it.available ? "hover:bg-panel" : "opacity-50"}`}>
                  <ItemImage item={it} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${it.available ? "" : "line-through"}`}>{it.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {it.sizes.join("/")} · {it.qty} on rack · {it.available ? (uses.length ? `on ${plural(uses.length, "look")}` : "spare") : "unavailable"}
                    </div>
                  </div>
                  {it.available ? (
                    <button onClick={() => onLost(it)} className="rounded-lg px-2 py-1 text-[11px] text-muted hover:bg-alarm/15 hover:text-alarm" title="Mark unavailable">
                      Lost
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Basket() {
  const { production: p, highlight } = useStudio();
  if (!p?.plan) return null;
  const plan = p.plan;
  const pct = Math.min(100, (plan.cost / Math.max(1, p.budget)) * 100);
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Sourcing budget</span>
          <span key={plan.cost} className="tick font-[family-name:var(--font-display)] text-2xl">
            {money(p, plan.cost)} <span className="text-sm text-muted">of {money(p, p.budget)}</span>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel">
          <div className="h-full rounded-full grad transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="space-y-2">
        {plan.basket.map((l) => {
          const it = itemById(p, l.itemId)!;
          const hot = highlight && Date.now() - highlight.at < 4000 && highlight.itemIds.includes(l.itemId);
          return (
            <li key={l.itemId} className={`rise rounded-xl border border-line p-3 ${hot ? "glow-accent" : ""}`}>
              <ItemImage item={it} className="mb-2 h-24 w-full rounded-lg bg-panel object-contain" />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">{it.name}</span>
                <span className="text-sm">{money(p, l.total)}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {SOURCE_LABEL[l.source]} · {l.vendor} · sizes {it.sizes.join("/")} · {l.units} × {money(p, l.unitCost)}
              </div>
            </li>
          );
        })}
        {!plan.basket.length ? <li className="text-sm text-muted">Everything comes off your own rack. Nothing to hire or buy.</li> : null}
      </ul>
      {plan.gaps.length ? (
        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wider text-accent">Still to source</h4>
          <ul className="space-y-1 text-sm">
            {plan.gaps.map((g, i) => (
              <li key={i} className="rounded-lg bg-panel px-3 py-2">
                {p.looks.find((l) => l.id === g.lookId)?.name}: {g.need}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Activity() {
  const { production: p } = useStudio();
  if (!p) return null;
  return (
    <ol className="space-y-2">
      {[...p.history].reverse().map((h, i) => (
        <li key={i} className="rounded-xl bg-panel/70 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wider text-muted">
            {h.kind} · {new Date(h.at).toLocaleTimeString()}
          </div>
          <div className="mt-1 leading-snug">{h.text}</div>
        </li>
      ))}
    </ol>
  );
}
