# QUEUED — shop items: largest face, and their own prices

**From Tommy via Tip4urTime, 2026-11-15. Not started.**

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
