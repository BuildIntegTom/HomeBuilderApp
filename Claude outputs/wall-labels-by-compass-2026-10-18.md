# Side quest, SHIPPED 2026-10-18 — wall labels by compass instead of AB/BC

> **Shipped the same day in `239a950`.** He picked `N2` for the duplicate case.
> Verified in the browser: a rectangle reads Elevation: N / E / S / W, and a
> bumped-out rectangle reads N, E, S, E2, S2, W, S3, W2. The one thing below
> still outstanding is `squareBaleCornerRefusal`, whose messages have no
> footprint to derive a label from.

**Tommy, 2026-10-18:**

> *"Labeling walls Ab, BC etc. makes it difficult for me to conceptualize which
> elevation view I want to look at and which wall is which wall. Can we change
> AB to just simply be N? BC to E? Etc. octagons would have N, NE, E, etc.
> these labels would affect the elevation view titles than anything else that's
> relevant like that"*

## This is smaller than it looks — the naming already exists and already ships

`packages/geometry/src/wallCompassDirection.ts` already does exactly this, and
has since before this request:

- `wallCompassDirection(wall, footprint)` takes the wall's **exterior face
  normal** and snaps it to the nearest of eight — `N/NE/E/SE/S/SW/W/NW`.
- **Screen-up is treated as North**, which is already written down as the app's
  convention and is already drawn as a fixed compass mark on the printed plan
  (`PlanViewDiagram.tsx`) and as the 3D compass widget.
- A rectangle's four walls land exactly on N/E/S/W. An octagon's four straight
  walls do too, and its four mitered walls land exactly on the intercardinal
  between their neighbours — clockwise from the top face: N, NE, E, SE, S, SW,
  W, NW. **That is already the octagon behaviour he is asking for.**

It is already what the shop sees, too. Panel names are `N1`, `N2`, `E1` …
(`panelInstances.ts`, no hyphen — his stencil decision of 2026-09-24), and the
spanning-header sheets already say *"East wall — spans E4, E5"* in full words.

**So what is missing is not the naming. It is that the EDITOR still shows the
internal wall id.** The app has two vocabularies and gives the shop the good
one while keeping the raw one on screen.

## What actually has to change

The user-visible label is built in one place:

- `apps/web/app/page.tsx:2339` — the viewer stop is
  `{ kind: "elevation", wallId: elevationViewWallId, label: elevationViewWallId }`.
  The label **is** the raw wall id. This is the line he is reacting to.
- `apps/web/app/WallElevationDiagram.tsx:2189` — `aria-label={`Elevation view of
  wall ${wall.id}`}`.
- Review Log and notice text that already mixes both, e.g. `page.tsx:8249`,
  `Wall ${direction} is not built at all (${wall.id})` — these are fine and
  show the pattern to follow: compass for the human, id in parentheses for
  tracing.
- `lockedWidthNotices.ts:186` and `squareBaleCornerRefusal.ts` still say
  `Wall ${wallId}` with no direction.

### ⚠ Do NOT rename `wall.id`

`AB`/`BC` are keys, not labels. They key the saved project file's
`slotsByStoryAndWallId`, `stoppedSlotsByStoryAndWallId`, run stops, box-beam
coverage, mid-wall beams, locked-width records and the undo history. Renaming
them is a migration plus a compatibility break for every saved project, to fix
a display problem.

The change is a **display label derived from the id**, everywhere the user
reads one — the same relationship the panel names already have.

## The one question that is genuinely open

**Two walls can face the same direction.** Any bump-out L-shape has two
north-facing walls; a concentric ring will have many. `wallCompassDirection`
returns `N` for both.

The existing panel numbering already decided one answer for the shop: the
counter in `panelInstances.ts` is **per direction, not per wall**, so two
north-facing walls share a single `N1…N12` sequence. The app already treats
"the north side" as one namespace.

For an elevation *title* that leaves a choice:

1. **`N`, `N2`** — second and later walls facing a direction get a number. Short,
   and matches the panel names' "N is the north side" feeling.
2. **`N (1 of 2)` / `N (2 of 2)`** — explicit that the north side is two
   separate elevations.
3. **`N-left` / `N-right`** — ordered by position along that face.

A plain rectangle or octagon never hits this, so it does not block the main
case. **Recommended: option 1**, with the raw id kept in parentheses on the
elevation title (`N2 (CD)`) so a drawing can still be traced back.

## Plan when it comes up the queue

1. `wallDisplayLabel(wall, footprint)` in `packages/geometry` — compass
   direction plus the disambiguator he picks; pure, tested, including the
   two-north-walls case and an octagon's full eight.
2. Point the elevation viewer stop label, the elevation `aria-label`, and the
   wall picker at it.
3. Sweep the remaining user-facing `Wall ${id}` strings in
   `lockedWidthNotices.ts` and `squareBaleCornerRefusal.ts` onto the
   compass-plus-id pattern the Review Log already uses.
4. Leave `wall.id` untouched everywhere it is a key.
