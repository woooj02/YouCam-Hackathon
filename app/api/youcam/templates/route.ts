import { NextResponse } from "next/server";
import { isDemoMode, listTemplates } from "@/lib/youcam/client";
import { isFeatureId } from "@/lib/youcam/features";
import { errorResponse } from "@/lib/http";
import { normaliseTemplates } from "@/lib/youcam/templates";
import type { Template } from "@/lib/youcam/templates";

export const runtime = "nodejs";

const DEMO_TEMPLATES = [
  { id: "demo-finger-waves", title: "Finger waves", thumb: "" },
  { id: "demo-bob", title: "Sleek bob", thumb: "" },
  { id: "demo-updo", title: "Low updo", thumb: "" },
  { id: "demo-crop", title: "Short crop", thumb: "" },
];
const cached = new Map<string, { until: number; templates: Template[] }>();

export async function GET(req: Request) {
  try {
    const feature = new URL(req.url).searchParams.get("feature");
    if (!isFeatureId(feature)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (isDemoMode()) return NextResponse.json({ templates: DEMO_TEMPLATES, demo: true });
    let catalogue = cached.get(feature);
    if (!catalogue || catalogue.until < Date.now()) {
      const templates = new Map<string, Template>();
      const seen = new Set<string>();
      let token: string | undefined;
      for (let page = 0; page < 20; page++) {
        const body = await listTemplates(feature, 20, token) as { data?: { next_token?: string } };
        for (const template of normaliseTemplates(body)) templates.set(template.id, template);
        token = body.data?.next_token;
        if (!token || seen.has(token)) break;
        seen.add(token);
      }
      catalogue = { templates: [...templates.values()], until: Date.now() + 15 * 60_000 };
      cached.set(feature, catalogue);
    }
    return NextResponse.json({ templates: catalogue.templates, demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
