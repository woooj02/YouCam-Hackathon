import Link from "next/link";
import showcase from "@/public/showcase/production.json";
import midsummerShowcase from "@/public/showcase/midsummer/production.json";
import type { Production } from "@/lib/engine/types";
import { lookImages } from "@/lib/engine/render";
import { naivePlan, replanWithout } from "@/lib/engine/solver";

const REPO = "https://github.com/woooj02/YouCam-Hackathon";
const PROBLEM_DOC = `${REPO}/blob/main/docs/PROBLEM.md`;

/** Published figures, each copied from the source named beside it (all checked in docs/PROBLEM.md). */
const COSTS = [
  { figure: "$175", what: "to hire one regular-stock costume for a week, +$40 for each extra week", source: "TDF Costume Collection, New York", href: "https://tdf.org/nyc/57/Pricing-Info" },
  { figure: "+50%", what: "of the rental fee for every extra week a costume is out for fittings, photos or runs", source: "Pioneer Theatre Company rental terms, 2025", href: "https://pioneertheatre.org/wp-content/uploads/2025/09/Pioneer-Theatre-Company-Costume-Rental-Terms-and-Conditions.pdf" },
  { figure: "Replacement value", what: "charged for an alteration that can't be undone", source: "Costume Connection, Houston", href: "https://mainstreettheater.com/wp-content/uploads/CostumeConnectionpolicies.pdf" },
];

/** Each cost above, and the part of ENCORE that answers it. */
const ANSWERS = [
  { cost: "Hire is priced per piece, per week", answer: "The plan uses the rack first, hires or buys only what is left, and prices it against one budget." },
  { cost: "Extra weeks for fittings cost extra", answer: "Every look is seen on the performer before a hire week is booked." },
  { cost: "Irreversible alterations cost the whole costume", answer: "Fitting cards mark every hired piece \u201cpin or tack only\u201d and name the hire house." },
];

const STEPS = [
  { n: "01", title: "Add the cast", body: "A full-length photo and a close-up per performer, with sizes, roles and the costume direction for each look." },
  { n: "02", title: "Photograph your rack", body: "Add each piece with its tags, sizes, quantity and cost. Plan with owned pieces and a priced catalogue of hire and resale options." },
  { n: "03", title: "Plan the whole cast at once", body: "One coat can't be on two people in the same scene. ENCORE allocates the rack across every look, inside your budget." },
  { n: "04", title: "See opening night", body: "Costume, outer layer, hair and makeup, rendered on your actual performers with the YouCam API. Headwear stays on the fitting checklist." },
  { n: "05", title: "When something breaks, re-plan", body: "A coat goes missing? Only the looks that used it change, only their changed layers re-render, and the basket updates." },
];

const APIS = ["AI Clothes Virtual Try-On", "AI Hairstyle Virtual Try-On", "AI Makeup Virtual Try-On", "AI Text-to-Image (the fictional Midsummer cast and rack photos)"];

