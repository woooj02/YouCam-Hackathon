import { describe, expect, it } from "vitest";
import { plural } from "@/lib/plural";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "hard conflict")).toBe("1 hard conflict");
    expect(plural(0, "hard conflict")).toBe("0 hard conflicts");
    expect(plural(2, "gap")).toBe("2 gaps");
    expect(plural(1, "unit")).toBe("1 unit");
  });
  it("accepts irregular plurals and groups thousands", () => {
    expect(plural(3, "piece of stock", "pieces of stock")).toBe("3 pieces of stock");
    expect(plural(1250, "option")).toBe("1,250 options");
  });
});
