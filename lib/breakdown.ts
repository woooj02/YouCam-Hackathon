/**
 * The AI breakdown -> a Production skeleton. Pure and deterministic, so the
 * designer can preview it, correct it, then apply it. Photos and rack pieces
 * carry over by name, so re-breaking a brief never loses work.
 */
import type { Look, Performer, Production, Requirement, Role, Scene } from "./engine/types";

export type BreakdownData = {
  title: string;
  logline: string;
  budget: number;
  currency: string;
  performers: { name: string }[];
  scenes: { name: string }[];
  roles: { name: string; performer: string; summary: string }[];
  looks: { role: string; name: string; scenes: string[]; requirements: Requirement[]; makeup: string; lipColor: string }[];
  questions: string[];
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "x";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function applyBreakdown(prev: Production, b: BreakdownData, brief: string): Production {
  const performers: Performer[] = b.performers.map((x) => {
    const old = prev.performers.find((o) => same(o.name, x.name));
    return old ?? { id: `p-${slug(x.name)}`, name: x.name, size: "M", photoVersion: 0 };
  });
  const perfId = (name: string) => performers.find((x) => same(x.name, name))?.id ?? performers[0]?.id ?? "";
  const scenes: Scene[] = b.scenes.map((s, i) => ({ id: `s${i + 1}`, name: s.name, order: i + 1 }));
  const sceneId = (name: string) => scenes.find((s) => same(s.name, name))?.id;
  const roles: Role[] = b.roles.map((r) => ({ id: `r-${slug(r.name)}`, name: r.name, performerId: perfId(r.performer), summary: r.summary }));
  const roleId = (name: string) => roles.find((r) => same(r.name, name))?.id ?? roles[0]?.id ?? "";
  const looks: Look[] = b.looks.map((l, i) => ({
    id: `l-${i + 1}-${slug(l.name)}`,
    roleId: roleId(l.role),
    name: l.name,
    sceneIds: l.scenes.map(sceneId).filter((x): x is string => Boolean(x)),
    locked: false,
    requirements: dedupeSlots(l.requirements),
    makeup: l.makeup || l.lipColor
      ? { label: l.makeup || "Stage makeup", ...(/^#[0-9a-f]{6}$/i.test(l.lipColor) ? { lip: { color: l.lipColor, texture: "satin" as const } } : {}), smooth: 30 }
      : undefined,
  }));
  return {
    ...prev,
    id: slug(b.title),
    title: b.title,
    logline: b.logline,
    brief,
    budget: b.budget > 0 ? b.budget : prev.budget,
    currency: b.currency || prev.currency,
    performers,
    roles,
    scenes,
    looks,
    plan: null,
    renders: prev.renders,
    history: [...prev.history, { at: Date.now(), kind: "edit", text: `Applied a new breakdown: ${looks.length} looks across ${scenes.length} scenes.` }],
  };
}

function dedupeSlots(reqs: Requirement[]): Requirement[] {
  const seen = new Set<string>();
  return reqs.filter((r) => (seen.has(r.slot) ? false : (seen.add(r.slot), true)));
}
