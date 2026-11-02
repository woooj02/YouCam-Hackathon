/** Browser side of the complete-look composite: canvas crop and feathered paste. */
import { blendInto, featherMask, headCropRect, matchTone, upscaleSize } from "../engine/composite";
import type { HeadBox } from "../engine/types";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load an image for the head composite."));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  return { c, ctx };
}

/** Crop the head region out of a full-body image and scale it up for the styling APIs. */
export async function cropHead(src: string, box: HeadBox): Promise<string> {
  const img = await load(src);
  const rect = headCropRect(box, img.naturalWidth, img.naturalHeight);
  const size = upscaleSize(rect);
  const { c, ctx } = canvas(size.width, size.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, size.width, size.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/** Paste the styled head back onto the clothed render through a feathered elliptical mask. */
export async function pasteHead(baseSrc: string, headSrc: string, box: HeadBox): Promise<string> {
  const [base, head] = await Promise.all([load(baseSrc), load(headSrc)]);
  const W = base.naturalWidth, H = base.naturalHeight;
  const rect = headCropRect(box, W, H);
  const out = canvas(W, H);
  out.ctx.drawImage(base, 0, 0);
  const scaled = canvas(rect.width, rect.height);
  scaled.ctx.imageSmoothingQuality = "high";
  scaled.ctx.drawImage(head, 0, 0, rect.width, rect.height);
  const baseData = out.ctx.getImageData(0, 0, W, H);
  const headData = scaled.ctx.getImageData(0, 0, rect.width, rect.height);
  const mask = featherMask(rect.width, rect.height);
  // Same as the showcase script: match the styled head's tone to the body around the seam, then blend.
  matchTone(baseData.data, W, headData.data, rect, mask);
  blendInto(baseData.data, W, headData.data, rect, mask);
  out.ctx.putImageData(baseData, 0, 0);
  return out.c.toDataURL("image/jpeg", 0.92);
}
