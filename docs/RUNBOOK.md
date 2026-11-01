# ENCORE recording and submission runbook

The planner works without a model key. Real try-on still needs a verified YouCam connection, garment photos and consenting performers.

## 1. Local setup
- Use Node 22: `nvm use` (the repo includes `.nvmrc`).
- YouCam: redeem the hackathon code (1,000 units) at yce.perfectcorp.com, then create an API key.
- If `.env.local` does not already exist, copy `.env.example`. Set only `YOUCAM_API_KEY`; leave `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` and `ENCORE_DEMO` blank.
- Run `npm run smoke -- --preflight` to check the balance and hair-template response without creating render tasks.
- Use the prepared breakdown, manual rack tags and the director's damaged/unavailable/re-plan commands. No model key is needed.

## 2. Gate: prove layered try-on on real photos (1 hour, about 9 units)
Take five photos: yourself full-body (plain wall, arms slightly out), a close-up of your face, a dress or shirt, a coat, and a cap or hat, each flat or on a hanger.
```bash
npm run smoke -- --body full.jpg --face face.jpg --garment dress.jpg --outer coat.jpg --hat cap.jpg
```
Open every URL it prints and check:
- **cloth-outer**: is the coat over the costume, and is the face intact? This is the core of the product.
- **hat**: does it keep the hair, makeup and face? Hat Try-On has an outfit/background `style` field; if it repaints the whole image, move the hat stage to the body chain (one line in `lib/engine/render.ts`) or drop hats from the demo.
- **makeup-vto**: if it errors with `invalid_parameter`, read the message in `tests/fixtures/youcam/makeup-vto.json` and adjust `lib/youcam/bodies.ts` (lip `shape.name` must match Perfect Corp's lip-shape catalogue).
- **hair-templates.json**: confirm templates come back. The studio lists them in each look's drawer.
The script preserves task ids and resumes the same inputs on re-run. Do not discard that local state just to retry a poll. Keep source photos, upload credentials and signed output URLs private; only commit sanitized response fixtures that no longer grant access to a performer's images.

## 3. The rack (2 hours)
Use real pieces that roughly match the showcase. You only need the ones the demo touches:
- a navy coat (the greatcoat), a second dark coat (the frock coat), a pea coat or any navy jacket (the replacement)
- a cream knit sweater, a dark suit jacket, a light dress or two, a cardigan, a shawl or scarf, two caps

In **Cast & rack → Rack**, tap each showcase item's thumbnail to attach your photo. Hide brand labels. Photograph on a plain background with even light.

## 4. The cast (1 hour)
Three adults who agree in writing to appear in a public video. Rename Maya, Jonah and Priya in **Cast photos** to their real names and set sizes. One full-body and one close-up each.

## 5. Render and rehearse (2 hours, about 200 units)
- Open `/studio`, press **See opening night**, wait for all looks.
- Open each look's drawer. Use **Redo this layer** on any weak stage (it also redoes the stages after it); pick hair templates that suit the period. The prepared plan has 17 layers before hair choices, so use the actual on-screen total in the recording and submission.
- When every look is good, click **Export** in the studio header and commit the downloaded file as `public/showcase/production.json`. The deployed showcase then opens with your real renders for every visitor, no key needed. The file includes the performers' photos, so only do this if their consent covers a public web page (it already has to cover the public video).
- Capture the first coat re-plan before rehearsals if you want the one-layer render progress on camera. It costs about 2 units; later takes reuse the pea coat instantly. Between runs, click the **Looks** tile ("Restore rack & re-plan"): every piece goes back on the rack and the plan resets, while photos and finished renders are kept. Don't use **Start over**; it replaces photos and renders.
Budget: 6 looks × up to 5 stages × 1–2 units, plus retries and rehearsals, is roughly 150–250 of your 1,000 units.

## 6. Deploy (30 min)
Import the repo on Vercel using Node 22 and the free Hobby plan, add only `YOUCAM_API_KEY`, and deploy. Do not enable paid services. After recording, `ENCORE_DEMO=1` prevents new YouCam tasks; a bundled real showcase remains viewable while new renders use labelled sketches.

## 7. Record (3 hours, with retakes)
Follow `docs/VIDEO_SCRIPT.md`. Upload to YouTube as Public.

## 8. Submit (1 hour)
- Repo: make it **public** (MIT licence included), or keep it private and share it with contact_event@PerfectCorp.com.
- Paste `docs/SUBMISSION.md` into Devpost. Add 5 screenshots: cast board, look drawer with the API chain, plan check, the coat replan toast, a fitting card.
- After submitting, post the project for the Share & Earn bonus units.
