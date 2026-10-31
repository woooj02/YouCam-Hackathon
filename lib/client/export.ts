/**
 * Export a fully rendered production as one JSON file with every image
 * inlined. Commit it as public/showcase/production.json and the deployed
 * showcase opens with the real cast renders, no key needed to view them.
 */
import type { Production } from "../engine/types";

async function inline(url: string | undefined): Promise<string | undefined> {
  if (!url || url.startsWith("data:")) return url;
  const res = await fetch(`/api/image?url=${encodeURIComponent(url)}`);
  if (!res.ok) return url;
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

export async function exportProduction(p: Production): Promise<void> {
  const renders: Production["renders"] = {};
  for (const [k, rec] of Object.entries(p.renders)) {
    if (rec.status !== "done") continue;
    renders[k] = { ...rec, url: await inline(rec.url) };
  }
  const out: Production = { ...p, renders };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "production.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
