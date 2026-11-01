import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseTaskBody } from "@/lib/youcam/client";
import { findImageUrl } from "@/lib/youcam/result";
import base from "./fixtures/youcam/cloth-base.json";
import outer from "./fixtures/youcam/cloth-outer.json";
import hair from "./fixtures/youcam/hair-transfer.json";
import makeup from "./fixtures/youcam/makeup-vto.json";
import hat from "./fixtures/youcam/hat.json";

describe("sanitized live YouCam responses", () => {
  it.each([["costume", base], ["outerwear", outer], ["hair", hair], ["makeup", makeup], ["hat experiment", hat]])("parses the %s completion and its image URL", (_name, fixture) => {
    const state = parseTaskBody(fixture);
    expect(state.status).toBe("success");
    if (state.status === "success") expect(findImageUrl(state.results)).toBe("https://example.com/redacted-image.jpg");
  });
});
