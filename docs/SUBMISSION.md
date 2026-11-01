# Devpost submission text

**Track:** eCommerce VTO
**Tagline:** See opening night before you rent or buy the costumes.

## Inspiration
Small theatres dress a whole cast from one shared rack, a hire house and the thrift shop, on a budget that would barely buy one new costume. Picking a single costume is easy. Picking all of them at once is hard: the captain and the harbourmaster both want the only navy coat, in the same scene; one actor doubles two roles; every hire comes out of the same $250. And nobody sees the finished looks until the fitting, when changing course costs the most. Costume software tracks stock and scene plots, but none of it shows you the look on the actor before you commit. YouCam's virtual try-on can.

## What it does
ENCORE is a fitting room for an entire cast.
1. **Set up the cast and show.** Our original one-act, *The Lantern Keepers*, comes with five scenes, four roles and six looks. Add performer photos and sizes, with the brief beside the plan.
2. **Photograph the rack.** Enter each piece's tags, sizes, quantities and whether it is owned, on hire or for sale. Manual entry needs no language-model key.
3. **Plan the whole cast at once.** A constraint solver allocates the rack across every look: never two wearers for one piece in a scene, only sizes that fit, never over budget. What it can't fill becomes a priced sourcing line.
4. **See opening night.** Every look is rendered on the real performer with YouCam: costume, outer layer, hairstyle, makeup and headwear.
5. **Re-plan in one sentence.** "The navy greatcoat has moth damage." ENCORE re-plans only the look that used it, swaps in a pea coat from the hire house, re-renders one outer layer, and updates the basket from $0 to $40. The prepared production has 17 layers before optional hairstyle choices add more.
6. **Fitting cards** for every performer: pieces, sources, hair and makeup direction, and handoffs to rehearse.

## How we built it: the YouCam API
Every look is two chains of real YouCam tasks; each stage's output image is the next stage's input:
- **AI Clothes Virtual Try-On (v4)** puts the rack piece on the performer, then a second call with `garment_category: "outer"` layers the coat over it.
- **AI Hairstyle Virtual Try-On** sets the hair direction from Perfect Corp's template library, with `hair_color: "src"` so the performer keeps their own colour.
- **AI Makeup Virtual Try-On** adds stage makeup: foundation, lip colour and texture, skin smoothing.
- **AI Hat Virtual Try-On** adds headwear from the rack.
- The **File API** uploads each photo once and reuses it by `file_id`. The **credit endpoint** shows the live unit balance in the studio.

What connects the try-on previews to the wardrobe plan:
- **A content-keyed render graph.** Each stage's key hashes its inputs and its parent's key, so a change re-renders only that stage and the stages after it.
- **Saved task ids.** Stored render task ids allow polling to resume after a reload. The API has no idempotency key, so this cannot guarantee recovery if creation is interrupted before the id is saved.
- **Engine errors arrive as HTTP 200.** They're parsed into instructions a person can act on.
- **The API key never leaves the server.**

The planner is a branch-and-bound solver with scene-capacity, size, availability and budget constraints. The director handles damaged or unavailable pieces and re-planning with deterministic commands over that solver. The showcase and recording require only the YouCam key. Optional model integrations for assisted breakdowns, photo tagging and broader direction are separate and have not been verified live.

## Results
On 200 seeded synthetic productions, picking each look on its own (the way most teams work) produced a feasible plan 24.5% of the time, with 317 double-bookings and 25.5% of plans over budget. ENCORE's planner produced a feasible plan 100% of the time, with zero double-bookings, in about 4 ms per production. It leaves slots unfilled rather than double-booking or overspending, and reports those slots as sourcing needs. Reproducible with `npm run eval`.

## Challenges
- Chaining try-ons: every stage regenerates an image, so we split each look into a body chain and a portrait chain. The smoke-test script checks layered composition on real photos before recording.
- Making re-renders cheap and correct: content keys that capture exactly what each stage depends on.
- Keeping changes consistent: the director returns planner operations, and the browser replays them deterministically. Prices and quantities come from the plan.

## Accomplishments
- One sentence about a damaged coat re-plans the show and changes only one render layer.
- A complete journey a first-time user understands: brief, rack, plan, opening night, fitting cards.

## What we learned
Try-on becomes far more useful when it's attached to a decision with constraints. A plan you can see on your cast, and that stays feasible when the rack changes, is worth more than a gallery of images.

## What's next
- Live inventory feeds from costume hire houses and resale marketplaces, so every gap is one tap from booked.
- Quick-change timing from rehearsal data.
- Shoe and jewellery try-on (YouCam already offers both) for period pieces.
- Pilots with community theatres and school drama departments.

## Built with
YouCam API (AI Clothes Virtual Try-On, AI Hairstyle Virtual Try-On, AI Makeup Virtual Try-On, AI Hat Virtual Try-On, File API), Next.js, TypeScript, Tailwind CSS, Zod, Vitest.

## Links
- Code: https://github.com/woooj02/YouCam-Hackathon
- Live app: _Vercel URL_
- Video: _YouTube URL_
