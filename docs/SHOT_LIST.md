# Shot list: ENCORE demo film (~2:50)

Picture and on-screen text only. No narration in this list; the voice-over is recorded last over the cut.

**Before recording.** Run `npm run dev` with `YOUCAM_API_KEY` set. Browser at 1440×900, zoom 100%, light theme. Every "Asset" marked *needs live render* must exist first; run the command given. On-screen text in quotes is typed exactly; text in brackets comes from the app. Saved renders are real YouCam outputs; never caption a saved render as happening live.

## Asset checklist

| Asset | Status on this branch | How to make it |
|---|---|---|
| Gatsby showcase, 12 saved layers | Ready | in the repo |
| Nick in the black dinner jacket (the look-by-look clash) | Needs live render, ~2 units | `npm run showcase:render -- gatsby --extra l-nick:outer=g-black-jacket` |
| Gatsby complete looks (Daisy first) | Needs live render, ~3 units a look | `npm run showcase:render -- gatsby --looks l-daisy --strategy composite`, then `--strategy direct`; keep the one that looks right, then render Gatsby and Nick |
| Midsummer cast and garment photos (33 images) | Needs live text-to-image | `npm run showcase:generate -- --units-per-image <console price>` |
| Midsummer renders (15 complete looks, ~75 units) | Needs live render | `npm run showcase:build` then `npm run showcase:render -- midsummer` |

## Shots

### 1 · 0:00–0:12 · The conflict, as a picture
- **Route:** `/studio?showcase=1&public=1`, Plan check panel open (it opens by default).
- **Action:** Start on the left half of the Plan check. Hold 3 s. Slow push in.
- **Zoom target:** the two thumbnails, Gatsby and Nick, each with the black jacket ringed in red, and the line "Same scene. The rack has 1."
- **On-screen text:** "Two characters. One jacket. Same scene."
- **Assets:** Nick in the black dinner jacket (*needs live render*). Without it his thumbnail says "not rendered"; do not record this shot until it exists.

### 2 · 0:12–0:25 · Stakes, then the name
- **Route:** same page, blurred to 20% behind text cards (edit-side blur).
- **Action:** three text cards, 3 s each, then the name card.
- **On-screen text (from docs/PROBLEM.md; confirm each figure in a browser first):**
  - "Hire: $165 a costume for one week." small: "TDF Costume Collection, regular stock"
  - "Extra weeks for fittings: +50% of the rental fee." small: "Pioneer Theatre Company rental terms, 2025"
  - "Alter it and can't undo it? You pay replacement value." small: "Costume Connection, Houston"
  - Name card: "ENCORE" / "See opening night before you rent or buy the costumes."
- **Assets:** none.

### 3 · 0:25–0:55 · The whole cast, and the solver clearing conflicts
- **Route:** `/studio?showcase=midsummer&public=1&view=wall`
- **Action:** (a) Cast wall loads; 15 tiles fill in. Hold 4 s. (b) Scroll up to the Plan check. (c) Left: [5 hard conflicts · $198 of $180], three suitors ringed on one black jacket. (d) Pan right: [0 hard conflicts · $160 of $180] with the jacket, the navy jacket and the hire jacket. (e) Tilt down to the benchmark line.
- **Zoom targets:** (c) "Same scene. The rack has 1."; (d) the three resolved thumbnails; (e) the benchmark sentence.
- **On-screen text:**
  - (a) "10 performers · 15 looks · 4 scenes · one $180 budget" small: "Fictional cast and prices"
  - (c) "Picked look by look: 4 double-bookings, over budget."
  - (d) "Planned together: 0 conflicts, $160."
  - (e) [Synthetic benchmark, 200 generated productions: look-by-look plans are feasible 24.5% of the time, ENCORE 100.0%.]
- **Assets:** Midsummer photos and renders (*needs live*). If they are not ready, use the Gatsby showcase for (c)–(e) and cut (a).

