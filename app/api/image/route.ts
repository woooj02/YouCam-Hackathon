import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Fetches a finished render so "Export production" can inline it: render URLs
 * are short-lived presigned links. Images only, https only, public hosts only.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  const host = target.hostname;
  if (target.protocol !== "https:" || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  const res = await fetch(target, { redirect: "error" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return NextResponse.json({ error: "not_an_image" }, { status: 502 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 12 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  return new NextResponse(buf, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
}
