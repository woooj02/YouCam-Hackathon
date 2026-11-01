import { NextResponse } from "next/server";
import { z } from "zod";
import { hasLLM, structured } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const Tag = z.object({
  name: z.string().describe("Short rack-tag name, e.g. 'Navy wool greatcoat'"),
  slot: z.enum(["base", "outer", "hat"]),
  garmentCategory: z.enum(["upper_body", "lower_body", "full_body", "outer", "auto"]).describe("full_body for dresses, gowns, suits worn as one; outer for coats, cardigans, shawls, capes; auto for hats"),
  colors: z.array(z.string()).describe("1-2 lowercase colour words"),
  tags: z.array(z.string()).describe("3-6 lowercase words: garment type, era, fabric, mood"),
  condition: z.string().describe("Visible condition notes, or empty"),
  usable: z.boolean().describe("False if the photo doesn't clearly show one garment or hat"),
});

/** Rack intake: a photo of one piece becomes an editable rack tag. The designer confirms it. */
export async function POST(req: Request) {
  if (!hasLLM()) return NextResponse.json({ error: "no_key", message: "Assisted tagging is not configured. Add the piece's name, sizes and tags by hand." }, { status: 503 });
  try {
    const { image } = (await req.json()) as { image?: string };
    const m = image && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image);
    if (!m) return NextResponse.json({ error: "bad_request", message: "Send one JPEG or PNG photo." }, { status: 400 });
    const tag = await structured(Tag, {
      text: "Tag this piece for a theatre costume rack. Describe only what you can see.",
      image: { mimeType: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] },
      effort: "low",
      maxTokens: 4000,
    });
    if (!tag) {
      return NextResponse.json({ error: "no_tag", message: "Couldn't read that photo. Tag it by hand." }, { status: 422 });
    }
    return NextResponse.json({ tag });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "ai_error", message: "Tagging is busy. Tag by hand or retry." }, { status: 502 });
  }
}
