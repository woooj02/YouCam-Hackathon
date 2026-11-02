import Link from "next/link";
import showcase from "@/public/showcase/production.json";
import type { Production } from "@/lib/engine/types";
import { lookImages } from "@/lib/engine/render";
import { replanWithout } from "@/lib/engine/solver";

const STEPS = [
  { n: "01", title: "Meet the cast", body: "Explore a Gatsby-inspired party: three performers, three distinct looks and one shared budget. Add your cast photos, sizes and costume direction." },
  { n: "02", title: "Photograph your rack", body: "Add each piece with its tags, sizes, quantity and cost. Plan with owned pieces and a priced catalogue of hire and resale options." },
  { n: "03", title: "Plan the whole cast at once", body: "One coat can't be on two people in the same scene. ENCORE allocates the rack across every look, inside your budget." },
  { n: "04", title: "See opening night", body: "Costume, outer layer, hair and makeup, rendered on your actual performers with the YouCam API. Headwear stays on the fitting checklist." },
  { n: "05", title: "When something breaks, re-plan", body: "A coat goes missing? Only the looks that used it change, only their changed layers re-render, and the basket updates." },
];

const APIS = ["AI Clothes Virtual Try-On", "AI Hairstyle Virtual Try-On", "AI Makeup Virtual Try-On"];

export default function Home() {
  const production = showcase as Production;
  const repaired = replanWithout(production, "g-black-jacket").production;
  const originalCoat = lookImages(production, "l-gatsby").body?.url;
  const replacementCoat = lookImages(repaired, "l-gatsby").body?.url;
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
          <p className="mt-6 max-w-2xl text-lg text-muted">
            ENCORE plans every costume look across your cast from the rack you already have, previews each one on the real performer,
            and tells you exactly what is left to source, inside your budget.
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
                  {images.body?.url ? <img src={images.body.url} alt={`${look.name}: costume preview`} className="h-full w-full object-cover" /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {images.portrait?.url ? <img src={images.portrait.url} alt={`${look.name}: styling preview`} className="absolute bottom-2 right-2 h-16 w-16 rounded-full border-2 border-white object-cover shadow-lg" /> : null}
                </div>
                <div className="p-3"><h3 className="font-[family-name:var(--font-display)] text-base leading-tight">{look.name}</h3><p className="mt-2 text-[11px] text-muted">{look.hair?.label}</p></div>
              </article>;
            })}
          </div>
        </section>

        <section className="mt-14 grid items-center gap-8 rounded-3xl border border-line bg-surface p-6 shadow-card sm:grid-cols-2 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">The whole production keeps moving</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">“Gatsby&apos;s black dinner jacket is damaged.”</h2>
            <p className="mt-4 leading-relaxed text-muted">Gatsby gets an ivory dinner jacket from Footlights Costume Hire, a fictional hire house. The basket becomes $40 of $250. One of 12 render layers changes; the other 11 are kept.</p>
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
          <span className="mr-2">Rendered with Perfect Corp&apos;s YouCam API:</span>
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
