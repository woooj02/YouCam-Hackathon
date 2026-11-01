/**
 * The render graph. Each look is two short chains of YouCam calls:
 *
 *   body:     performer photo -> base garment (Clothes VTO) -> outer layer (Clothes VTO, "outer")
 *   portrait: performer close-up -> hairstyle (Hairstyle VTO) -> makeup (Makeup VTO)
 *
 * Headwear stays in the wardrobe plan for a physical fitting. The Hat API
 * regenerated the outfit, scene and face in the live composition check, so
 * it is excluded from these previews instead of overwriting approved layers.
 *
 * Every stage gets a content key: a hash of its own inputs plus its parent's
 * key. Change a garment and only that stage and the stages after it re-key;
 * everything else keeps its finished render. That is what makes a replan
 * cheap: a lost coat re-renders one outer layer, not the whole cast.
 */
import type { Item, Look, Performer, Production, RenderRecord, StageId } from "./types";

export type StageSpec = {
  key: string;
  lookId: string;
  stage: StageId;
  chain: "body" | "portrait";
  /** Key of the stage whose output is this stage's input; undefined = performer photo. */
  parentKey?: string;
  feature: "cloth" | "hair-transfer" | "makeup-vto" | "hat";
  /** Body sent to /api/youcam/run (minus the source image). */
  job: Record<string, unknown>;
  label: string;
  /** Estimated units, from Perfect Corp's published per-feature pricing. */
  units: number;
};

/** Published unit costs per call (Clothes V4, Hairstyle V2.1, Makeup VTO, Hat VTO). */
export const UNIT_COST: Record<StageSpec["feature"], number> = { cloth: 2, "hair-transfer": 2, "makeup-vto": 1, hat: 2 };

export const API_NAME: Record<StageSpec["feature"], string> = {
  cloth: "AI Clothes Virtual Try-On",
  "hair-transfer": "AI Hairstyle Virtual Try-On",
  "makeup-vto": "AI Makeup Virtual Try-On",
  hat: "AI Hat Virtual Try-On",
};

/** FNV-1a, 32-bit, hex. Deterministic and dependency-free. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const imageRef = (it: Item) => `${it.id}:${hash(it.image ?? "")}`;

export function stagesForLook(p: Production, look: Look): StageSpec[] {
  const role = p.roles.find((r) => r.id === look.roleId);
  const perf: Performer | undefined = p.performers.find((x) => x.id === role?.performerId);
  if (!perf) return [];
  const assigned = p.plan?.assignment[look.id] ?? {};
  const item = (id?: string) => (id ? [...p.inventory, ...p.shop].find((i) => i.id === id) : undefined);
  const out: StageSpec[] = [];

  // Body chain.
  let parent: string | undefined;
  const bodyRoot = `body:${p.id}:${perf.id}:${perf.photoVersion}`;
  const base = item(assigned.base);
  if (base) {
    const key = hash(`${bodyRoot}|base|${imageRef(base)}|${base.garmentCategory}`);
    out.push({ key, lookId: look.id, stage: "base", chain: "body", feature: "cloth", label: base.name, units: UNIT_COST.cloth,
      job: { feature: "cloth", ref: base.image, category: base.garmentCategory } });
    parent = key;
  }
  const outer = item(assigned.outer);
  if (outer) {
    const key = hash(`${parent ?? bodyRoot}|outer|${imageRef(outer)}`);
    out.push({ key, lookId: look.id, stage: "outer", chain: "body", parentKey: parent, feature: "cloth", label: outer.name, units: UNIT_COST.cloth,
      job: { feature: "cloth", ref: outer.image, category: "outer" } });
  }

  // Portrait chain.
  parent = undefined;
  const faceRoot = `face:${p.id}:${perf.id}:${perf.photoVersion}`;
  if (look.hair) {
    const key = hash(`${faceRoot}|hair|${look.hair.templateId}|${look.hair.keepColor}`);
    out.push({ key, lookId: look.id, stage: "hair", chain: "portrait", feature: "hair-transfer", label: look.hair.label, units: UNIT_COST["hair-transfer"],
      job: { feature: "hair-transfer", templateId: look.hair.templateId, hairColor: look.hair.keepColor ? "src" : "ref" } });
    parent = key;
  }
  if (look.makeup) {
    const key = hash(`${parent ?? faceRoot}|makeup|${JSON.stringify(look.makeup)}`);
    out.push({ key, lookId: look.id, stage: "makeup", chain: "portrait", parentKey: parent, feature: "makeup-vto", label: look.makeup.label, units: UNIT_COST["makeup-vto"],
      job: { feature: "makeup-vto", makeup: look.makeup } });
  }
  return out;
}

export function allStages(p: Production): StageSpec[] {
  return p.looks.flatMap((l) => stagesForLook(p, l));
}

/** Stages with no finished render under their current key, in dependency order. */
export function pendingStages(p: Production, lookIds?: string[], live = false): StageSpec[] {
  const stages = allStages(p).filter((s) => (!lookIds || lookIds.includes(s.lookId)) &&
    (p.renders[s.key]?.status !== "done" || (live && p.renders[s.key]?.demo)));
  return [...new Map(stages.map((stage) => [stage.key, stage])).values()];
}

export type RenderImpact = { total: number; changedKeys: string[]; cachedKeys: string[]; kept: number; lookIds: string[] };

/** Compare actual inputs, independently of whether the replacement is already cached. */
export function renderImpact(before: Production, after: Production): RenderImpact {
  const prior = new Map(allStages(before).map((stage) => [`${stage.lookId}:${stage.stage}`, stage.key]));
  const stages = allStages(after);
  const changed = stages.filter((stage) => prior.get(`${stage.lookId}:${stage.stage}`) !== stage.key);
  const changedKeys = [...new Set(changed.map((stage) => stage.key))];
  const total = new Set(stages.map((stage) => stage.key)).size;
  return { total, changedKeys, cachedKeys: changedKeys.filter((key) => after.renders[key]?.status === "done"), kept: total - changedKeys.length, lookIds: [...new Set(changed.map((stage) => stage.lookId))] };
}

/** The latest finished image for each chain of a look, for the cast board. */
export function lookImages(p: Production, lookId: string): { body?: RenderRecord; portrait?: RenderRecord; stages: { spec: StageSpec; record?: RenderRecord }[] } {
  const look = p.looks.find((l) => l.id === lookId);
  if (!look) return { stages: [] };
  const stages = stagesForLook(p, look).map((spec) => ({ spec, record: p.renders[spec.key] }));
  const lastDone = (chain: "body" | "portrait") => {
    const chainStages = stages.filter((s) => s.spec.chain === chain);
    const last = chainStages[chainStages.length - 1];
    return last?.record?.status === "done" ? last.record : undefined;
  };
  return { body: lastDone("body"), portrait: lastDone("portrait"), stages };
}

export function estimateUnits(stages: StageSpec[]): number {
  return stages.reduce((s, x) => s + x.units, 0);
}