### 4 · 0:55–1:35 · One complete look, layer by layer
- **Route:** Gatsby showcase, open Daisy's look (click her card).
- **Action:** In "Complete look chain", click "Compare this layer" on each stage in order and drag the slider once per layer. Then click "Complete look" at the top and drag the slider from photo to finished character.
- **Zoom target:** the comparison slider; then the chain strip showing each API label.
- **On-screen text, one per layer as it lands:**
  - "AI Clothes Virtual Try-On · the emerald dress"
  - "AI Clothes Virtual Try-On · garment_category outer · the silver shawl"
  - "AI Hairstyle Virtual Try-On · 1920s sculpted waves"
  - "AI Makeup Virtual Try-On · wine lip"
  - If the composite strategy is kept: "Head composite (local, 0 units)" and keep the "composite" badge visible.
  - Final: "One image. Costume, outer layer, hair, makeup."
- **Assets:** Daisy's complete look (*needs live render*).

### 5 · 1:35–2:15 · Damage, then one layer re-renders live
- **Route:** Gatsby showcase, cast board.
- **Action:** (a) Type in the director bar: "Gatsby's black dinner jacket is damaged" and send. (b) The change summary appears: hold on it. (c) Open Gatsby's look, click "Redo this layer" on the outer layer to render the ivory jacket live (2 units; the composite re-pastes locally). Let the shimmer run to the finished image. (d) Back to the summary.
- **Zoom targets:** (b) the headline [Re-rendered 1 of 12 layers: 2 units instead of 21 for the whole cast] (with composite complete looks on Gatsby it reads [1 of 18 layers: 2 units instead of 30] plus one local re-composite); (c) the outer-layer tile finishing; (d) the Sourcing stat [$40 / $250].
- **On-screen text:**
  - (a) "Opening week. A jacket tears."
  - (b) "Only the jacket changes. Everything else is kept."
  - (c) "Re-rendering one layer, live." (true only in this take: it costs 2 real units)
  - (d) "$40 hire. Inside budget."
- **Assets:** a working key with ≥ 2 units (≥ 5 if Gatsby has complete looks with the direct strategy).

### 6 · 2:15–2:40 · The order sheet
- **Route:** `/studio/orders` with the Midsummer showcase loaded (open `/studio?showcase=midsummer&public=1` first, then click "Order sheet").
- **Action:** (a) Totals row. (b) Scroll through "On the rack", "Hire", "Secondhand". (c) Click "Download CSV". (d) Under "Request a quote", click the hire house; the draft fills in.
- **Zoom targets:** (a) [$160] / [$180] / [Left in budget $20]; (b) Grace's one secondhand dress listed for both of her looks; (d) the line "ENCORE has no live connection to suppliers and sends nothing."
- **On-screen text:**
  - (a) "What to pull, hire, buy and find secondhand."
  - (b) "Per performer, with sizes and the scene it's needed by."
  - (d) "A quote request you send yourself."
- **Assets:** none beyond Midsummer (works with swatches if photos are missing).

### 7 · 2:40–2:50 · Fitting card and close
- **Route:** `/studio/print` (Gatsby or Midsummer).
- **Action:** Hold on one card (complete look, pieces, sources, hair and makeup direction, quick-change note). Fade to the end card.
- **Zoom target:** the card's image and the "At the fitting" box.
- **On-screen text:** "Into the fitting room." Then end card: "ENCORE" / "Aryan Neopane" / "See opening night before you rent or buy the costumes." small: "Built with the YouCam API. Performers and prices in this film are fictional."
- **Assets:** at least one complete look rendered.

## Honesty rules for the edit
- Label fictional performers and prices on screen at least once (shots 3 and 7 do).
- The benchmark is synthetic; keep the words "synthetic benchmark" in frame.
- Only shot 5(c) is a live render on camera. Everything else shows saved results.
- Keep the "composite" badge visible wherever a composite appears.
