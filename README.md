# ENCORE

**See opening night before you rent or buy the costumes.**

ENCORE is a fitting room for an entire cast. A costume designer gives it the show, the cast and the rack they already have. ENCORE plans every look across every scene from that rack, renders each look on the real performers with the YouCam API (costume, outer layer, hairstyle, makeup and headwear), and lists exactly what is left to hire or buy, inside the budget.

When something breaks ("the navy greatcoat has moth damage"), ENCORE re-plans only the looks that used it, re-renders only the layers that changed, and updates the sourcing basket.

Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (eCommerce VTO track).

Open the included production at `/studio?showcase=1` after starting the app.

## The problem

Small productions (community theatre, schools, fringe companies) dress a whole cast from a shared rack, a hire house and secondhand shops. The hard part isn't choosing one costume. It's choosing all of them at once:

- one coat can't be on two people in the same scene;
- a performer who doubles roles needs both looks to work around their changes;
- every hire and purchase comes out of one small budget;
- and nobody sees the finished looks until the fitting, when changing course costs the most.

Costume software already tracks stock, measurements and scene plots. What it can't do is show the planned looks on the actual performers before anything is hired or bought, and keep that plan feasible when the rack changes.

## What ENCORE does

1. **Set up the cast.** The included one-act, *The Lantern Keepers*, has prepared scenes, roles and six costume looks. Add performer photos and sizes, and save the show's brief alongside the plan.
2. **Photograph the rack.** Add each piece's name, slot, colours, tags, sizes, quantity and whether it's owned, on hire, or for sale. Manual entry works without a model key.
3. **Plan the whole cast at once.** A constraint solver assigns pieces to every look: never more wearers in a scene than the rack holds, only sizes that fit, never over budget. Anything it can't fill becomes a sourcing need, not a hidden double-booking.
4. **See opening night.** Each look is rendered on the performer in two YouCam chains (below). The cast board fills with complete looks.
5. **Re-plan in one sentence.** Tell the director what changed. Only affected looks change; locked looks never do; only changed layers re-render.
6. **Take it to the fitting.** Printable fitting cards per performer: pieces, sources, hair and makeup direction, handoffs to rehearse.

## YouCam API usage

Every look is two chains of real YouCam tasks. Each stage's output image is the next stage's input.

```
body:      full-body photo ─▶ AI Clothes Virtual Try-On (costume) ─▶ AI Clothes Virtual Try-On (garment_category "outer")
portrait:  close-up photo  ─▶ AI Hairstyle Virtual Try-On (hair_color "src") ─▶ AI Makeup Virtual Try-On ─▶ AI Hat Virtual Try-On
```

| Feature | Endpoint | Used for |
|---|---|---|
| AI Clothes Virtual Try-On (v4) | `POST /s2s/v2.0/task/cloth-v4` | The rack piece on the performer; outer layers over the costume |
| AI Hairstyle Virtual Try-On | `POST /s2s/v2.1/task/hair-transfer`, `GET /s2s/v2.1/task/template/hair-transfer` | Hair direction, optionally keeping the performer's own colour |
| AI Makeup Virtual Try-On | `POST /s2s/v2.0/task/makeup-vto` | Stage makeup: foundation, lip colour and texture, skin smoothing |
| AI Hat Virtual Try-On | `POST /s2s/v2.0/task/hat` | Headwear from the rack |
| File API | `POST /s2s/v2.0/file` | Presigned upload of performer and rack photos, reused by file id |
| Credits | `GET /s2s/v1.0/client/credit` | Live unit balance shown in the studio |

Engineering details that matter for a real deployment:

- **Content-keyed render graph.** Every stage's key hashes its own inputs plus its parent's key (`lib/engine/render.ts`). Swap a coat and only that stage and the stages after it re-key, so in the showcase a lost coat re-renders 1 of 17 layers.
- **Saved-task resumption.** Task ids are stored with render records so polling can resume after a reload. The YouCam API has no idempotency key; interruption before an id is saved can still leave an uncertain creation outcome.
- **Errors arrive as HTTP 200.** Engine failures come back as `task_status: "error"` with a stringified tuple; they're parsed into messages a person can act on ("Use a full-body shot").
- **The key stays server-side.** The browser only talks to our routes in `app/api/youcam/`.
- **Upload once.** Performer photos are uploaded once per photo version and reused by `file_id`; rack photos are cached per server instance.

## The planner

`lib/engine/solver.ts` is a branch-and-bound search over (look, slot) variables, ordered fewest-candidates first, with an optimistic bound from each remaining slot's best match.

