/**
 * Every change to a production is an op. The director agent emits ops on the
 * server (working on a lightweight copy without photos); the browser replays
 * the same ops on the full production. The solver is deterministic, so both
 * sides land on the same plan.
 */
import { diffAssignments, freezeExcept, lockedPairs, replanWithout, solve, type SlotChange } from "./solver";
import type { Production, Slot } from "./types";

export type Op =
  | { type: "plan" }
  | { type: "unavailable"; itemId: string; reason?: string }
  | { type: "restore"; itemId: string }
  | { type: "requirement"; lookId: string; slot: Slot; tags: string[]; colors?: string[] }
  | { type: "lock"; lookId: string; locked: boolean }
  | { type: "budget"; budget: number };

export type OpResult = { production: Production; changes: SlotChange[]; affected: string[]; summary: string };

const itemName = (p: Production, id?: string) => (id ? [...p.inventory, ...p.shop].find((i) => i.id === id)?.name ?? id : "nothing");
const lookName = (p: Production, id: string) => p.looks.find((l) => l.id === id)?.name ?? id;

export function describeChanges(p: Production, changes: SlotChange[]): string[] {
  return changes.map((c) => `${lookName(p, c.lookId)}: ${c.slot} ${itemName(p, c.from)} -> ${itemName(p, c.to)}`);
}

function withHistory(p: Production, kind: Production["history"][number]["kind"], text: string, lookIds?: string[]): Production {
  return { ...p, history: [...p.history, { at: Date.now(), kind, text, lookIds }].slice(-200) };
}

export function applyOp(p: Production, op: Op): OpResult {
  switch (op.type) {
    case "plan": {
      const before = p.plan?.assignment ?? {};
      const plan = solve(p, { fixed: lockedPairs(p) });
      const changes = diffAssignments(before, plan.assignment);
      const affected = [...new Set(changes.map((c) => c.lookId))];
      const summary = `Planned ${p.looks.length} looks: ${plan.gaps.length} gaps, ${p.currency}${plan.cost} of ${p.currency}${p.budget}, ${plan.nodes} options weighed in ${plan.ms} ms.`;
      return { production: withHistory({ ...p, plan }, "plan", summary, affected), changes, affected, summary };
    }
    case "unavailable": {
      if (!p.plan) return applyOp(applyOp(p, { type: "plan" }).production, op);
      const { production, changes, affected } = replanWithout(p, op.itemId);
      const lines = describeChanges(production, changes);
      const summary = `${itemName(p, op.itemId)} is unavailable${op.reason ? ` (${op.reason})` : ""}. ${affected.length ? `Re-planned ${affected.length} look${affected.length > 1 ? "s" : ""}: ${lines.join("; ")}.` : "No look was using it."}`;
      return { production: withHistory(production, "replan", summary, affected), changes, affected, summary };
    }
    case "restore": {
      const next = {
        ...p,
        inventory: p.inventory.map((i) => (i.id === op.itemId ? { ...i, available: true } : i)),
        shop: p.shop.map((i) => (i.id === op.itemId ? { ...i, available: true } : i)),
      };
      return { production: withHistory(next, "edit", `${itemName(p, op.itemId)} is back on the rack.`), changes: [], affected: [], summary: `${itemName(p, op.itemId)} is available again. Re-plan to use it.` };
    }
    case "requirement": {
      const next: Production = {
        ...p,
        looks: p.looks.map((l) =>
          l.id !== op.lookId
            ? l
            : {
                ...l,
                requirements: [
                  ...l.requirements.filter((r) => r.slot !== op.slot),
                  { slot: op.slot, tags: op.tags, colors: op.colors, optional: l.requirements.find((r) => r.slot === op.slot)?.optional },
                ],
              },
        ),
      };
      const before = p.plan?.assignment ?? {};
      const plan = solve(next, { fixed: freezeExcept(before, [{ lookId: op.lookId, slot: op.slot }]) });
      const changes = diffAssignments(before, plan.assignment);
      const summary = `${lookName(p, op.lookId)} now wants ${op.slot}: ${[...(op.colors ?? []), ...op.tags].join(", ")}. ${describeChanges(next, changes).join("; ") || "The current piece still fits best."}`;
      const affected = [...new Set(changes.map((c) => c.lookId))];
      return { production: withHistory({ ...next, plan }, "edit", summary, affected), changes, affected, summary };
    }
    case "lock": {
      const next = { ...p, looks: p.looks.map((l) => (l.id === op.lookId ? { ...l, locked: op.locked } : l)) };
      const summary = `${lookName(p, op.lookId)} ${op.locked ? "locked as approved" : "unlocked"}.`;
      return { production: withHistory(next, "edit", summary, [op.lookId]), changes: [], affected: [], summary };
    }
    case "budget": {
      const next = { ...p, budget: Math.max(0, Math.round(op.budget)) };
      const r = applyOp(next, { type: "plan" });
      return { ...r, summary: `Budget set to ${p.currency}${next.budget}. ${r.summary}` };
    }
  }
}
