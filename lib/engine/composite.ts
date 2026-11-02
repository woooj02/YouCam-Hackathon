/**
 * Pure geometry for the complete-look head composite. Shared by the browser
 * (canvas) and the render scripts (sharp) so both paste the head back the same
 * way, and unit-tested without any image library.
 */
import type { HeadBox } from "./types";

/** A standing, full-length photo framed like the showcase cast: head in the top-centre. */
export const DEFAULT_HEAD_BOX: HeadBox = { x: 0.37, y: 0.02, w: 0.26, h: 0.2 };
/** Long side the head crop is resized to before the hair and makeup APIs see it. */
export const CROP_LONG_SIDE = 1024;
/** Share of the crop's half-size used for the soft edge of the mask. */
export const FEATHER = 0.28;

export type Rect = { left: number; top: number; width: number; height: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The square pixel rectangle to crop: the head box grown by `margin` on every
 * side (hair needs room), clamped inside the image.
 */
export function headCropRect(box: HeadBox, width: number, height: number, margin = 0.35): Rect {
  const cx = (box.x + box.w / 2) * width;
  const cy = (box.y + box.h / 2) * height;
  const side = Math.round(Math.min(width, height, Math.max(box.w * width, box.h * height) * (1 + 2 * margin)));
  const left = Math.round(clamp(cx - side / 2, 0, width - side));
  const top = Math.round(clamp(cy - side / 2, 0, height - side));
  return { left, top, width: side, height: side };
}

/** Size the crop is scaled to for the API, keeping its aspect ratio. */
export function upscaleSize(rect: Rect, longSide = CROP_LONG_SIDE): { width: number; height: number } {
  const k = longSide / Math.max(rect.width, rect.height);
  return { width: Math.round(rect.width * k), height: Math.round(rect.height * k) };
}

/**
 * Mask alpha (0..1) at pixel (x, y) of a crop of size w x h: 1 inside an
 * ellipse around the head, fading to 0 at the crop edge. The made-up head
 * replaces the clothed render only where alpha > 0, so collars and shoulders
 * from the costume stay untouched below the jaw.
 */
export function featherAlpha(x: number, y: number, w: number, h: number, feather = FEATHER): number {
  const nx = (x + 0.5 - w / 2) / (w / 2);
  // Bias the ellipse upward: hair sits above the face, the neckline below it belongs to the costume.
  const ny = (y + 0.5 - h * 0.46) / (h * 0.46);
  const r = Math.sqrt(nx * nx + ny * ny);
  const inner = 1 - feather;
  if (r <= inner) return 1;
  if (r >= 1) return 0;
  const t = (r - inner) / feather;
  return 1 - t * t * (3 - 2 * t);
}

/** Full alpha plane for a w x h crop, row-major. */
export function featherMask(w: number, h: number, feather = FEATHER): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = featherAlpha(x, y, w, h, feather);
  return out;
}

/**
 * Blend RGBA `head` (already resized to rect size) into RGBA `base` (width
 * baseW) at rect, in place. Pure, so the scripts and tests share it.
 */
export function blendInto(base: Uint8ClampedArray | Uint8Array, baseW: number, head: Uint8ClampedArray | Uint8Array, rect: Rect, mask = featherMask(rect.width, rect.height)): void {
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const a = mask[y * rect.width + x];
      if (a <= 0) continue;
      const bi = ((rect.top + y) * baseW + rect.left + x) * 4;
      const hi = (y * rect.width + x) * 4;
      for (let c = 0; c < 3; c++) base[bi + c] = Math.round(base[bi + c] * (1 - a) + head[hi + c] * a);
    }
  }
}

/**
 * Match the head crop's tone to the image it goes back into. A try-on call can
 * shift the whole crop slightly (brighter, cooler), which shows as a pale oval
 * once pasted. Compare per-channel means over the feathered ring, where both
 * images show the same background, and scale the crop's channels to match.
 */
export function matchTone(base: Uint8ClampedArray | Uint8Array, baseW: number, head: Uint8ClampedArray | Uint8Array, rect: Rect, mask = featherMask(rect.width, rect.height)): void {
  const sumBase = [0, 0, 0], sumHead = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const a = mask[y * rect.width + x];
      if (a <= 0 || a >= 0.95) continue;
      const bi = ((rect.top + y) * baseW + rect.left + x) * 4;
      const hi = (y * rect.width + x) * 4;
      for (let c = 0; c < 3; c++) { sumBase[c] += base[bi + c]; sumHead[c] += head[hi + c]; }
      n++;
    }
  }
  if (!n) return;
  // Capped at ±10%: enough for the drift a try-on call adds, never enough to undo the makeup itself.
  const gain = sumBase.map((b, c) => (sumHead[c] > 0 ? Math.min(1.1, Math.max(0.9, b / sumHead[c])) : 1));
  for (let i = 0; i < head.length; i += 4) for (let c = 0; c < 3; c++) head[i + c] = Math.max(0, Math.min(255, Math.round(head[i + c] * gain[c])));
}