- **Hard constraints:** scene capacity (`qty` per scene), size fit, availability, budget.
- **Objective:** tag and colour match to each look's brief, minus a small cost penalty. Unfilled required slots cost a fixed penalty and become sourcing needs.
- **Replanning:** `replanWithout` frees only the (look, slot) pairs that used the lost piece and freezes everything else. Locked looks stay fixed in every full re-plan.
- **Soft warnings:** a piece passing between performers across back-to-back scenes is flagged as a handoff to rehearse.

### Evaluation (synthetic, seeded, reproducible)

`npm run eval` compares the planner with what most teams do by hand: pick the best piece for each look on its own.

| Planner | Feasible plans | Double-bookings (total) | Over budget | Unfilled slots | Avg solve time |
|---|---|---|---|---|---|
| Look-by-look baseline | 24.5% | 317 | 25.5% | 145 | 0.3 ms |
| ENCORE planner | 100.0% | 0 | 0.0% | 176 | 3.9 ms |

200 synthetic productions (3–6 performers, 4–7 scenes, seeds 1–200). ENCORE leaves 31 more slots unfilled than the baseline: those are slots the baseline "filled" by double-booking a piece or overspending, which ENCORE reports as sourcing needs instead. The scenarios are constructed to measure feasibility, not taste. See `docs/EVAL.md`.

## Optional assisted setup

With a separately configured model key, the code supports three bounded jobs (`lib/ai.ts`, `lib/director.ts`). These integrations have not been verified live and are not required for the showcase or recording:

- **Breakdown:** structured output (zod schema) from the written brief, plus questions where the brief is ambiguous.
- **Rack tagging:** vision plus structured output from one photo of one piece. The designer confirms it.
- **Director:** a tool loop over the real solver (`find_items`, `mark_unavailable`, `change_requirement`, `lock_look`, `set_budget`, `production_summary`). The model never states a price, size or quantity the tools didn't return. The server returns an op log and the browser replays it on the full production; the solver is deterministic, so both sides agree.

Without a model key, the director uses deterministic commands and still understands "the navy greatcoat has moth damage", "`<piece>` is unavailable" and "re-plan". Planning, manual rack intake, YouCam rendering, locks and fitting cards need no language-model service.

## Run it

```bash
nvm use                      # Node 22; install it with nvm install if needed
npm install
cp .env.example .env.local   # only if you do not already have this file
# Add YOUCAM_API_KEY for real renders; leave model keys blank.
npm run dev                  # http://localhost:3000
```

- **No keys:** demo mode. Planning, replanning, the scene plot and the basket all work; renders are clearly labelled costume sketches.
- **YouCam key:** real renders. Add performer photos and rack photos in *Cast & rack*.
- **Optional model key:** assisted brief breakdown, photo tagging and broader director commands. Provider access and billing are separate from the YouCam allowance.

Checks: `npm run check` (typecheck and unit tests), `npm run eval` (planner evaluation), then the YouCam preflight (balance and hair templates; creates no render tasks):

```bash
npm run smoke -- --preflight
```

Once the five real photos are ready, run the layered API test (about 9 units):

```bash
npm run smoke -- --body full.jpg --face face.jpg --garment dress.jpg --outer coat.jpg --hat cap.jpg
```

## Honest limits

- Previews support appearance decisions. Physical fittings establish fit, comfort and movement.
- Hairstyle renders show a direction for the wig or styling team; they don't certify a specific wig.
- Sizes, quantities, prices and changeover notes come from what the wardrobe team enters. The showcase partner catalogue and its prices are fictional.
- In the no-model workflow, photos stay in the browser (IndexedDB) and go to the YouCam API to render. Optional assisted rack tagging also sends the selected rack photo to the configured model provider. Only photograph adults who have agreed to it.
- Real rendering still requires a successful smoke test on consenting performers' photos. Request construction alone does not establish visual quality.

## Project layout

```
app/                 landing, studio, setup, fitting cards, API routes
app/api/youcam/      upload, run, task, templates, credits (server-side key)
app/api/director     AI tool loop over the solver
lib/engine/          types, solver, ops, render graph (pure, unit-tested)
lib/youcam/          YouCam client, request bodies, result parsing
lib/showcase.ts      The Lantern Keepers, an original one-act written for the demo
scripts/             eval.ts (planner benchmark), smoke.ts (live API test)
docs/EVAL.md         reproducible planner benchmark and its limits
```

## License

MIT. The showcase script, characters and catalogue are original to this project.
