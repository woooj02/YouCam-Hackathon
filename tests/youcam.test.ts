import { describe, expect, it } from "vitest";
import { buildBody, makeupEffects } from "@/lib/youcam/bodies";
import { findImageUrl } from "@/lib/youcam/result";
import { normaliseTemplates } from "@/lib/youcam/templates";

describe("YouCam request contracts", () => {
  it("uses the published skin-smoothing fields and preserves zero strength", () => {
    // https://docs.perfectcorp.com/reference/makeup_vto/v1.0
    expect(makeupEffects({ label: "No smoothing", smooth: 0 })).toEqual([
      { category: "skin_smooth", skinSmoothStrength: 0, skinSmoothColorIntensity: 50 },
    ]);
  });

  it("feeds the base output URL into an outerwear task", () => {
    expect(buildBody({ feature: "cloth", ref: "coat", category: "outer" },
      { src_file_url: "https://example.com/costume.jpg" }, { ref_file_id: "coat-file" },
    )).toMatchObject({ src_file_url: "https://example.com/costume.jpg", ref_file_id: "coat-file", garment_category: "outer" });
  });
});

describe("YouCam response handling", () => {
  it("normalizes current and legacy template shapes and ignores malformed entries", () => {
    expect(normaliseTemplates({ data: { templates: [{ id: "waves", title: "Waves", thumb: "https://example.com/waves.jpg" }] } })).toEqual([
      { id: "waves", title: "Waves", thumb: "https://example.com/waves.jpg" },
    ]);
    expect(normaliseTemplates({ data: { results: [null, {}, { template_id: 12, name: "Crop", thumbnail_url: "crop.jpg" }] } })).toEqual([
      { id: "12", title: "Crop", thumb: "crop.jpg" },
    ]);
    expect(normaliseTemplates({ data: { templates: {} } })).toEqual([]);
  });

  it("finds result images in the documented single-URL and nested response shapes", () => {
    const url = "https://example.com/output.jpg";
    expect(findImageUrl({ url })).toBe(url);
    expect(findImageUrl([{ output: { image_url: url } }])).toBe(url);
    expect(findImageUrl({ progress: 100 })).toBeUndefined();
  });
});
