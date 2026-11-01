/** Node side of the complete-look composite (sharp), sharing the math in lib/engine/composite.ts. */
import sharp from "sharp";
import { blendInto, featherMask, headCropRect, upscaleSize } from "../../lib/engine/composite.ts";
import type { HeadBox } from "../../lib/engine/types.ts";

export async function cropHeadFile(source: Buffer, box: HeadBox): Promise<Buffer> {
  const meta = await sharp(source).metadata();
  const rect = headCropRect(box, meta.width!, meta.height!);
  const size = upscaleSize(rect);
  return sharp(source).extract(rect).resize(size.width, size.height, { kernel: "lanczos3" }).jpeg({ quality: 92 }).toBuffer();
}

export async function pasteHeadFile(clothed: Buffer, head: Buffer, box: HeadBox): Promise<Buffer> {
  const { data, info } = await sharp(clothed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rect = headCropRect(box, info.width, info.height);
  const scaled = await sharp(head).resize(rect.width, rect.height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const out = new Uint8Array(data);
  blendInto(out, info.width, new Uint8Array(scaled), rect, featherMask(rect.width, rect.height));
  return sharp(Buffer.from(out), { raw: { width: info.width, height: info.height, channels: 4 } }).jpeg({ quality: 90 }).toBuffer();
}
