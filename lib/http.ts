import { NextResponse } from "next/server";
import { YouCamError } from "./youcam/client";

/** Friendly copy for the engine errors people can fix themselves. */
const HINTS: Record<string, string> = {
  error_no_face: "We couldn't find a face. Face the camera, a little closer.",
  error_src_face_too_small: "Your face is a little small in the frame. Come closer.",
  error_pose: "Try facing the camera straight on, chin level.",
  error_face_parsing: "Try a brighter spot, facing a window if you can.",
  exceed_max_filesize: "That photo is over 10MB. Try a smaller one.",
  rate_limited: "Lots of requests right now. Give it a few seconds.",
  missing_rack_photo: "This piece has no photo yet. Add one in Rack intake.",
  error_no_human: "We couldn't find a person in the photo. Use a full-body shot.",
};

export function errorResponse(err: unknown) {
  if (err instanceof YouCamError) {
    return NextResponse.json(
      { error: err.code, message: HINTS[err.code] ?? err.message },
      { status: err.status && err.status < 500 ? err.status : 502 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "internal", message: "Something went wrong on our side." }, { status: 500 });
}

export function hintFor(code: string, fallback: string) {
  return HINTS[code] ?? fallback;
}
