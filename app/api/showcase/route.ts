import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
function localHost(host: string | null): boolean {
  if (!host) return false;
  try { return LOCAL.has(new URL(`http://${host}`).hostname); } catch { return false; }
}

/** A private rehearsal bundle is served only by an explicitly enabled loopback app. */
export async function GET(request: Request) {
  const host = new URL(request.url).hostname;
  const forwarded = request.headers.get("x-forwarded-host");
  // Next can normalize request.url to its configured hostname. Check the actual
  // request authority too, so a forwarded public request never receives photos.
  if (process.env.ENCORE_LOCAL_SHOWCASE !== "1" || process.env.VERCEL || !LOCAL.has(host) ||
      !localHost(request.headers.get("host")) || (forwarded && !localHost(forwarded))) {
    return new Response(null, { status: 404 });
  }
  try {
    const bundle = new URL(request.url).searchParams.get("take") === "film" ? ".local/film/production.json" : ".local/showcase/production.json";
    // Local rehearsal files are runtime-only and must never be bundled for deployment.
    const json = await readFile(join(/* turbopackIgnore: true */ process.cwd(), bundle), "utf8");
    return new Response(json, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
