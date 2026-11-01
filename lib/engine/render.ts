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
 *
 * With `production.completeLook` set, each look also gets a third chain that
 * ends in one finished image with costume, outer layer, hair and makeup:
 *
 *   direct:    clothed render -> Hairstyle VTO -> Makeup VTO
 *   composite: head crop of the full-body photo -> Hairstyle VTO -> Makeup VTO
 *              -> local feathered paste onto the clothed render (0 units)
 *
 * The composite's head chain hangs off the photo, not the costume, so a coat
 * swap still re-renders one API layer and re-pastes the head locally.
 */
import { DEFAULT_HEAD_BOX } from "./composite.ts";
import type { HeadBox, Item, Look, Performer, Production, RenderRecord, StageId } from "./types";

export type StageSpec = {
  key: string;
  lookId: string;
  stage: StageId;
  chain: "body" | "portrait" | "look";
  /** Key of the stage whose output is this stage's input; undefined = performer photo. */
  parentKey?: string;
  /** Composite only: the clothed render the styled head is pasted onto. */
  baseKey?: string;
  /** Crop this head box out of the input (parent output, or the full-body photo) before sending it. */
  crop?: HeadBox;
  feature: "cloth" | "hair-transfer" | "makeup-vto" | "hat" | "composite";
  /** Body sent to /api/youcam/run (minus the source image). */
  job: Record<string, unknown>;
  label: string;
  /** Estimated units, from Perfect Corp's published per-feature pricing. */
  units: number;
};

/** Published unit costs per call (Clothes V4, Hairstyle V2.1, Makeup VTO, Hat VTO). */
export const UNIT_COST: Record<StageSpec["feature"], number> = { cloth: 2, "hair-transfer": 2, "makeup-vto": 1, hat: 2, composite: 0 };

export const API_NAME: Record<StageSpec["feature"], string> = {
  cloth: "AI Clothes Virtual Try-On",
  "hair-transfer": "AI Hairstyle Virtual Try-On",
  "makeup-vto": "AI Makeup Virtual Try-On",
  hat: "AI Hat Virtual Try-On",
  composite: "Local head composite (no API call)",
};

/** Stages that call a paid YouCam API (everything except the local composite). */
export const isApiStage = (s: StageSpec) => s.feature !== "composite";

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
    parent = key;
  }
  const clothedKey = parent;

  // Portrait chain. With a complete look and no close-up photo, styling lives on the complete look only.
  parent = undefined;
  const portrait = !(p.completeLook && !perf.portraitPhoto);
  const faceRoot = `face:${p.id}:${perf.id}:${perf.photoVersion}`;
  if (portrait && look.hair) {
    const key = hash(`${faceRoot}|hair|${look.hair.templateId}|${look.hair.keepColor}`);
    out.push({ key, lookId: look.id, stage: "hair", chain: "portrait", feature: "hair-transfer", label: look.hair.label, units: UNIT_COST["hair-transfer"],
      job: { feature: "hair-transfer", templateId: look.hair.templateId, hairColor: look.hair.keepColor ? "src" : "ref" } });
    parent = key;
  }
  if (portrait && look.makeup) {
    const key = hash(`${parent ?? faceRoot}|makeup|${JSON.stringify(look.makeup)}`);
    out.push({ key, lookId: look.id, stage: "makeup", chain: "portrait", parentKey: parent, feature: "makeup-vto", label: look.makeup.label, units: UNIT_COST["makeup-vto"],
      job: { feature: "makeup-vto", makeup: look.makeup } });
  }

  // Complete-look chain: one image with everything on.
  const mode = p.completeLook;
  if (mode && (look.hair || look.makeup) && clothedKey) {
    const box = perf.headBox ?? DEFAULT_HEAD_BOX;
    const boxRef = `${box.x},${box.y},${box.w},${box.h}`;
    const composite = mode.strategy === "composite";
    const fromPhoto = composite && mode.cropFrom === "photo";
    let lookParent: string | undefined = fromPhoto ? undefined : clothedKey;
    let lookRoot = fromPhoto ? `${bodyRoot}|head|${boxRef}` : `${clothedKey}|${composite ? `head|${boxRef}` : "full"}`;
    let first = true;
    const crop = () => (composite && first ? box : undefined);
    if (look.hair) {
      const key = hash(`${lookRoot}|look-hair|${look.hair.templateId}|${look.hair.keepColor}`);
      out.push({ key, lookId: look.id, stage: "look-hair", chain: "look", parentKey: lookParent, crop: crop(), feature: "hair-transfer", label: look.hair.label, units: UNIT_COST["hair-transfer"],
        job: { feature: "hair-transfer", templateId: look.hair.templateId, hairColor: look.hair.keepColor ? "src" : "ref" } });
      lookParent = key; lookRoot = key; first = false;
    }
    if (look.makeup) {
      const key = hash(`${lookRoot}|look-makeup|${JSON.stringify(look.makeup)}`);
      out.push({ key, lookId: look.id, stage: "look-makeup", chain: "look", parentKey: lookParent, crop: crop(), feature: "makeup-vto", label: look.makeup.label, units: UNIT_COST["makeup-vto"],
        job: { feature: "makeup-vto", makeup: look.makeup } });
      lookParent = key; first = false;
    }
    if (composite) {
      const key = hash(`${clothedKey}|composite|${lookParent}|${boxRef}`);
      out.push({ key, lookId: look.id, stage: "composite", chain: "look", parentKey: lookParent, baseKey: clothedKey, crop: box, feature: "composite",
        label: "Styled head pasted onto the costume", units: 0, job: { feature: "composite" } });
    }
  }
  return out;
}

/** Every stage whose output this stage reads. */
export const dependencies = (s: StageSpec): string[] => [s.parentKey, s.baseKey].filter((k): k is string => !!k);

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

/**
 * Re-render cost of a change, in API layers and units, computed from the graph:
 * the changed API layers versus rendering every API layer of the whole cast.
 */
export type RepairCost = { apiLayers: number; changedApiLayers: number; units: number; fullCastUnits: number; recomposited: number };
export function repairCost(before: Production, after: Production): RepairCost {
  const impact = renderImpact(before, after);
  const stages = [...new Map(allStages(after).map((s) => [s.key, s])).values()];
  const changed = stages.filter((s) => impact.changedKeys.includes(s.key));
  const api = stages.filter(isApiStage);
  return {
    apiLayers: api.length,
    changedApiLayers: changed.filter(isApiStage).length,
    units: estimateUnits(changed),
    fullCastUnits: estimateUnits(api),
    recomposited: changed.filter((s) => !isApiStage(s)).length,
  };
}

type StageRow = { spec: StageSpec; record?: RenderRecord };
/** The latest finished image for each chain of a look, for the cast board. */
export function lookImages(p: Production, lookId: string): { body?: RenderRecord; portrait?: RenderRecord; complete?: RenderRecord; stages: StageRow[] } {
  const look = p.looks.find((l) => l.id === lookId);
  if (!look) return { stages: [] };
  const stages = stagesForLook(p, look).map((spec) => ({ spec, record: p.renders[spec.key] }));
  const lastDone = (chain: StageSpec["chain"]) => {
    const chainStages = stages.filter((s) => s.spec.chain === chain);
    const last = chainStages[chainStages.length - 1];
    return last?.record?.status === "done" ? last.record : undefined;
  };
  return { body: lastDone("body"), portrait: lastDone("portrait"), complete: lastDone("look"), stages };
}

export function estimateUnits(stages: StageSpec[]): number {
  return stages.reduce((s, x) => s + x.units, 0);
}
