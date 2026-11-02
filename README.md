# ENCORE

**See opening night before you rent or buy the costumes.**

ENCORE is a fitting room for an entire cast. A costume designer gives it the show, the cast and the rack they already have. ENCORE plans every look across every scene from that rack, renders each look on the performer with the YouCam API (costume, outer layer, hairstyle and makeup in one image), and turns what is left into an order sheet: what to pull, hire, buy or find secondhand, inside the budget.

When something breaks ("Gatsby’s black dinner jacket is damaged"), ENCORE re-plans only the looks that used it, re-renders only the layers that changed, and says what that saved: "Re-rendered 3 of 18 layers: 5 units instead of 30 for the whole cast" (the jacket, then the hair and makeup of the complete look built on it).

Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (eCommerce VTO track).

## Two public showcases

| Route | What it is | State on this branch |
|---|---|---|
| `/studio?showcase=1&public=1` | *The Great Gatsby* party scene: 3 fictional performers, 3 looks, 12 saved YouCam layers, the $40 jacket repair | Complete; works with no API key |
| `/studio?showcase=midsummer&public=1` | *A Midsummer Night's Dream* (public domain) as a 1920s wedding: 10 fictional performers, 15 looks, 4 scenes, two doubled roles, a hire/buy/secondhand catalogue, $180 budget | Plan, conflicts, cast wall and order sheet, with 33 generated fictional photos and 15 complete looks rendered live with YouCam |

## The problem

Small productions (community theatre, schools, fringe companies) dress a whole cast from a shared rack, a hire house and secondhand shops. Hire is priced per piece and per period, extra weeks for fittings cost extra, and alterations that can't be undone are charged at replacement value. Sourced figures are in [docs/PROBLEM.md](docs/PROBLEM.md). The hard part isn't choosing one costume. It's choosing all of them at once:

- one coat can't be on two people in the same scene;
- a performer who doubles roles needs a quick change that works;
- every hire and purchase comes out of one small budget;
- and nobody sees the finished looks until the fitting, when changing course costs the most.

## What ENCORE does

1. **Plan the whole cast at once.** A constraint solver assigns pieces to every look: never more wearers in a scene than the rack holds, only sizes that fit, never over budget. Anything it can't fill becomes a sourcing need, not a hidden double-booking.
2. **Show the conflict.** The plan check puts the look-by-look plan beside ENCORE's: the same garment on two performers in one scene ("Same scene. The rack has 1."), then the resolved plan.
3. **See opening night.** Each look renders as one complete image: costume, outer layer, hair and makeup. The cast wall shows every look; the inspector shows every layer with a before/after slider and the API that made it.
4. **Re-plan in one sentence.** Only affected looks change; locked looks stay fixed; only changed layers re-render.
5. **Order and fit.** The order sheet groups pieces by source, per performer, with sizes, quantities, the scene each piece is first needed by, totals against budget, print and CSV export, and a quote request you send yourself. Fitting cards carry pieces, sources, styling and quick-change notes.

## YouCam API usage

Every configured stage's output image is the next stage's input:

```
costume:        full-body photo ─▶ Clothes VTO (costume) ─▶ Clothes VTO (garment_category "outer")
close-up:       close-up photo  ─▶ Hairstyle VTO ─▶ Makeup VTO                 (when a close-up exists)
complete look:  composite: head crop of the full-body photo ─▶ Hairstyle VTO ─▶ Makeup VTO
                           ─▶ pasted onto the costume render with a feathered mask (local, 0 units)
                direct:    costume render ─▶ Hairstyle VTO ─▶ Makeup VTO
```

| Feature | Endpoint | Used for |
|---|---|---|
| AI Clothes Virtual Try-On (v4) | `POST /s2s/v2.0/task/cloth-v4` | The rack piece on the performer; outer layers over the costume |
| AI Hairstyle Virtual Try-On | `POST /s2s/v2.1/task/hair-transfer`, `GET …/template/hair-transfer` | Hair direction, optionally keeping the performer's own colour |
| AI Makeup Virtual Try-On | `POST /s2s/v2.0/task/makeup-vto` | Stage makeup: foundation, lip colour and texture, skin smoothing |
| Text-to-image (`youcam-image-v2`) | `POST /s2s/v2.0/task/text-to-image/youcam` | Scripts only: fictional performer and garment photos for the Midsummer showcase |
| AI Hat Virtual Try-On | `POST /s2s/v2.0/task/hat` | Isolated smoke test only; it regenerated the whole image, so headwear stays in the plan and fitting cards |
| File API, Credits | `POST /s2s/v2.0/file`, `GET /s2s/v1.0/client/credit` | Presigned uploads reused by file id; live unit balance |

