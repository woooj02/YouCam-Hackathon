/**
 * The director: plain-language production changes ("the navy coat has moth
 * damage", "lock Elsie's party look", "make Quill's coat black") become planner
 * ops. The model reads and acts through tools; every number it reports comes from
 * the solver's output, and the browser replays the returned ops on the full
 * production so both sides agree.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { applyOp, type Op } from "./engine/ops";
import { lightweight } from "./engine/light";
import { usesOf } from "./engine/solver";
import type { Production, Slot } from "./engine/types";
import { FALLBACK, gemini, geminiSchema, llm, MODEL, provider, type GeminiContent } from "./ai";

const SYSTEM = `You are ENCORE's production director, working with a theatre costume designer.
You change the wardrobe plan only through your tools, and you report only what the tools return:
item names, prices, budget totals and which looks changed. Never invent stock, prices or sizes.
When the designer says a piece is lost, damaged, late or unavailable, find it, then mark it unavailable.
When they ask to change what a look needs, use change_requirement. Approved looks can be locked.
Answer in two or three short sentences a busy designer can read at a glance: what changed, what it costs,
and anything they must decide or check at a fitting. Previews show appearance, not fit.`;

type ToolDef = Anthropic.Beta.BetaTool;

const TOOLS: ToolDef[] = [
  {
    name: "production_summary",
    description: "Current plan: every look with its role, performer, scenes and assigned pieces; gaps; conflicts; budget.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "find_items",
    description: "Search the rack and the partner shop by words in the name or tags. Returns ids, prices, sizes, availability and which looks use each piece.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    strict: true,
  },
  {
    name: "mark_unavailable",
    description: "A piece can no longer be used. Re-plans only the looks that used it and returns what changed.",
    input_schema: {
      type: "object",
      properties: { item_id: { type: "string" }, reason: { type: "string" } },
      required: ["item_id", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "restore_item",
    description: "A piece is back and can be used again.",
    input_schema: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"], additionalProperties: false },
    strict: true,
  },
  {
    name: "change_requirement",
    description: "Change what one look needs in one slot (base, outer or hat), then re-plan just that slot.",
    input_schema: {
      type: "object",
      properties: {
        look_id: { type: "string" },
        slot: { type: "string", enum: ["base", "outer", "hat"] },
        tags: { type: "array", items: { type: "string" } },
        colors: { type: "array", items: { type: "string" } },
      },
      required: ["look_id", "slot", "tags", "colors"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "lock_look",
    description: "Lock an approved look so no re-plan changes it, or unlock it.",
    input_schema: {
      type: "object",
      properties: { look_id: { type: "string" }, locked: { type: "boolean" } },
      required: ["look_id", "locked"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "set_budget",
    description: "Change the sourcing budget and re-plan unlocked looks.",
    input_schema: { type: "object", properties: { budget: { type: "number" } }, required: ["budget"], additionalProperties: false },
    strict: true,
  },
];

function summary(p: Production) {
  const items = new Map([...p.inventory, ...p.shop].map((i) => [i.id, i]));
  return {
    budget: p.budget,
    currency: p.currency,
    spent: p.plan?.cost ?? 0,
    looks: p.looks.map((l) => {
      const role = p.roles.find((r) => r.id === l.roleId);
      return {
        look_id: l.id,
        name: l.name,
        role: role?.name,
        performer: p.performers.find((x) => x.id === role?.performerId)?.name,
        scenes: l.sceneIds.map((s) => p.scenes.find((x) => x.id === s)?.name),
        locked: l.locked,
        pieces: Object.fromEntries(
          Object.entries(p.plan?.assignment[l.id] ?? {}).map(([slot, id]) => [slot, { id, name: items.get(id!)?.name }]),
        ),
      };
    }),
    gaps: p.plan?.gaps ?? [],
    conflicts: (p.plan?.conflicts ?? []).map((c) => c.message),
  };
}

function findItems(p: Production, query: string) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return [...p.inventory, ...p.shop]
    .map((i) => {
      const hay = `${i.name} ${i.tags.join(" ")} ${i.colors.join(" ")}`.toLowerCase();
      return { i, hits: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 8)
    .map(({ i }) => ({
      id: i.id, name: i.name, slot: i.slot, source: i.source, cost: i.cost, vendor: i.vendor, sizes: i.sizes, qty: i.qty,
      available: i.available, used_by: usesOf(p, i.id).map((u) => `${u.lookId}:${u.slot}`),
    }));
}

export type DirectorResult = { reply: string; ops: Op[]; affected: string[]; offline: boolean };

export async function direct(production: Production, message: string, history: { role: "user" | "assistant"; text: string }[]): Promise<DirectorResult> {
  let p = lightweight(production);
  const ops: Op[] = [];
  const affected = new Set<string>();

  const run = (op: Op) => {
    const r = applyOp(p, op);
    p = r.production;
    ops.push(op);
    r.affected.forEach((a) => affected.add(a));
    return { summary: r.summary, changes: r.changes, budget: { spent: p.plan?.cost, of: p.budget }, gaps: p.plan?.gaps };
  };

  const exec = (name: string, input: Record<string, unknown>): unknown => {
    const known = (id: unknown) => [...p.inventory, ...p.shop].some((i) => i.id === id);
    const knownLook = (id: unknown) => p.looks.some((l) => l.id === id);
    switch (name) {
      case "production_summary":
        return summary(p);
      case "find_items":
        return findItems(p, String(input.query ?? ""));
      case "mark_unavailable":
        if (!known(input.item_id)) return { error: "No piece with that id. Use find_items first." };
        return run({ type: "unavailable", itemId: String(input.item_id), reason: String(input.reason ?? "") });
      case "restore_item":
        if (!known(input.item_id)) return { error: "No piece with that id." };
        return run({ type: "restore", itemId: String(input.item_id) });
      case "change_requirement":
        if (!knownLook(input.look_id)) return { error: "No look with that id. Use production_summary." };
        return run({ type: "requirement", lookId: String(input.look_id), slot: input.slot as Slot, tags: (input.tags as string[]) ?? [], colors: (input.colors as string[]) ?? [] });
      case "lock_look":
        if (!knownLook(input.look_id)) return { error: "No look with that id." };
        return run({ type: "lock", lookId: String(input.look_id), locked: Boolean(input.locked) });
      case "set_budget":
        return run({ type: "budget", budget: Number(input.budget) });
      default:
        return { error: `Unknown tool ${name}` };
    }
  };

  if (provider() === "gemini") {
    const contents: GeminiContent[] = [
      ...history.slice(-8).map((h) => ({ role: h.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];
    const declarations = TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.input_schema) }));
    for (let turn = 0; turn < 8; turn++) {
      const res = await gemini({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        tools: [{ functionDeclarations: declarations }],
        generationConfig: { maxOutputTokens: 8192 },
      });
      const content = res.candidates?.[0]?.content;
      if (!content?.parts?.length) return { reply: "I can only help with the wardrobe plan.", ops, affected: [...affected], offline: false };
      contents.push({ role: "model", parts: content.parts });
      const calls = content.parts.filter((x) => x.functionCall).map((x) => x.functionCall!);
      if (!calls.length) {
        const reply = content.parts.map((x) => x.text ?? "").join("\n").trim();
        return { reply: reply || "Done.", ops, affected: [...affected], offline: false };
      }
      contents.push({
        role: "user",
        parts: calls.map((c) => ({ functionResponse: { name: c.name, response: { result: exec(c.name, c.args ?? {}) } } })),
      });
    }
    return { reply: "I made the changes above; ask me to keep going if anything is left.", ops, affected: [...affected], offline: false };
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: message },
  ];

  for (let turn = 0; turn < 8; turn++) {
    const res = await llm().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    if (res.stop_reason === "refusal") {
      return { reply: "I can only help with the wardrobe plan.", ops, affected: [...affected], offline: false };
    }
    messages.push({ role: "assistant", content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !calls.length) {
      const reply = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { reply: reply || "Done.", ops, affected: [...affected], offline: false };
    }
    messages.push({
      role: "user",
      content: calls.map((c) => {
        const out = exec(c.name, (c.input ?? {}) as Record<string, unknown>);
        return { type: "tool_result" as const, tool_use_id: c.id, content: JSON.stringify(out), is_error: Boolean((out as { error?: string })?.error) };
      }),
    });
  }
  return { reply: "I made the changes above; ask me to keep going if anything is left.", ops, affected: [...affected], offline: false };
}

/**
 * No model key: understand the one sentence every show eventually says,
 * "<piece> is gone", so the replanning demo works offline too.
 */
export function directOffline(production: Production, message: string): DirectorResult {
  const p = lightweight(production);
  const m = message.toLowerCase();
  if (/(unavailable|gone|lost|missing|torn|ripped|damage|stain|broke|fell through|can't use|cannot use|isn't coming|not coming)/.test(m)) {
    const best = findItems(p, m).find((i) => i.available && i.used_by.length) ?? findItems(p, m).find((i) => i.available);
    if (best) {
      const r = applyOp(p, { type: "unavailable", itemId: best.id, reason: "reported by the designer" });
      return { reply: r.summary, ops: [{ type: "unavailable", itemId: best.id, reason: "reported by the designer" }], affected: r.affected, offline: true };
    }
  }
  if (/re-?plan|plan it|build the plan/.test(m)) {
    const r = applyOp(p, { type: "plan" });
    return { reply: r.summary, ops: [{ type: "plan" }], affected: r.affected, offline: true };
  }
  return { reply: "Tell me which piece is damaged, missing or unavailable, or say \"re-plan\" to rebuild the cast's plan.", ops: [], affected: [], offline: true };
}
