# BUILT — shop items: largest face, and their own prices

**From Tommy via Tip4urTime, 2026-11-15. SHIPPED the same day.**

His acceptance check passes live: a safety gap's row carries its largest face
and `Counts as panel = 0`. On a Tiny House the project price moves
**$44,775.00 -> $47,957.12** (+7.1%).

**Three things did NOT ship, and each is his call rather than an oversight:**

1. **Per piece vs. per assembly.** His rates are applied to each PIECE, which
   is his own wording twice over. The other reading prices the assembled
   thing's envelope once, and a Truss Plate differs by ~2x between them
   ($401.67 against roughly $775 per 10ft). In the Review Log.
2. **Plywood jack studs are priced but are not their own export ROWS.** They
   sit inside the panel they stand in. Giving them rows changes what a crew
   claims and is paid for.
3. **The ridge beam is still unpriced** — found while wiring this, see below.

The rest of this file is the brief as he gave it, kept verbatim.

---

Two changes for **shop items** — the pieces that are not straw panels: safety
gaps, plywood jack studs, LVLs, and beams and columns built from dimensional
lumber.

---

## 1. Square feet become the piece's LARGEST FACE

Today every piece is measured by its face **in elevation**. For a safety gap
that is the plywood seen edge-on: `0.75in x 120in = 0.63 sq ft`. He wants the
piece's largest face instead, the way a crew actually handles it — for that
same gap, the sheet: `15.5in x 120in = 12.9 sq ft`.

- **Shop items only.** Straw panels keep their elevation face, unchanged.
- The **`Sq ft` column** in the Tip4urTime export carries this number.
  Tip4urTime imports whatever the file says; nothing changes on its side.
- These rows keep **`Counts as panel = 0`**. ⚠ That includes **plywood jack
  studs, LVLs, and beams and columns** — check each is marked that way, since
  only safety gaps and the four beam pipelines were classified on 2026-11-14.

⚠ **This answers a question I raised on 2026-11-14 and he has now settled.**
The export note said a crew claiming a safety gap might expect the sheet's
12.9 sq ft rather than the 0.63 the elevation gives. It is 12.9.

⚠ **It makes the export's Sq ft and the Summary's own area DIFFERENT NUMBERS
for the same piece**, where today they agree by construction. That is now
correct rather than a defect, but whichever one `one_flat_rate_pricing`
multiplies has to be chosen deliberately — see below, because the answer is
"neither".

## 2. Prices per square foot, on that largest face

| Shop item | Price |
|---|---|
| Plywood jack studs and safety gaps | **$4 / sq ft** |
| LVLs | **$10 / sq ft, per LVL** |
| Beams and columns built from dimensional lumber | **$60 / sq ft** |

*"Per LVL"* means each LVL is priced on its own largest face: a header made of
two LVLs is two of them.

⚠ **This is the first real exception to `one_flat_rate_pricing`.** His
2026-11-13 rule was *"$25/sq ft for absolutely everything"*, and the method is
printed on every sheet. Three of these four rates are not $25, so the printed
sentence and the Summary's own explanation both have to change, or they will
state a method the totals no longer follow.

⚠ **Do NOT add prices to the Tip4urTime export.** That file carries panel data
only — no prices, clients or addresses — and that stays true. It is also the
property that lets it be served from a sync link later.

---

## His acceptance check

> Export a project that has a safety gap. Its row should show about **12.9** in
> `Sq ft` (not 0.63) and **0** in `Counts as panel`. The project's price should
> use the table above for every shop item.

## What this touches

`projectExportAssemblies.ts` (the one list every file export reads),
`tip4urTimeCsv.ts`, the price buckets, and the printed pricing sentence. The
`countsAsPanel` seam from 2026-11-14 is already the right place for "is this a
shop item"; what is missing is a largest-face measurement beside the elevation
one, and four rates where there is currently one.

---

## What shipping it found

⚠ **The roof-catcher (ridge) beam is drawn and never priced, shipped or
cut-listed.** `buildRoofCatcherBeamMembers` is called from `Building3DView.tsx`
ONLY. It has no fabrication group, so it is in no Shop Fabrication sheet, no cut
list, no CSV, no weight and no price — three 2x12s of dimensional lumber at $0
on every peaked roof. **Not caused by this change**: it was missing from the old
`beam` price bucket too, which only ever held the roof-bearing run and the
mid-wall beams. The shop-item work is what made it visible, because every other
beam now reaches the price through the export seam and this one is not on it.

---

## ⚠ SUPERSEDED THE SAME DAY — the three rates were wrong

He asked, hours after this shipped, for the prices to be checked against
reality: *"lets research some prices and set some prices where the price we
come up with the app is somewhere roughly 2.2x the raw materials cost of lumber
and nails for each beam/column/truss plate/safety gap."*

Against researched November 2026 stock prices, the table did not survive:

| piece | this table charged | multiple of its materials |
|---|---|---|
| one 2x4, 10ft | $175.00 | **27.6x** |
| one 2x12, 10ft | $562.50 | **29.6x** |
| a safety gap sheet | $51.67 | 2.8x |
| one 2x9 LVL web | $75.00 | **0.8x — below cost** |

⚠ **A truss plate sits on essentially every building this app draws**, so the
over-charge was not a corner case. It was live on `main` for about four hours.

⚠ **The unit was the error, not the values.** A rate per square foot is a rate
per unit of SURFACE; lumber is sold by VOLUME. A 3/4in sheet and a 2x12 of the
same face area differ in cost by roughly fifteen times, so no single number
covers both — at any value. Splitting three ways by material narrowed the error
without removing it.

**What replaced it:** shop items price at **2.2x their real stock cost**
(`packages/panel-catalog/src/materialCosts.ts`), which is the first cost data
this app has ever carried.

**What survived:** the **largest-face** rule, unchanged. It is still what the
exported `Sq ft` column reports, because that column is about what a crew
handles and is credited for, not about what the piece cost. His acceptance
check still passes.

**And the ridge beam below is now built** — Ridge Beam and Ridge Post are on
the export seam, so they are fabricated, cut-listed, exported, weighed and
charged for.
