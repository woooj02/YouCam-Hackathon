import { NextResponse } from "next/server";
import { isDemoMode, listTemplates } from "@/lib/youcam/client";
import { isFeatureId } from "@/lib/youcam/features";
import { errorResponse } from "@/lib/http";
import { normaliseTemplates } from "@/lib/youcam/templates";

export const runtime = "nodejs";

const DEMO_TEMPLATES = [
  { id: "demo-finger-waves", title: "Finger waves", thumb: "" },
  { id: "demo-bob", title: "Sleek bob", thumb: "" },
  { id: "demo-updo", title: "Low updo", thumb: "" },
  { id: "demo-crop", title: "Short crop", thumb: "" },
];

export async function GET(req: Request) {
  try {
    const feature = new URL(req.url).searchParams.get("feature");
    if (!isFeatureId(feature)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (isDemoMode()) return NextResponse.json({ templates: DEMO_TEMPLATES, demo: true });
    return NextResponse.json({ templates: normaliseTemplates(await listTemplates(feature)), demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
