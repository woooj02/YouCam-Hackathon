import { describe, expect, it } from "vitest";
import { orderCsv, orderSheet, quoteRequest, vendorsToQuote } from "@/lib/orders";
import { midsummerProduction } from "@/lib/midsummer";
import { solve } from "@/lib/engine/solver";

const planned = () => { const p = midsummerProduction(); p.plan = solve(p); return p; };

describe("order sheet", () => {
  it("groups the plan by source with totals against the budget", () => {
    const p = planned();
    const sheet = orderSheet(p);
    expect(sheet.groups.map((g) => g.label)).toEqual(["On the rack", "Hire", "Secondhand"]);
    expect(sheet.total).toBe(p.plan!.cost);
    expect(sheet.remaining).toBe(p.budget - p.plan!.cost);
    expect(sheet.groups.find((g) => g.source === "owned")!.subtotal).toBe(0);
  });

  it("lists who wears each piece, their sizes, the peak quantity and the first scene it's needed", () => {
    const sheet = orderSheet(planned());
    const line = (id: string) => sheet.groups.flatMap((g) => g.lines).find((l) => l.itemId === id)!;
    expect(line("h-black-jacket")).toMatchObject({ qty: 1, unitCost: 45, total: 45, sizes: ["L"], neededBy: { order: 1, name: "The Duke's Court" } });
    expect(line("h-black-jacket").wearers).toEqual([{ performer: "Tom", size: "L", role: "Demetrius", look: "Demetrius" }]);
    // Three people wear the evening base in the court scene at once; the rack has three.
    expect(line("m-evening-base").qty).toBe(3);
    expect(line("m-evening-base").wearers.map((w) => w.role).sort()).toEqual(["Demetrius", "Lysander", "Oberon", "Theseus"]);
    // Helena's one secondhand dress covers both of her looks: one unit, one purchase.
    expect(line("s-ivory-dress")).toMatchObject({ qty: 1, total: 30 });
    expect(line("s-ivory-dress").wearers).toHaveLength(2);
  });

  it("exports CSV a spreadsheet can read, with escaped fields and totals", () => {
    const csv = orderCsv(orderSheet(planned()));
    const rows = csv.trim().split("\n");
    expect(rows[0]).toBe("source,item,supplier,performers,sizes,qty,unit_cost,line_total,needed_by_scene");
    expect(rows).toContain("Total,,,,,,,160,");
    expect(rows).toContain("Remaining,,,,,,,20,");
    expect(rows).toContain('Secondhand,"Ivory lawn day dress, secondhand",Encore Thrift (fictional),Grace (L) as Helena,L,1,30,30,1. The Duke\'s Court');
    expect(csv).toContain("Elliot (M) as Theseus; Elliot (M) as Oberon");
  });

  it("drafts a quote request per supplier without claiming to send it", () => {
    const sheet = orderSheet(planned());
    expect(vendorsToQuote(sheet)).toEqual(["Limelight Costume Hire (fictional)", "Encore Thrift (fictional)"]);
    const text = quoteRequest(sheet, "Limelight Costume Hire (fictional)");
    expect(text).toContain("- Black dinner jacket (hire) · 1 × sizes L · hire · listed at $45 each · needed by scene 1 (The Duke's Court)");
    expect(text).toContain("may have changed");
    expect(text).not.toContain("Encore Thrift");
  });

  it("lists unfilled slots as still to source", () => {
    const p = midsummerProduction();
    p.budget = 0; p.plan = solve(p);
    const sheet = orderSheet(p);
    expect(sheet.total).toBe(0);
    expect(sheet.unsourced.length).toBeGreaterThan(0);
    expect(orderCsv(sheet)).toContain("Still to source,");
  });
});
