"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStudio } from "@/lib/client/store";
import { itemById } from "@/lib/client/view";
import { orderCsv, orderSheet, quoteRequest, vendorsToQuote } from "@/lib/orders";
import { plural } from "@/lib/plural";
import { ItemImage } from "@/components/studio/ItemImage";

/** What to pull, hire, buy and find secondhand, per performer, against the budget. */
export default function OrderSheetPage() {
  const { production: p } = useStudio();
  const sheet = useMemo(() => (p?.plan ? orderSheet(p) : null), [p]);
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!p || !sheet) return null;
  const money = (n: number) => `${sheet.currency}${n.toLocaleString("en-US")}`;
  const over = sheet.remaining < 0;
  const download = () => {
    const url = URL.createObjectURL(new Blob([orderCsv(sheet)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${p.id}-order-sheet.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const quote = quoteFor ? quoteRequest(sheet, quoteFor) : "";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={download} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">Download CSV</button>
          <button onClick={() => window.print()} className="rounded-full grad px-5 py-2 text-sm font-medium text-white">Print order sheet</button>
        </div>
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{sheet.title}: order sheet</h1>
      {p.notice ? <p className="mt-1 text-xs text-muted">{p.notice}</p> : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Totals">
        <Total label="To hire, buy and find" value={money(sheet.total)} />
        <Total label="Budget" value={money(sheet.budget)} />
        <Total label={over ? "Over budget" : "Left in budget"} value={money(Math.abs(sheet.remaining))} tone={over ? "alarm" : "ok"} />
      </section>

      {sheet.groups.map((g) => (
        <section key={g.source} className="print-card mt-8" aria-label={g.label}>
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl">{g.label} <span className="text-sm text-muted">· {plural(g.lines.length, "piece")}</span></h2>
            <span className="text-sm">{g.source === "owned" ? "already owned" : money(g.subtotal)}</span>
          </div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="py-1.5 pr-2 font-medium">Piece</th><th className="pr-2 font-medium">Who</th><th className="pr-2 font-medium">Sizes</th><th className="pr-2 font-medium">Qty</th><th className="pr-2 font-medium">Needed by</th><th className="text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map((l) => {
                const item = itemById(p, l.itemId);
                return (
                  <tr key={l.itemId} className="border-t border-line/60 align-top">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {item ? <ItemImage item={item} className="h-9 w-9 shrink-0 rounded object-cover" /> : null}
                        <div><div>{l.name}</div>{l.vendor ? <div className="text-[11px] text-muted">{l.vendor}</div> : null}</div>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-xs">{l.wearers.map((w) => <div key={w.look}>{w.performer} <span className="text-muted">as {w.look}</span></div>)}</td>
                    <td className="py-2 pr-2">{l.sizes.join(" / ")}</td>
                    <td className="py-2 pr-2">{l.qty}</td>
                    <td className="py-2 pr-2 text-xs">{l.neededBy ? `${l.neededBy.order}. ${l.neededBy.name}` : "-"}</td>
                    <td className="py-2 text-right">{l.total ? <>{money(l.total)}<div className="text-[11px] text-muted">{l.qty} × {money(l.unitCost)}</div></> : <span className="text-muted">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {sheet.unsourced.length ? (
        <section className="print-card mt-8">
          <h2 className="border-b border-line pb-2 font-[family-name:var(--font-display)] text-xl text-accent">Still to source <span className="text-sm text-muted">· nothing in stock or the catalogue fits</span></h2>
          <ul className="mt-2 space-y-1 text-sm">{sheet.unsourced.map((u, i) => <li key={i}>{u.performer} as {u.look}: {u.need}{u.neededBy ? ` · by ${u.neededBy.order}. ${u.neededBy.name}` : ""}</li>)}</ul>
        </section>
      ) : null}

      <section className="no-print mt-10 rounded-2xl border border-line bg-surface p-4" aria-label="Request a quote">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Request a quote</h2>
        <p className="mt-1 text-xs text-muted">ENCORE has no live connection to suppliers and sends nothing. It drafts the request; you send it from your own email and confirm prices and stock with the supplier.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {vendorsToQuote(sheet).map((v) => <button key={v} onClick={() => { setQuoteFor(v); setCopied(false); }} aria-pressed={quoteFor === v} className={`rounded-full border px-3 py-1.5 text-xs ${quoteFor === v ? "border-accent text-accent" : "border-line text-muted hover:border-accent"}`}>{v}</button>)}
          {!vendorsToQuote(sheet).length ? <p className="text-sm text-muted">Everything comes off your own rack.</p> : null}
        </div>
        {quoteFor ? (
          <div className="mt-3">
            <textarea readOnly value={quote} aria-label={`Quote request for ${quoteFor}`} className="h-56 w-full rounded-xl border border-line bg-panel p-3 font-mono text-xs" />
            <div className="mt-2 flex gap-2">
              <button onClick={async () => { try { await navigator.clipboard.writeText(quote); setCopied(true); } catch { setCopied(false); } }} className="rounded-full grad px-4 py-2 text-xs font-medium text-white">{copied ? "Copied" : "Copy request"}</button>
              <a href={`mailto:?subject=${encodeURIComponent(`Quote request: ${sheet.title}`)}&body=${encodeURIComponent(quote)}`} className="rounded-full border border-line px-4 py-2 text-xs hover:border-accent">Open as email draft</a>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: "ok" | "alarm" }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-[family-name:var(--font-display)] text-2xl ${tone === "alarm" ? "text-alarm" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
    </div>
  );
}
