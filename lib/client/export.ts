import type { Production } from "../engine/types";
import { allStages } from "../engine/render";
import { imageDataUrl } from "./images";

/** Keep the active render graph valid when portable image data changes its input keys. */
export async function portableProduction(p: Production, inline = imageDataUrl): Promise<Production> {
  const cache = new Map<string, Promise<string>>();
  const image = (url?: string) => {
    if (!url) return Promise.resolve(undefined);
    if (!cache.has(url)) cache.set(url, inline(url));
    return cache.get(url)!;
  };
  const performers = [];
  for (const performer of p.performers) performers.push({ ...performer, bodyPhoto: await image(performer.bodyPhoto), portraitPhoto: await image(performer.portraitPhoto) });
  const inventory = [], shop = [];
  for (const item of p.inventory) inventory.push({ ...item, image: await image(item.image) });
  for (const item of p.shop) shop.push({ ...item, image: await image(item.image) });
  const out: Production = { ...p, performers, inventory, shop, renders: {} };
  const oldStages = allStages(p), newStages = allStages(out);
  for (const stage of newStages) {
    const original = oldStages.find((s) => s.lookId === stage.lookId && s.stage === stage.stage);
    const record = original && p.renders[original.key];
    if (!record || record.status !== "done" || !record.url) continue;
    const { taskId: _taskId, creationPending: _pending, ...finished } = record;
    out.renders[stage.key] = { ...finished, key: stage.key, url: await image(record.url) };
  }
  return out;
}

/** Download a self-contained production. Publishing performer photos is a separate choice. */
export async function exportProduction(p: Production): Promise<void> {
  const out = await portableProduction(p);
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "production.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
