/**
 * Claude, server-side. Three jobs, each with a narrow contract:
 *   - breakdown: a written brief -> scenes, roles and look requirements (structured output)
 *   - tag:       a rack photo -> name, slot, colours, tags (vision + structured output)
 *   - director:  plain-language changes -> planner ops (tool use over the real solver)
 * Prices, quantities and feasibility always come from the solver, never the model.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

/** Server-side fallback routes a policy decline to a suitable model instead of failing the request. */
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  return client;
}

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);
