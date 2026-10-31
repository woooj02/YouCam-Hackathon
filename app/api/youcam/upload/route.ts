import { NextResponse } from "next/server";
import { isDemoMode, uploadImage } from "@/lib/youcam/client";
import { dataUrlToBytes } from "@/lib/youcam/run";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

/** Upload a performer photo once; every stage that starts from it reuses the file id. */
export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image) return NextResponse.json({ error: "bad_request", message: "image is required" }, { status: 400 });
    if (isDemoMode()) return NextResponse.json({ fileId: `demo-file-${Date.now()}`, demo: true });
    const { bytes, contentType } = dataUrlToBytes(image);
    return NextResponse.json({ fileId: await uploadImage(bytes, contentType), demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
