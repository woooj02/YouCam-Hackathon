import type { Look, Production } from "@/lib/engine/types";

/**
 * What to check at the fitting for one look, from the plan itself.
 * Each note comes from a fact in the production (a piece's source, a reused piece, a planner warning),
 * so the card tells the wardrobe team something specific instead of generic advice.
 */
export function fittingNotes(p: Production, look: Look): string[] {
  const plan = p.plan;
  const a = plan?.assignment[look.id] ?? {};
  const items = new Map([...p.inventory, ...p.shop].map((i) => [i.id, i]));
  const performerId = p.roles.find((r) => r.id === look.roleId)?.performerId;
  const sameActorLooks = p.looks.filter((l) => l.id !== look.id && p.roles.find((r) => r.id === l.roleId)?.performerId === performerId);
  const notes = ["Check fit and movement in every piece."];

  for (const itemId of new Set(Object.values(a))) {
    const item = items.get(itemId);
    if (!item) continue;
    if (item.source === "rental") {
      notes.push(`${item.name} is hired${item.vendor ? ` from ${item.vendor}` : ""}: pin or tack only. Hire houses charge to undo alterations, and some charge replacement value for irreversible ones.`);
    } else if (item.source === "shop" || item.source === "secondhand") {
      notes.push(`${item.name} is bought, so it can be altered to fit.`);
    }
    const again = sameActorLooks.find((l) => Object.values(plan?.assignment[l.id] ?? {}).includes(itemId));
    if (again) notes.push(`Same ${item.name.toLowerCase()} as in “${again.name}”: fit it once for both looks.`);
  }

  if (a.hat) notes.push("Fit headwear in person; it is excluded from the preview.");
  for (const c of (plan?.conflicts ?? []).filter((c) => c.severity === "soft" && c.lookIds.includes(look.id))) {
    notes.push(`${c.message}: rehearse ${c.kind === "quick-change" ? "the change" : "the handoff"}.`);
  }
  if (look.locked) notes.push("Look approved and locked.");
  return notes;
}
