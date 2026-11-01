/**
 * The language model, server-side. Three jobs, each with a narrow contract:
 *   - breakdown: a written brief -> scenes, roles and look requirements (structured output)
 *   - tag:       a rack photo -> name, slot, colours, tags (vision + structured output)
 *   - director:  plain-language changes -> planner ops (tool use over the real solver)
 * Prices, quantities and feasibility always come from the solver, never the model.
 *
 * Optional providers, picked by which key is set: GEMINI_API_KEY or
 * ANTHROPIC_API_KEY. Both return output validated by the same zod schemas.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5-5";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** Server-side fallback routes a policy decline to a suitable model instead of failing the request. */
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export type Provider = "anthropic" | "gemini";
export function provider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
export const hasLLM = () => provider() !== null;

let client: Anthropic | null = null;
export function llm(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  return client;
}

// ---------------------------------------------------------------- Gemini (REST)

export type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiResponse = { candidates?: { content?: GeminiContent; finishReason?: string }[]; error?: { message?: string } };

export async function gemini(body: Record<string, unknown>): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) throw Object.assign(new Error(json.error?.message ?? `Gemini HTTP ${res.status}`), { status: res.status });
  return json;
}

/** Drops JSON Schema keywords Gemini's tool declarations don't accept. */
export function geminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== "object") return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "additionalProperties" || k === "$schema" || k === "strict") continue;
    out[k] = geminiSchema(v);
  }
  return out;
}

const firstJson = (text: string) => {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const start = t.indexOf("{");
  return JSON.parse(start > 0 ? t.slice(start, t.lastIndexOf("}") + 1) : t);
};

// ---------------------------------------------------------------- structured output

type StructuredInput = {
  system?: string;
  text: string;
  image?: { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string };
  effort: "low" | "medium";
  maxTokens: number;
};

/** One prompt in, one schema-valid object out (or null when the model declines). */
export async function structured<T extends z.ZodType>(schema: T, input: StructuredInput): Promise<z.infer<T> | null> {
  if (provider() === "anthropic") {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mimeType, data: input.image.data } });
    content.push({ type: "text", text: input.text });
    const res = await llm().beta.messages.parse({
      model: MODEL,
      max_tokens: input.maxTokens,
      ...FALLBACK,
      output_config: { effort: input.effort, format: betaZodOutputFormat(schema) },
      ...(input.system ? { system: input.system } : {}),
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    return res.parsed_output as z.infer<T>;
  }

  const jsonSchema = geminiSchema(z.toJSONSchema(schema));
  const parts: GeminiPart[] = [];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.data } });
  const ask = (withSchemaInPrompt: boolean) => ({
    ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
    contents: [
      {
        role: "user",
        parts: [
          ...parts,
          { text: withSchemaInPrompt ? `${input.text}\n\nReply with only JSON matching this schema:\n${JSON.stringify(jsonSchema)}` : input.text },
        ],
      },
    ],
    generationConfig: {
      // Thinking tokens count against this limit on Gemini, so leave headroom.
      maxOutputTokens: Math.max(input.maxTokens, 8192),
      responseMimeType: "application/json",
      ...(withSchemaInPrompt ? {} : { responseJsonSchema: jsonSchema }),
    },
  });

  let res: GeminiResponse;
  try {
    res = await gemini(ask(false));
  } catch (err) {
    // Older models reject some schema keywords; fall back to schema-in-prompt plus validation.
    if ((err as { status?: number }).status !== 400) throw err;
    res = await gemini(ask(true));
  }
  const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) return null;
  const parsed = schema.safeParse(firstJson(text));
  return parsed.success ? parsed.data : null;
}
