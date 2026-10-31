/**
 * The YouCam API features ENCORE calls. Paths and request fields come from
 * Perfect Corp's own published client (@youcam_cli/youcam-cli 1.0.0, generated
 * from the official OpenAPI docs). Each is a task: upload -> POST -> poll.
 */

export type FeatureId = "cloth" | "hair-transfer" | "makeup-vto" | "hat";

export type FeatureSpec = {
  id: FeatureId;
  apiName: string;
  taskPath: string;
  templatePath?: string;
  needsRef: boolean;
};

export const FEATURES: Record<FeatureId, FeatureSpec> = {
  cloth: { id: "cloth", apiName: "AI Clothes Virtual Try-On", taskPath: "/s2s/v2.0/task/cloth-v4", needsRef: true },
  "hair-transfer": {
    id: "hair-transfer",
    apiName: "AI Hairstyle Virtual Try-On",
    taskPath: "/s2s/v2.1/task/hair-transfer",
    templatePath: "/s2s/v2.1/task/template/hair-transfer",
    needsRef: false,
  },
  "makeup-vto": { id: "makeup-vto", apiName: "AI Makeup Virtual Try-On", taskPath: "/s2s/v2.0/task/makeup-vto", needsRef: false },
  hat: { id: "hat", apiName: "AI Hat Virtual Try-On", taskPath: "/s2s/v2.0/task/hat", needsRef: true },
};

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === "string" && value in FEATURES;
}