Engineering details:

- **Content-keyed render graph** (`lib/engine/render.ts`). Each stage's key hashes its inputs plus its parent's key; a composite also depends on the costume render. Swap a coat and only that stage and its dependants re-key. The composite strategy hangs the head chain off the photo, not the costume, so a coat swap is still one API layer plus a free local re-paste. The direct strategy re-renders hair and makeup too (3 layers, 5 units).
- **Repair numbers from the graph.** `repairCost()` counts changed API layers and their units from `UNIT_COST` (clothes 2, hairstyle 2, makeup 1) against rendering every layer of the cast. Nothing in that sentence is typed in.
- **Saved-task resumption.** Task ids are stored before polling; interrupted tasks resume after a reload; an interrupted creation with no returned id is held, never resubmitted. Finished images are saved with the production so signed URL expiry doesn't erase them.
- **Errors arrive as HTTP 200** with `task_status: "error"` and a stringified tuple; they're parsed into messages a person can act on.
- **The key stays server-side.** The browser only talks to `app/api/youcam/`.

## The planner

`lib/engine/solver.ts` is a branch-and-bound search over (look, slot) variables, fewest-candidates first, with an optimistic bound.

- **Hard constraints:** scene capacity (`qty` per scene), size fit, availability, budget.
- **Objective:** tag and colour match to each look's brief, minus a small cost penalty. Unfilled required slots become sourcing needs.
- **Replanning:** `replanWithout` frees only the (look, slot) pairs that used the lost piece. Locked looks stay fixed.
- **Soft warnings:** quick changes for a performer in two looks in back-to-back scenes, and pieces handed between performers when there aren't enough units for everyone.

In the Midsummer showcase, picking look by look puts one black dinner jacket on three suitors and one ivory gown on three brides, and spends $198 of $180. ENCORE's plan has no conflicts and costs $160, by trade-offs a person might not spot: the Duke keeps the owned jacket, Lysander takes the navy one, Demetrius (size L) is hired; Ama wears Titania's silver gown again as Hippolyta, which frees the ivory gown for Hermia; Helena wears one $30 secondhand dress in both looks. `tests/midsummer.test.ts` checks all of it.

### Evaluation (synthetic, seeded, reproducible)

`npm run eval` compares the planner with picking the best piece for each look on its own. `npm run eval:write` also writes `lib/eval-result.json`, which the plan check displays.

| Planner | Feasible plans | Double-bookings (total) | Over budget | Unfilled slots | Avg solve time |
|---|---|---|---|---|---|
| Look-by-look baseline | 24.5% | 317 | 25.5% | 145 | 0.3 ms |
| ENCORE planner | 100.0% | 0 | 0.0% | 176 | 3.5 ms |

200 synthetic productions (3–6 performers, 4–7 scenes, seeds 1–200). ENCORE leaves more slots unfilled because the baseline "filled" them by double-booking or overspending. The scenarios measure feasibility, not taste. See [docs/EVAL.md](docs/EVAL.md).

## Catalogue feed for suppliers

A costume hire house, shop or secondhand dealer can plug its stock in as one JSON file:

- **Format:** `encore.catalogue.v1`, defined by the zod schema in `lib/catalogue/feed.ts` and published as [docs/catalogue-feed.schema.json](docs/catalogue-feed.schema.json) (generated from the same schema: `npm run feed:schema`).
- **Contents:** supplier name and kind (`hire`, `retail`, `secondhand`), currency, and items with SKU, slot, colours, tags, sizes, stock and a price per run, per week or per item, plus an optional https product photo for try-on.
- **Loading:** *Cast & rack → Rack* → "Load feed". ENCORE validates it, prices weekly hire over the run length you enter, skips out-of-stock rows, warns on currency mismatch or duplicate SKUs, replaces that supplier's earlier feed and re-plans.
- **What it is not:** there is no live supplier connection. ENCORE never fetches a feed, places an order or sends a quote. `public/feeds/sample-hire-feed.json` is an example from a fictional supplier.

