/** VTO features return an edited image; find its URL wherever the engine put it. */
export function findImageUrl(results: unknown): string | undefined {
  if (!results) return undefined;
  if (typeof results === "string") return /^https?:\/\//.test(results) ? results : undefined;
  if (Array.isArray(results)) {
    for (const r of results) {
      const u = findImageUrl(r);
      if (u) return u;
    }
    return undefined;
  }
  if (typeof results === "object") {
    const o = results as Record<string, unknown>;
    for (const key of ["url", "output_url", "result_url", "image_url"]) {
      const u = findImageUrl(o[key]);
      if (u) return u;
    }
    for (const v of Object.values(o)) {
      const u = findImageUrl(v);
      if (u) return u;
    }
  }
  return undefined;
}

/** Pull a numeric balance out of the credit endpoint's response. */
export function findBalance(body: unknown): number | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const results = (body as Record<string, unknown>).results;
  if (Array.isArray(results)) {
    let total = 0;
    for (const entry of results) {
      if (!entry || typeof entry !== "object") return undefined;
      const row = entry as Record<string, unknown>;
      if (typeof row.expiry === "number" && row.expiry <= Date.now()) continue;
      const amount = typeof row.amount_dec === "number" ? row.amount_dec : row.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount)) return undefined;
      total += amount;
    }
    return Math.round(total * 100) / 100;
  }
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (typeof v === "number" && /credit|amount|balance|unit/i.test(k)) return v;
    const nested = findBalance(v);
    if (nested !== undefined) return nested;
  }
  return undefined;
}
