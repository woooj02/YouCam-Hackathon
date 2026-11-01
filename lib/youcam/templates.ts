export type Template = { id: string; title: string; thumb: string };

/** The API has used templates, results and items as collection names. */
export function normaliseTemplates(body: unknown): Template[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const list = o.templates ?? o.results ?? o.items;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const t = entry as Record<string, unknown>;
    const id = t.id ?? t.template_id;
    if (typeof id !== "string" && typeof id !== "number") return [];
    if (!String(id)) return [];
    return [{
      id: String(id),
      title: String(t.title ?? t.name ?? "Style"),
      thumb: String(t.thumb ?? t.thumbnail ?? t.thumbnail_url ?? t.preview_url ?? t.image_url ?? ""),
    }];
  });
}