export default function Home() {
  const production = showcase as Production;
  const repaired = replanWithout(production, "g-black-jacket").production;
  const originalCoat = lookImages(production, "l-gatsby").body?.url;
  const replacementCoat = lookImages(repaired, "l-gatsby").body?.url;
  const midsummer = midsummerShowcase as unknown as Production;
  const naive = naivePlan(midsummer);
  const naiveHard = naive.conflicts.filter((c) => c.severity === "hard").length;
  const solvedHard = (midsummer.plan?.conflicts ?? []).filter((c) => c.severity === "hard").length;
  const usd = (n: number) => `${midsummer.currency}${Math.round(n)}`;
  return (
    <main className="spotlight min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-8">
        <nav className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[0.2em] grad-text">ENCORE</span>
          <Link href="/studio" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-accent hover:text-fg">
            Open studio
          </Link>
        </nav>

        <section className="rise mt-20 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.3em] text-muted">The fitting room for an entire cast</p>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] sm:text-7xl">
            See opening night <span className="text-accent">before</span> you rent or buy the costumes.
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-fg">
            Try-on apps dress one person. A show dresses a whole cast from one shared rack, scene by scene, on one budget.
          </p>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            For costume designers at community theatres, schools and small companies. ENCORE plans every look across the cast from the rack
            you already have, previews each one on the real performer, and tells you exactly what is left to hire, buy or find, inside your budget.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/studio?showcase=1&public=1" className="rounded-full grad px-6 py-3 font-medium text-white shadow-[0_0_40px_rgba(210,58,116,.28)] hover:brightness-110">
              Open the Gatsby party (3 performers)
            </Link>
            <Link href="/studio?showcase=midsummer&public=1&view=wall" className="rounded-full border border-accent/50 px-6 py-3 text-fg hover:border-accent">
              Open A Midsummer Night&apos;s Dream (10 performers)
            </Link>
            <Link href="/studio/setup" className="rounded-full border border-line px-6 py-3 text-fg hover:border-accent">
              Start your own production
            </Link>
          </div>
        </section>

        <section className="mt-14" aria-label="Rendered showcase cast">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-[family-name:var(--font-display)] text-3xl">One party. Three characters. One shared rack.</h2><p className="mt-2 text-sm text-muted">Gatsby-inspired costume study · fictional demo cast · real YouCam try-on results</p></div>
            <Link href="/studio?showcase=1&public=1" className="text-sm text-accent hover:underline">Inspect the whole plan →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {production.looks.map((look) => {
              const images = lookImages(production, look.id);
              return <article key={look.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <div className="relative aspect-[2/3] overflow-hidden bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(images.complete ?? images.body)?.url ? <img src={(images.complete ?? images.body)!.url} alt={`${look.name}: complete look`} className="h-full w-full object-cover" /> : null}
                  {images.complete ? <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-fg shadow">Complete look{images.complete.composite ? " · composite" : ""} · 4 API layers</span> : null}
                </div>
                <div className="p-3"><h3 className="font-[family-name:var(--font-display)] text-base leading-tight">{look.name}</h3><p className="mt-2 text-[11px] text-muted">{look.hair?.label}{look.makeup ? ` · ${look.makeup.label}` : ""}</p></div>
              </article>;
            })}
          </div>
        </section>

        <section className="mt-16" aria-label="The whole cast at once">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-[family-name:var(--font-display)] text-3xl">Ten performers. Fifteen looks. One {usd(midsummer.budget)} budget.</h2><p className="mt-2 text-sm text-muted">A Midsummer Night&apos;s Dream as a 1920s wedding · two actors double roles · fictional cast, vendors and prices · every image a real YouCam render</p></div>
            <Link href="/studio?showcase=midsummer&public=1&view=wall" className="text-sm text-accent hover:underline">Open the cast wall →</Link>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
            {midsummer.looks.map((look) => {
              const image = lookImages(midsummer, look.id);
              const url = (image.complete ?? image.body)?.url;
              // eslint-disable-next-line @next/next/no-img-element
              return url ? <img key={look.id} src={url} alt={look.name} title={look.name} className="aspect-[2/3] w-full rounded-lg bg-panel object-cover" /> : null;
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-alarm/40 bg-alarm/5 p-4">
              <div className="text-xs uppercase tracking-wider text-muted">Each look picked on its own</div>
              <p className="mt-1 text-lg text-alarm">{naiveHard} hard conflicts · {usd(naive.cost)} of {usd(midsummer.budget)}</p>
              <p className="mt-1 text-xs text-muted">One black dinner jacket on three grooms in the same scene, one wedding gown on three performers at the wedding, and over budget. Found at the fitting instead, each one means a late hire or a rush buy.</p>
            </div>
            <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4">
              <div className="text-xs uppercase tracking-wider text-muted">ENCORE: the whole cast at once</div>
              <p className="mt-1 text-lg text-ok">{solvedHard} hard conflicts · {usd(midsummer.plan?.cost ?? 0)} of {usd(midsummer.budget)}</p>
              <p className="mt-1 text-xs text-muted">The Duke keeps the jacket, Lysander moves to the navy one, Demetrius is hired one in his size; Ama wears one gown as both queens; Helena wears one secondhand dress in both her looks.</p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8" aria-label="Why it matters">
          <p className="text-xs uppercase tracking-wider text-accent">Why it matters</p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl">Costume mistakes are found at the fitting, after the hire clock has started.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Just under 95% of US high schools in the 2012 Educational Theatre Association survey ran play production, on an average of $2,701 for a play and
            $7,510 for a musical, for the whole production. Community and fringe companies work the same way: a shared rack, a hire house, secondhand finds and one small budget.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {COSTS.map((c) => (
              <a key={c.figure} href={c.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-line p-4 hover:border-accent">
                <div className="font-[family-name:var(--font-display)] text-3xl text-fg">{c.figure}</div>
                <p className="mt-2 text-sm text-muted">{c.what}</p>
                <p className="mt-3 text-[11px] text-accent">{c.source} ↗</p>
              </a>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {ANSWERS.map((a) => (
              <div key={a.cost} className="rounded-2xl bg-panel/70 p-4">
                <p className="text-xs font-medium text-fg">{a.cost}</p>
                <p className="mt-1 text-sm text-muted">{a.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted">Sources and what they don&apos;t show: <a className="text-accent underline" href={PROBLEM_DOC} target="_blank" rel="noreferrer">docs/PROBLEM.md</a>. ENCORE makes no claim about hours saved.</p>
        </section>

        <section className="mt-14 grid items-center gap-8 rounded-3xl border border-line bg-surface p-6 shadow-card sm:grid-cols-2 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">The whole production keeps moving</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">“Gatsby&apos;s black dinner jacket is damaged.”</h2>
            <p className="mt-4 leading-relaxed text-muted">Gatsby gets an ivory dinner jacket from Footlights Costume Hire, a fictional hire house. The basket becomes $40 of $250. Three of 18 render layers change (the jacket and the complete look on top of it); the other 15 are kept.</p>
            <p className="mt-3 text-xs text-muted">Try the repair in the showcase. Its saved replacement preview works without an API key.</p>
            <Link href="/studio?showcase=1&public=1" className="mt-6 inline-block rounded-full grad px-5 py-3 text-sm font-medium text-white">Try the jacket repair →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[{ image: originalCoat, label: "Before · rack · $0" }, { image: replacementCoat, label: "After · hire · $40" }].map((item) => <figure key={item.label}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.label} className="aspect-[3/4] w-full rounded-xl bg-panel object-cover" /><figcaption className="mt-2 text-center text-xs text-muted">{item.label}</figcaption>
            </figure>)}
          </div>
        </section>

        <section className="mt-16 grid gap-6 rounded-3xl border border-line bg-surface p-6 shadow-card sm:grid-cols-[1.2fr_1fr] sm:p-8" aria-label="For hire houses and costume shops">
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">For hire houses and costume shops</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Your stock, tried on the whole cast before anyone calls you.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Publish your catalogue as one JSON feed: pieces, photos, sizes, quantities and weekly prices. Designers load it into ENCORE, see your pieces
              rendered on their performers, and the planner hires from you only where their own rack falls short. What reaches you is a quote request
              that already lists each piece, size, quantity and the scene it&apos;s needed by.
            </p>
            <p className="mt-3 text-xs text-muted">ENCORE never orders or pays. The designer sends the request from their own email, and you confirm stock and price.</p>
          </div>
          <ol className="space-y-3 text-sm">
            {[
              ["Feed", "encore.catalogue.v1 JSON, validated on load and priced for the run length."],
              ["Preview", "Your garment photo goes through YouCam clothes try-on on each performer."],
              ["Order", "The order sheet groups what to pull, hire, buy and find secondhand, per performer, with CSV export and a drafted quote request."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-panel/70 p-3">
                <span className="font-[family-name:var(--font-display)] text-xl text-accent">{i + 1}</span>
                <span><span className="font-medium">{t}.</span> <span className="text-muted">{d}</span></span>
              </li>
            ))}
            <li className="flex flex-wrap gap-3 pl-1 text-xs">
              <a className="text-accent underline" href="/feeds/sample-hire-feed.json" download>Sample feed (fictional hire house)</a>
              <a className="text-accent underline" href={`${REPO}/blob/main/docs/catalogue-feed.schema.json`} target="_blank" rel="noreferrer">Feed schema</a>
              <Link className="text-accent underline" href="/studio/orders">See an order sheet</Link>
            </li>
          </ol>
        </section>

        <section className="mt-16" aria-label="Under the hood">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-3xl">Under the hood</h2>
            <a className="text-sm text-accent hover:underline" href={`${REPO}#architecture`} target="_blank" rel="noreferrer">Architecture diagram →</a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Planner", "A branch-and-bound search over every look and slot: scene capacity, sizes, availability and budget are hard rules, in plain code."],
              ["Render graph", "Each layer is keyed by its inputs. Change one piece and only that layer and the ones built on it re-render."],
              ["YouCam chain", "Clothes try-on for the costume and the outer layer, then hairstyle, then makeup, each output feeding the next."],
              ["Failure handling", "A face too small for makeup is retried on a head crop and pasted back, labelled composite. Tasks resume after a reload, never bought twice."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">Synthetic benchmark, 200 generated productions: look-by-look plans are feasible 24.5% of the time, ENCORE&apos;s 100.0%. <a className="text-accent underline" href={`${REPO}/blob/main/docs/EVAL.md`} target="_blank" rel="noreferrer">How it was measured</a></p>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="rise rounded-2xl border border-line bg-surface/80 p-5 shadow-card backdrop-blur" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <div className="font-[family-name:var(--font-display)] text-3xl text-accent">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="mr-2">Built on Perfect Corp&apos;s YouCam API:</span>
          {APIS.map((a) => (
            <span key={a} className="rounded-full border border-line px-3 py-1 text-fg/90">{a}</span>
          ))}
        </section>

        <p className="mt-10 max-w-2xl text-xs text-muted/80">
          Previews support appearance decisions. Physical fittings establish fit. Prices in the showcase come from a fictional partner catalogue.
        </p>
      </div>
    </main>
  );
}
