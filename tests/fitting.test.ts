import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fittingNotes } from "@/lib/fitting";
import type { Production } from "@/lib/engine/types";

const midsummer = (): Production => JSON.parse(readFileSync("public/showcase/midsummer/production.json", "utf8"));
const look = (p: Production, id: string) => p.looks.find((l) => l.id === id)!;

describe("fitting card notes", () => {
  it("warns that a hired piece must not be altered permanently, naming the hire house", () => {
    const p = midsummer();
    const notes = fittingNotes(p, look(p, "l-demetrius"));
    expect(notes.some((n) => /^Black dinner jacket \(hire\) is hired from .+: pin or tack only/.test(n))).toBe(true);
  });

  it("says a bought piece can be altered, and that a reused piece is fitted once", () => {
    const p = midsummer();
    const notes = fittingNotes(p, look(p, "l-helena"));
    expect(notes).toContain("Ivory lawn day dress, secondhand is bought, so it can be altered to fit.");
    expect(notes).toContain("Same ivory lawn day dress, secondhand as in “Helena, the wedding”: fit it once for both looks.");
  });

  it("carries the planner's quick-change warning onto the card", () => {
    const p = midsummer();
    expect(fittingNotes(p, look(p, "l-theseus")).some((n) => n.startsWith("Quick change for Elliot") && n.endsWith("rehearse the change."))).toBe(true);
  });
});
