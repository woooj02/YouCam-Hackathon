/**
 * Turns a render-stage job into the exact YouCam request body. Validated with
 * zod at the route boundary so a malformed request never spends units.
 */
import { z } from "zod";

const hex = z.string().regex(/^#?[0-9A-Fa-f]{6}$/, "expected #RRGGBB");

export const Makeup = z.object({
  label: z.string(),
  lip: z.object({ color: hex, texture: z.enum(["matte", "satin", "gloss"]) }).optional(),
  foundation: z.object({ color: hex, coverage: z.number().min(0).max(100) }).optional(),
  smooth: z.number().min(0).max(100).optional(),
});

export const Job = z.discriminatedUnion("feature", [
  z.object({
    feature: z.literal("cloth"),
    ref: z.string().min(1),
    category: z.enum(["full_body", "lower_body", "upper_body", "shoes", "auto", "outer"]).default("auto"),
  }),
  z.object({
    feature: z.literal("hair-transfer"),
    templateId: z.string().min(1),
    /** "src" keeps the performer's own colour; "ref" takes the template's. */
    hairColor: z.enum(["src", "ref"]).default("src"),
  }),
  z.object({ feature: z.literal("makeup-vto"), makeup: Makeup }),
  z.object({
    feature: z.literal("hat"),
    ref: z.string().min(1),
    gender: z.enum(["female", "male"]).default("female"),
  }),
]);
export type Job = z.infer<typeof Job>;

const h = (c: string) => (c.startsWith("#") ? c : `#${c}`);

export function makeupEffects(m: z.infer<typeof Makeup>): Record<string, unknown>[] {
  const effects: Record<string, unknown>[] = [];
  if (m.smooth) effects.push({ category: "skin_smooth", strength: m.smooth, colorIntensity: 50 });
  if (m.foundation) {
    effects.push({
      category: "foundation",
      palettes: [{ color: h(m.foundation.color), colorIntensity: 50, glowIntensity: 20, coverageIntensity: m.foundation.coverage }],
    });
  }
  if (m.lip) {
    effects.push({
      category: "lip_color",
      shape: { name: "original" },
      palettes: [
        {
          color: h(m.lip.color),
          texture: m.lip.texture,
          colorIntensity: 70,
          ...(m.lip.texture === "gloss" ? { gloss: 60, transparencyIntensity: 20 } : {}),
        },
      ],
      style: { type: "full" },
    });
  }
  return effects;
}

/** `src` and `ref` are already-resolved {src_file_id | src_file_url} fragments. */
export function buildBody(job: Job, src: Record<string, string>, ref?: Record<string, string>): Record<string, unknown> {
  switch (job.feature) {
    case "cloth":
      return { ...src, ...ref, garment_category: job.category, change_shoes: false, filter_multi_person: "normal" };
    case "hair-transfer":
      return { ...src, template_id: job.templateId, hair_color: job.hairColor };
    case "makeup-vto":
      return { ...src, version: "1.0", effects: makeupEffects(job.makeup) };
    case "hat":
      return { ...src, ...ref, gender: job.gender, style: "random" };
  }
}
