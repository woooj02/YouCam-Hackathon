/** Read-only helpers the studio components share. */
import { lookImages } from "../engine/render";
import type { Item, Look, Production } from "../engine/types";

export const allItems = (p: Production): Item[] => [...p.inventory, ...p.shop];
export const itemById = (p: Production, id?: string) => (id ? allItems(p).find((i) => i.id === id) : undefined);

export function performerOf(p: Production, look: Look) {
  const role = p.roles.find((r) => r.id === look.roleId);
  return { role, performer: p.performers.find((x) => x.id === role?.performerId) };
}

export function lookState(p: Production, lookId: string) {
  const imgs = lookImages(p, lookId);
  const records = imgs.stages.map((s) => s.record);
  return {
    ...imgs,
    rendering: records.some((r) => r?.status === "running"),
    error: records.find((r) => r?.status === "error")?.error,
    done: imgs.stages.length > 0 && records.every((r) => r?.status === "done"),
    stale: imgs.stages.some((s) => !s.record),
  };
}

export const conflictsFor = (p: Production, lookId: string) => (p.plan?.conflicts ?? []).filter((c) => c.lookIds.includes(lookId));
export const gapsFor = (p: Production, lookId: string) => (p.plan?.gaps ?? []).filter((g) => g.lookId === lookId);

export const SLOT_LABEL = { base: "Costume", outer: "Outer layer", hat: "Headwear" } as const;
export const SOURCE_LABEL = { owned: "On the rack", rental: "Hire", shop: "Buy" } as const;

export const money = (p: Production, n: number) => `${p.currency}${Math.round(n).toLocaleString()}`;
