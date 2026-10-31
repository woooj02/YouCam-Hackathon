import Link from "next/link";

const STEPS = [
  { n: "01", title: "Brief in, breakdown out", body: "Paste the show. ENCORE drafts scenes, roles and every costume look, ready for you to correct." },
  { n: "02", title: "Photograph your rack", body: "Each piece becomes a tagged, sized, costed item. Owned, on hold from a hire house, or one click to buy." },
  { n: "03", title: "Plan the whole cast at once", body: "One coat can't be on two people in the same scene. ENCORE allocates the rack across every look, inside your budget." },
  { n: "04", title: "See opening night", body: "Costume, outer layer, hair, makeup and headwear, rendered on your actual performers with the YouCam API." },
  { n: "05", title: "When something breaks, re-plan", body: "A coat goes missing? Only the looks that used it change, only their changed layers re-render, and the basket updates." },
];

const APIS = ["AI Clothes Virtual Try-On", "AI Hairstyle Virtual Try-On", "AI Makeup Virtual Try-On", "AI Hat Virtual Try-On"];

export default function Home() {
  return (
    <main className="spotlight min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-8">
        <nav className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[0.2em] text-gold">ENCORE</span>
          <Link href="/studio" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-gold hover:text-paper">
            Open studio
          </Link>
        </nav>

        <section className="rise mt-20 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.3em] text-muted">The fitting room for an entire cast</p>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] sm:text-7xl">
            See opening night <span className="text-gold">before</span> you rent or buy the costumes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            ENCORE plans every costume look across your cast from the rack you already have, previews each one on the real performer,
            and tells you exactly what is left to source, inside your budget.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/studio?showcase=1" className="rounded-full bg-gold px-6 py-3 font-medium text-ink shadow-[0_0_40px_rgba(232,176,75,.35)] hover:bg-gold-soft">
              Open the showcase production
            </Link>
            <Link href="/studio/setup" className="rounded-full border border-line px-6 py-3 text-paper hover:border-gold">
              Start your own production
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="rise rounded-2xl border border-line bg-stage/80 p-5" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <div className="font-[family-name:var(--font-display)] text-3xl text-gold">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="mr-2">Rendered with Perfect Corp&apos;s YouCam API:</span>
          {APIS.map((a) => (
            <span key={a} className="rounded-full border border-line px-3 py-1 text-paper/90">{a}</span>
          ))}
        </section>

        <p className="mt-10 max-w-2xl text-xs text-muted/80">
          Previews support appearance decisions. Physical fittings establish fit. Prices in the showcase come from a fictional partner catalogue.
        </p>
      </div>
    </main>
  );
}
