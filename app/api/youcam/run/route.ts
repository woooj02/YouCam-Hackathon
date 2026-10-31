import { NextResponse } from "next/server";
import { Job } from "@/lib/youcam/bodies";
import { startJob } from "@/lib/youcam/run";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Create one render-stage task. The source is either the performer photo's
 * file id (first stage of a chain) or the previous stage's result URL.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { job?: unknown; fileId?: string; srcUrl?: string };
    const job = Job.safeParse(body.job);
    if (!job.success) {
      return NextResponse.json({ error: "invalid_job", message: job.error.issues[0]?.message }, { status: 400 });
    }
    if (!body.srcUrl && !body.fileId) {
      return NextResponse.json({ error: "bad_request", message: "fileId or srcUrl is required" }, { status: 400 });
    }
    if (body.srcUrl && !/^https:\/\//.test(body.srcUrl)) {
      return NextResponse.json({ error: "bad_request", message: "srcUrl must be https" }, { status: 400 });
    }
    const src = body.srcUrl ? { url: body.srcUrl } : { fileId: body.fileId! };
    const started = await startJob(job.data, src, new URL(req.url).origin);
    return NextResponse.json({ ...started, feature: job.data.feature });
  } catch (err) {
    return errorResponse(err);
  }
}
