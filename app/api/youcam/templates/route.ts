import { NextResponse } from "next/server";
import { isDemoMode, listTemplates } from "@/lib/youcam/client";
import { isFeatureId } from "@/lib/youcam/features";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

const DEMO_TEMPLATES = [
  { id: "demo-finger-waves", title: "Finger waves", thumb: "" },
  { id: "demo-bob", title: "Sleek bob", thumb: "" },
  { id: "demo-updo", title: "Low updo", thumb: "" },
  { id: "demo-crop", title: "Short crop", thumb: "" },
];

/** Normalise Perfect Corp's template list into {id, title, thumb}. */
function normalise(body: unknown) {
  const data = (body as { data?: unknown })?.data as Record<string, unknown> | undefined;
  const list = (data?.templates ?? data?.results ?? data?.items ?? []) as Record<string, unknown>[];
  return list
    .map((t) => ({
      id: String(t.id ?? t.template_id ?? ""),
      title: String(t.title ?? t.name ?? "Style"),
      thumb: String(t.thumb ?? t.thumbnail ?? t.thumbnail_url ?? t.preview_url ?? t.image_url ?? ""),
    }))
    .filter((t) => t.id);
}

export async function GET(req: Request) {
  try {
    const feature = new URL(req.url).searchParams.get("feature");
    if (!isFeatureId(feature)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (isDemoMode()) return NextResponse.json({ templates: DEMO_TEMPLATES, demo: true });
    return NextResponse.json({ templates: normalise(await listTemplates(feature)), demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
