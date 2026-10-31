/**
 * "Run this stage on this image": resolves the source (performer photo file id,
 * or the previous stage's result URL) and the reference garment, builds the
 * body and creates the task. Shared by the API routes and the director agent.
 */
import "server-only";
import { buildBody, type Job } from "./bodies";
import { createTask, isDemoMode, uploadImage, YouCamError } from "./client";
import { FEATURES } from "./features";

export type Src = { fileId: string } | { url: string };

/** Rack photos are uploaded once per warm server instance, then reused by id. */
const refCache = new Map<string, string>();

export function dataUrlToBytes(dataUrl: string): { bytes: ArrayBuffer; contentType: string } {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new YouCamError("Expected a JPEG or PNG image", "bad_image");
  const buf = Buffer.from(m[2], "base64");
  return { bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, contentType: m[1] };
}

async function resolveRef(ref: string, origin: string): Promise<Record<string, string>> {
  if (/^https:\/\//.test(ref)) return { ref_file_url: ref };
  const cached = refCache.get(ref.length > 200 ? `${ref.length}:${ref.slice(-120)}` : ref);
  if (cached) return { ref_file_id: cached };
  let bytes: ArrayBuffer;
  let contentType: string;
  if (ref.startsWith("data:")) {
    ({ bytes, contentType } = dataUrlToBytes(ref));
  } else if (ref.startsWith("/rack/") || ref.startsWith("/showcase/")) {
    const res = await fetch(new URL(ref, origin));
    if (!res.ok) throw new YouCamError(`No photo at ${ref} yet. Photograph the piece in Rack intake.`, "missing_rack_photo");
    bytes = await res.arrayBuffer();
    contentType = ref.endsWith(".png") ? "image/png" : "image/jpeg";
  } else {
    throw new YouCamError("A garment reference must be a photo, a rack path or an https URL", "bad_ref");
  }
  const fileId = await uploadImage(bytes, contentType, "garment.jpg");
  refCache.set(ref.length > 200 ? `${ref.length}:${ref.slice(-120)}` : ref, fileId);
  return { ref_file_id: fileId };
}

export async function startJob(job: Job, src: Src, origin: string): Promise<{ taskId: string; demo: boolean }> {
  if (isDemoMode()) return { taskId: `demo:${job.feature}:${Date.now()}`, demo: true };
  const srcPart: Record<string, string> = "fileId" in src ? { src_file_id: src.fileId } : { src_file_url: src.url };
  const ref = "ref" in job ? await resolveRef(job.ref, origin) : undefined;
  if (FEATURES[job.feature].needsRef && !ref) throw new YouCamError(`${job.feature} needs a garment photo`, "missing_ref");
  return { taskId: await createTask(job.feature, buildBody(job, srcPart, ref)), demo: false };
}