## Run it

```bash
nvm use && npm install
cp .env.example .env.local   # add YOUCAM_API_KEY (renders) and YOUCAM_API_SECRET_KEY (balance)
npm run dev                  # http://localhost:3000
```

- **No keys:** both showcases, planning, the order sheet, locks and fitting cards work. New renders are labelled costume sketches.
- **YouCam key:** real renders from photos added in *Cast & rack*.
- **Checks:** `npm run check` (typecheck and 85 unit tests), `npm run eval`, `npm run build`. YouCam preflight (balance and templates, no render tasks): `npm run smoke -- --preflight`.

### Showcase scripts (live, paid)

All live scripts print the balance and the unit estimate first, stop after two failures, keep task ids in `.local/` (git-ignored) so a rerun resumes without resubmitting, and refuse to take total spend past a 300-unit cap (`ENCORE_UNIT_CAP`). Keys are read only from the environment.

```bash
npm run showcase:generate -- --dry-run                       # 33 prompts, no network
npm run showcase:generate -- --units-per-image <price>       # price from your API console
npm run showcase:build -- midsummer                          # plan + keep saved renders
npm run showcase:render -- midsummer --dry-run               # ~75 units for 15 complete looks
npm run showcase:render -- gatsby --looks l-daisy --strategy composite
npm run showcase:render -- gatsby --extra l-nick:outer=g-black-jacket   # the clash image, ~2 units
```

## Honest limits

- **Complete looks, verified live on 2026-11-01** (spend in [docs/LIVE_RUNS.md](docs/LIVE_RUNS.md)). On real renders the direct chain (hair, then makeup, on the clothed image) beat the head-crop composite, which pasted the photo's collar and showed a seam, so direct is the default. In full-length shots the face is small and makeup sometimes returns `error_no_face`; the script then runs makeup on a head crop of the same render, matches its tone and pastes it back. Those looks (Nick, Hippolyta, Titania, Helena twice, Demetrius) are marked `composite` in the data and the UI.
- Previews support appearance decisions. Physical fittings establish fit, comfort and movement. Hairstyle renders show a direction for the wig or styling team; they don't certify a wig.
- Every performer, vendor and price in the demos is fictional and labelled so on screen. Sizes, quantities and prices in real use come from what the wardrobe team and suppliers enter.
- The order sheet's quote request is a draft the designer sends; prices are catalogue listings, not quotes.
- The benchmark is synthetic and measures feasibility only. The figures in docs/PROBLEM.md were gathered by web search; each needs checking at its source before it is quoted.
- In the no-model workflow, photos stay in the browser (IndexedDB) and go to the YouCam API to render. Only photograph adults who have agreed to it.
- The Hat API completed but regenerated the outfit, scene and face, so headwear is planned for the fitting and excluded from previews.
- Optional language-model features (`lib/ai.ts`, `lib/director.ts`: brief breakdown, rack photo tagging, a tool-using director) need a separate key and have not been verified live. Without one, the director understands fixed commands such as "Gatsby’s black dinner jacket is damaged", "set the budget to $30" and "lock Daisy’s look".

## Project layout

```
app/studio/          studio, orders (order sheet), print (fitting cards), setup (cast, rack, feeds)
app/api/youcam/      upload, run, task, templates, credits (server-side key)
components/studio/   cast board and wall, plan check, inspector, side panel, change summary
lib/engine/          types, solver, ops, render graph, head-composite math (pure, unit-tested)
lib/orders.ts        order sheet, CSV and quote request
lib/catalogue/       supplier catalogue feed adapter
lib/youcam/          YouCam client, request bodies, result parsing
lib/gatsby.ts, lib/midsummer.ts   the two public showcases
scripts/             eval, smoke, showcase generate/build/render, feed schema
docs/                EVAL.md, PROBLEM.md, SHOT_LIST.md, catalogue-feed.schema.json
```

## License

MIT. The Gatsby demo is an independent Gatsby-inspired costume study, not affiliated with any film or stage production. *A Midsummer Night's Dream* is public domain; the staging is original. Performers, garments, suppliers and prices are fictional.
