import { NextResponse } from "next/server";
import { getTask } from "@/lib/youcam/client";
import { isFeatureId } from "@/lib/youcam/features";
import { findImageUrl } from "@/lib/youcam/result";
import { errorResponse, hintFor } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const feature = url.searchParams.get("feature");
    const taskId = url.searchParams.get("taskId");
    if (!isFeatureId(feature) || !taskId) {
      return NextResponse.json({ error: "bad_request", message: "feature and taskId are required" }, { status: 400 });
    }
    if (taskId.startsWith("demo:")) {
      const at = Number(taskId.split(":")[2]);
      return NextResponse.json(Date.now() - at < 1600 ? { status: "running" } : { status: "success", demo: true });
    }
    const state = await getTask(feature, taskId);
    if (state.status === "error") return NextResponse.json({ ...state, message: hintFor(state.code, state.message) });
    if (state.status === "success") {
      const imageUrl = findImageUrl(state.results);
      if (!imageUrl) return NextResponse.json({ status: "error", code: "no_image", message: "The engine finished without an image." });
      return NextResponse.json({ status: "success", url: imageUrl, demo: false });
    }
    return NextResponse.json(state);
  } catch (err) {
    return errorResponse(err);
  }
}
