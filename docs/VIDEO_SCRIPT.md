# ENCORE demo video (target 2:45, hard cap 3:00)

Judges may score from the video alone. Every second either shows the product working on real people or names the YouCam API doing the work.

**Format:** 1920×1080 screen recording of the studio in a browser at 1440 px wide, plus about 10 seconds of phone footage (rack intake). Real API, real performers, no mock-ups.
**Audio:** voice-over recorded separately, then synced. Music only from a royalty-free source you have rights to (YouTube Audio Library), quiet under the voice. No third-party trademarks on screen: tape over brand labels on the rack.
**Before recording:** capture the initial real render while the board fills, then inspect every finished look. Click the **Looks** tile (Restore rack & re-plan, which keeps photos and renders) to prepare the plan comparison. Record the first coat re-plan before rehearsing it: it creates one new layer, so cut the wait with a 2-second cross-fade. Later takes reuse the cached pea coat and switch instantly; the re-render count only appears when a layer is actually pending. Completed looks remain visible after restoring the rack.

---

## 0:00–0:12 · Cold open (the problem)
**Screen:** Black. Then a real photo of your costume rack, slow push-in.
**Caption:** *3 performers. 6 looks. 1 rack. $250.*
**VO:** "A small theatre dresses a whole cast from one rack and a tiny budget. The hard part isn't picking a costume. It's picking all of them at once, and not seeing any of it until the fitting."

## 0:12–0:30 · The cast and the show
**Screen:** `/studio/setup`, Cast photos tab: three performers with full-body and close-up photos, sizes and hat fit. Cut to the studio's scene plot: five scenes and six looks, including one performer doubling roles. The prepared brief can appear briefly; no assisted drafting shot.
**VO:** "For our original one-act, The Lantern Keepers, three performers play four roles across five scenes. We add their photos and sizes once. Six costume looks share the same rack and the same budget."

## 0:30–0:45 · The rack (phone)
**Screen:** Phone footage: photograph the navy greatcoat on a hanger. Cut to Rack intake and enter the fields by hand: *Navy wool greatcoat · Outer layer · navy · coat, wool, naval*, sizes, quantity and source. Tap **Add to rack**. For an existing showcase piece, replace its thumbnail instead of adding a duplicate.
**VO:** "Photograph each piece, then enter its tags, sizes, quantity and cost. Owned pieces and a sample hire-and-resale catalogue go into one plan."

## 0:45–1:05 · Plan the whole cast
**Screen:** Studio. Click the **Plan check** tile. Left panel, in red: *"Navy wool greatcoat is on 2 people in 'The Harbour at Dusk' but the rack has 1."* Right panel, in green: *0 hard conflicts · $0 · N options weighed in N ms.*
**Caption:** *Picking costumes one character at a time vs ENCORE*
**VO:** "Pick looks one character at a time and the captain and the harbourmaster both get the only navy coat, in the same scene. ENCORE plans every look together: one piece, one person per scene, inside the budget."

## 1:05–1:35 · See opening night (the reveal)
**Screen:** Click **See opening night** if any layers are pending; otherwise begin on the completed cast board. Six complete looks on three real performers, each with a portrait inset. Slow scroll. Open **Elsie, the masquerade** in the drawer: Full-body photo → Costume → Outer layer, and Close-up → Hairstyle → Makeup. Hover the pink API labels. Use an actual render capture if showing cards filling in: restoring the rack keeps completed renders, so it does not replay that animation.
**Caption (stacked, 1 s each):** *AI Clothes Virtual Try-On* · *AI Clothes Virtual Try-On, outer layer* · *AI Hairstyle Virtual Try-On* · *AI Makeup Virtual Try-On* · *AI Hat Virtual Try-On*
**VO:** "Then, opening night, before anything is hired. Each look is two chains of YouCam API calls: Clothes Try-On puts the rack piece on the performer, and a second Clothes call layers the coat over it. Hairstyle Try-On sets the hair direction while keeping the performer's own colour. Makeup Try-On adds the stage face. Hat Try-On adds the headwear. Every stage feeds the next."

## 1:35–2:10 · The money shot: something breaks
**Screen:** Type into the director bar: *"The navy greatcoat has moth damage, we can't use it."* Press Send.
Show in order: the toast (*Re-planned 1 look: Rowe, off the boat: outer Navy wool greatcoat → Naval pea coat*), the green line *↻ Re-rendering 1 of N layers. Everything else is kept.* (N depends on the hair styles chosen), Rowe's card shimmering then revealing the pea coat, the scene plot lighting up in scenes 1, 4 and 5, the rack showing the greatcoat struck through, and the Sourcing tile ticking from $0 to $40.
**VO:** "Then reality happens. The navy coat has moth damage. One sentence. ENCORE finds every look that used it, swaps in a naval pea coat from the hire house, and re-renders one layer of one look. Not the whole cast: one layer out of all of them. The budget updates: forty dollars of two-fifty."

## 2:10–2:25 · Lock and print
**Screen:** Open Elsie's masquerade look and click **Approve & lock look**. Then **Fitting cards**: Jonah's card shows the pea coat, its source, the rehearse-the-handoff note, and the renders.
**VO:** "Approved looks are locked, so no re-plan touches them. Every performer gets a fitting card: what to pull, where it's from, and what to check in person."

## 2:25–2:45 · Close
**Screen:** Back to the full cast board. Then a title card.
**Caption:** *ENCORE · See opening night first.* Below it: *Built on the YouCam API: Clothes · Hairstyle · Makeup · Hat Virtual Try-On.* Below that: *Previews show appearance. Fittings confirm fit.*
**VO:** "For theatres, it's opening night before the first fitting. For hire houses and resale shops, every gap in the plan is a basket line, priced, sized and ready to book. ENCORE: see opening night first."

---

### Shot checklist
- [ ] No assisted breakdown or auto-tagging shots; the recording works with model keys blank
- [ ] Every look rendered with the real key (no "sketch" badges anywhere on screen)
- [ ] Rack pieces photographed, brand labels hidden
- [ ] The three performers have agreed, in writing, to appear in a public video
- [ ] Browser zoom 100%, bookmarks bar hidden, notifications off
- [ ] The YouCam units tile shows real spend (judges like seeing the API used for real)
- [ ] Upload to YouTube as **Public**, title "ENCORE: YouCam API Skin AI & eCommerce VTO Hackathon"
