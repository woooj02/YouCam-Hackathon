import { NextResponse } from "next/server";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FALLBACK, hasLLM, llm, MODEL } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const Requirement = z.object({
  slot: z.enum(["base", "outer", "hat"]),
  tags: z.array(z.string()).describe("2-4 short lowercase words a wardrobe tag would use: garment type, era, fabric, mood"),
  colors: z.array(z.string()).describe("1-2 lowercase colour words"),
  optional: z.boolean(),
});

export const Breakdown = z.object({
  title: z.string(),
  logline: z.string(),
  budget: z.number().describe("Sourcing budget in the brief's currency, 0 if not stated"),
  currency: z.string(),
  performers: z.array(z.object({ name: z.string() })),
  scenes: z.array(z.object({ name: z.string() })),
  roles: z.array(z.object({ name: z.string(), performer: z.string(), summary: z.string() })),
  looks: z.array(
    z.object({
      role: z.string(),
      name: z.string(),
      scenes: z.array(z.string()).describe("Scene names, exactly as listed in scenes"),
      requirements: z.array(Requirement),
      makeup: z.string().describe("A few words of makeup direction, or empty"),
      lipColor: z.string().describe("A #RRGGBB lip colour suiting the direction, or empty"),
    }),
  ),
  questions: z.array(z.string()).describe("Up to 3 things the designer should confirm, where the brief is ambiguous"),
});
export type Breakdown = z.infer<typeof Breakdown>;

const SYSTEM = `You are the costume supervisor's assistant on a small theatre production.
Turn the designer's brief into a costume breakdown: performers, scenes in running order,
roles (each played by one performer; a performer may double roles), and the looks each role needs.
A look is one costume state worn across one or more scenes. Give each look requirements per slot:
base (the main garment), outer (coat, cardigan, shawl, cape) and hat. Mark a slot optional when
the brief doesn't need it. Tags are short lowercase words a wardrobe team would write on a rack tag.
Never invent cast members or scenes the brief doesn't imply. List genuine ambiguities as questions.`;

export async function POST(req: Request) {
  if (!hasLLM()) return NextResponse.json({ error: "no_key", message: "Add ANTHROPIC_API_KEY to break down a new brief." }, { status: 503 });
  try {
    const { brief } = (await req.json()) as { brief?: string };
    if (!brief || brief.trim().length < 40) {
      return NextResponse.json({ error: "bad_request", message: "Write a few sentences about the show first." }, { status: 400 });
    }
    const res = await llm().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Breakdown) },
      system: SYSTEM,
      messages: [{ role: "user", content: brief.slice(0, 8000) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return NextResponse.json({ error: "no_breakdown", message: "Couldn't break that brief down. Try describing the scenes and cast plainly." }, { status: 422 });
    }
    return NextResponse.json({ breakdown: res.parsed_output });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "ai_error", message: "The breakdown service is busy. Try again in a moment." }, { status: 502 });
  }
}
