# Where everything stands — 2026-11-05

One page for the meeting. The long history stays in
`plan-2026-10-31-queue.md`; this is the board.

---

## A. Landed since 2026-11-03

| | what |
| --- | --- |
| **B19 st.4** | The panel editor stores edited members; an edited panel is its own part. |
| **B21** | Vertical nailer overlay — a guarantee, not a generator. |
| **B22** | Every row walks the brace pattern; the last automatic bracing rule retired. |
| **B23** | A **pair** of structural girts at every wall-bearing floor-panel end, one under each toe-up board. |
| **B24** | Girt styles — Blocking (2x6) is the default. |
| **B25** | Shop sheets name themselves: `10' Super Carrot (L) 48"`, type colour, and the pusher-head sheet order. |
| **B26** | The packet prints in install order: floor → walls → roof. |
| **B27** | Straw drawn as a 3D volume with a texture toggle; floor/roof sheet colours. |
| **B28** | Box beam green, truss plate blue; plywood outermost on both lids; mid-wall beam back with the walls. |
| **B29** | Panel editor stride 2 — move with snapping, the four member actions, and a brace dragged plumb now stops counting as a brace. |

## B. Answered 2026-11-05 — nothing is blocked

| asked | his answer |
| --- | --- |
| How many ring girts per panel, and where? | **The same rule as a straight girt** — one per 3ft of stud span. |
| Does a ring change where a brace lands? | **Yes — the brace rides the ring's top face**, so diagonals sit 1″ higher in a ring-girt panel and the angle follows. |
| Big Header price rate | **$25/sq ft.** His number, not a placeholder. **Built B33, 2026-11-06.** |
| Second-storey deck in the packet | **Leave it** — all deck sheets at the front. |

⚠ One thing from the same round that I had wrong and he corrected: a **Ring
Girt is not curved**. It is a rectangle of four 2x4s on edge holding the straw
— two 45″ and two 12½″ on a 4ft panel. Everything I had refused it for (how it
is cut, what sets the radius) was answering the wrong question.


## C. Next up, in order, all unblocked

1. ~~**Ring girts**~~ — **DONE, B31 2026-11-06**, generalised into a
   cut-and-tie pass over the whole panel by **B32** the same day. Everything
   needed was in hand: four 2x4s on edge per
   ring (two 45″, two 12½″ on a 4ft panel), one ring per 3ft of stud span,
   28 × 3½″ #10 screws per ring (4 at each of the 4 corners, 3 at each of the 4
   frame contacts), and braces ride the ring's 3½″ top face.
2. ~~**Big Header's own fabrication sheet**, at **$25/sq ft**~~ — **DONE, B33,
   2026-11-06.** It was worse than "without either": a placed Big Header had no
   sheet, no weight, no plywood, no export row, no overlap audit entry, no
   panel count and **no price bucket at all**, so his $25 moves a total **up**,
   not down. One disagreement was named rather than settled — a Big Header is
   given zero straw and a window header a member-aware volume, for the same
   cavity. See `plan-2026-10-31-queue.md`.
3. ~~**The 3D member hit test**~~ — **DONE 2026-11-05**, and this entry was
   stale until 2026-11-16. `PanelMembersGroup.tsx` carries the picking, the
   three r3f traps it hit and the `pointerdown`-only decision. Original text:
   unblocks BOTH the pointer-drag gesture in the
   panel editor and the right-click menu in the 3D view. One piece, two
   surfaces; building it twice is how they come to disagree about what you
   clicked.
4. ~~**Starter templates**~~ — **DONE, U3 2026-11-07.**
5. ~~**Export for Tip4urTime**~~ — **DONE 2026-11-14.** A per-project CSV of
   every PHYSICAL panel (not assembly types) for the crew time-clock and
   profit-sharing app, with a **stable panel code** that never renumbers.
   The stability question is **answered**: the code is stamped at first
   export and stored from then on, so nothing is stored until a project
   actually goes to a crew, and it is a join key rather than a panel name —
   his derived-identity rule is untouched. Three smaller questions remain.
   Panel type is the app's own dozen names, not a coarse bucket. Measured on
   a Tiny House: 84 panels, 84 unique codes, re-export byte-identical.
   Two questions left (a Safety Gap tile's claimability; per-company ledgers)
   in `Claude outputs/tip4urtime-export-queued-2026-11-14.md`.
6. ~~**Jack studs take optional 2x4s**~~ — **DONE 2026-11-14.** The plywood
   jack sheet stays the default (I had read his "no plywood skins on either
   side" as covering it; it does not). A five-option select in Settings →
   Panelizer adds a 2x4 at the exterior wythe, the interior, or both, taking
   the jack from 3/4in to 2 1/4in in elevation — both wythes share one band,
   which is the only reading under which his 2 1/4in works. A 48in slot's
   clear rough opening goes 46.5in -> 43.5in.
   ⚠ It also turned out `jackStudConfig` was **never saved with the project
   at all**, so a design drawn with 2x4 jack studs reopened as plywood and
   quietly became a different building. Persisted now.
7. ~~**The shallow-shed cross-tilt hole**~~ — **CLOSED 2026-11-14 on his
   call**: *"Item 7 I like your recommendation here."* No filler is built.
   The original text, for the record:

   **The shallow-shed cross-tilt hole** — his cross-tilt answer resolved to
   *no change* (the low edge is the roof plane; thickening it pushes the
   panel through the roof it carries). What is left is the other direction:
   below the derived minimum the row is left UNDRAWN. ⚠ **Measured
   2026-11-14 and I now recommend CLOSING it rather than building the
   filler**: on a 24x16 Tiny House the low edge is 58.8in at the default
   4:12 and still 14.7in at 1:12, against a ~7in minimum — the refusal needs
   a near-flat roof on a tiny footprint, and when it fires it already names
   both numbers as a disclaimer in the Roof section. His call. Numbers in
   `Claude outputs/jack-stud-2x4-option-and-cross-tilt-2026-11-14.md`.

8. **Safety gaps are shop items, not panels** — **DONE 2026-11-14.**
   *"Safety gaps should also populate in the things to make in the shop as
   well as beams and stuff like that. Those simply don't count as panels. But
   maybe they count as surface area!"* They already had their own shop sheets;
   what changed is the COUNT. A Tiny House went from 80 panels to **74 panels
   + 6 safety gaps named separately**, and the Tip4urTime export gained a
   `Counts as panel` column that is 0 for a safety gap and for every beam —
   derived from the same place as the Summary's own count, so a crew's panel
   tally and the Summary agree row for row (measured: 84 rows − 10 = 74).
9. **The gable sliver** — **FIXED 2026-11-14.** *"Let two plates become one
   board."* Where a tile's taper makes the top and bottom plates want the same
   wood they are now ONE tapered rip, and at the feather edge the two skins
   become one sheet. The overlap sweep runs the sliver band from a low edge of
   **0** (the triangular tile itself, which the old 1.5in floor hid) in both
   orientations, at zero findings.
10. **Gable studs line up with the wall below** — **FIXED 2026-11-14.**
    *"I really want to see these studs lining up perfectly with the row below
    them, it does not appear that way on the app live right now."* Three
    separate defects:
    - A gable tile had **no centre studs at all** — four corner studs and
      nothing between, while the 48in wall panel under it carries a pair at
      x = 22.25. It now builds them on the same `MAX_STUD_SPACING_IN` rule and
      at the same x, cut to the sloped plate above.
    - The joint spans handed to the tiler were **cumulative from 0**, so on a
      wall that butts a longer neighbour every joint sat a wall thickness
      (15.5in) left of the panel below it. They start at the wall's own run
      start now.
    - The **elevation preview passed `[]`** for those joints and said so in a
      comment — so the drawing he looks at tiled four equal 48in tiles over a
      wall whose panels are 28.125 / 32.125 / 28 / 24 / 0.75 / 48, even while
      the model was aligned. The prop is threaded now and the two agree.

11. **Gable windows** — **BUILT 2026-11-14.** *"Gable Windows should be an
    easy build... it would be fun to randomly generate one window for every 12
    ft of wall length in the second story/Gable section."* One window per 12ft
    of wall, at random tiles (never the first or last — a gable row's end
    tiles are its shortest), seeded with the building and stored.
    ⚠ The real work was the composition: `computeGableTiledRow` used to
    switch joint alignment OFF as soon as a row carried a window, so
    auto-spawning them would have un-aligned nearly every gable end. Under his
    rule — **wall joints win** — a gable window IS its tile and its own width
    is ignored, so nothing is reserved and nothing renumbers.
    ⚠ It also surfaced a crash: a gable window cap's edge heights are stored
    LOCAL to the rough-opening top, and three readers subtracted the eave
    anyway, putting the builder 122in underground. The buildable test now
    lives in the builder module rather than at a call site — the third time a
    call-site clamp failed to cover the next call site.

12. **Big Header over 48in — stuffed perpendicular** — **BUILT and LIVE
    2026-11-14.** *"If they are greater than 48 in... the top and bottom plates
    should be completely within the panel so that the top and bottom plate
    stretch the entire opening."* The threshold is the width along the wall
    (his *"correct"*); at 48in and under nothing changes (his *"just the way
    its stuff and created / as is"*).
    ⚠ Two surprises. The top and bottom **skins already existed** on both
    flavours. And the **mid-wall** Big Header already ran its plates corner to
    corner with no jack studs at all, so it complied in full and needed no
    change — which matters, because it is the flavour that actually gets wide.
    What changed is the **slot** Big Header: over 48in its plates now run the
    full width and its jack studs stand between them, bearing the top plate.
    ⚠ **I reported this as dormant and that was WRONG.** I checked
    `panelWidthInRange.maxIn` (48in, the ordinary panel cap) and concluded a
    Big Header could never cross its own threshold. A Big Header does not use
    that range: it has had **`bigHeaderWidthInRange`, his own stated 4ft-12ft**,
    and its own width field in the panel note, all along. Its DEFAULT is
    **96in**, so every Big Header anyone places is already past 48in and
    already built the new way. Confirmed in the browser at 96in and at 48in,
    where the note flips to the standard-panel construction.
    ⚠ I had begun giving Big Headers a second width path with an 18ft
    ceiling, which would have overridden his own 12ft maximum from a different
    place. Backed out before commit — one catalog question, one answer.

12b. **The overlap sweep's own unfinished edge, and what it found** — **DONE
    2026-11-16.** This file's sweep had said since 2026-11-14 that floor/roof
    panels, the truss plate, the box beam and the cross-tilt row were *"still
    unswept"*. Swept now along their LENGTH. Four were clean first time (roof
    panel, truss plate, box beam, and the gable carrying BOTH of that day's
    cuts). **The floor panel had three faults**, all the same mistake: a bound
    that does not allow for what is in the way — the far lid is 2¼ in not
    1½ in, a station is not a point, blocking's extent along the span is 3½ in
    not its 1½ in thickness, and B23's far-end structural girts were
    unallowed-for. ⚠ **Measured: not one span the app lays out is affected**
    (22 checked), so it is a guard, not a change to parts he builds — which is
    exactly why no fixed-size test met it.
    ⚠ **And it pinned one new clash the 22½° corner mitre had introduced,
    which is now FIXED rather than left for him.** The nailer yields, not the
    girt: it BUTTS the bar's inboard face, which is a shop instruction with no
    measurement in it. ⚠ **Chasing that in the browser turned up the bigger
    one no test had seen**: on the 15½ in corner panel the app actually
    builds, the mitre made the two girt bars **overlap each other by
    2.482in**, on all sixteen corner panels of an octagon. The row is given up
    rather than the cut — the gable's own answer — and the Review Log names
    the sixteen. **Every test had built a 25½ in panel**, the COLUMN's width
    and the one width a corner panel never has. *Sweep the size the app emits,
    not the size the constant is named after.*

14. **B36 — the panel's name is its number.** ✅ **ALL THREE STRIDES BUILT
    2026-11-18.** **Stride 1 closed the key collision.** A series
    is now all LETTERS and a panel number all digits — `C`, `CB`, `CC`, … — so
    `C21` can only be wall `C` panel 21. ⚠ A separator was the obvious fix and
    the SHOP rules it out: *"there is no huphen stencil"*. ⚠ The rationale the
    old numeric suffix carried was FALSE — it claimed to match a second N wall,
    but panels count per SERIES not per wall, so no `N2` ever existed and the
    collision lived only in the interior series. ⚠ Not migrated, and the reason
    is the defect itself: **the old format cannot be parsed back.** One day of
    exposure, nothing in fabrication. Plan for strides 2–3 (one stamped number,
    the label is the number) in
    `Claude outputs/panel-naming-plan-2026-11-17.md`, whose separator option is
    now struck out. **Strides 2 and 3 are item 16 below, and they are done.**

15. **Hold the pitch on resize + a ninth footprint rebuild.** ✅ **BUILT
    2026-11-18.** His *"hold the pitch on resize"*. ⚠ Verifying it found that
    `footprintForBox` **deleted a Multiplex's interior walls** — two clicks of
    Decrease Width took it from 63 wall panels to 34 and the roof from 72 to
    36, silently. A ninth place rebuilds a footprint, and it is the one with a
    dial on it. ⚠ And a second half: with the walls carried, the SLOTS were
    still dropped, because `resizeSlotsForShapeChange` walks the outline only.
    The footprint and the slots are two paths and only one had been fixed.

16. **B36 — the panel's name is its number (strides 2–3).** ✅ **BUILT
    2026-11-18**, planned in `Claude outputs/panel-naming-plan-2026-11-17.md`.
    His ask: *"gosh i do like the 0001 naming convention though... if there
    was some fool proof way to make 0001 naming scheme work id be open to
    it."* He has it.

    ⚠ **THE HAZARD WAS WORSE THAN THE PLAN SAID.** Three numbers sat on one
    panel and two were four digits long — and those two counted in
    **different orders**: crew codes were stamped walking the EXPORT
    PIPELINE's list (walls, roof bearing, beams, decks) while B35's install
    number counted in his own install order. `P-0028` and install `0028`
    were different panels from the very first export, and both were shown to
    crews. That is the literal answer to *"wheres the 0028?"*.

    **One number now, and stamping it IN INSTALL ORDER is what makes the
    merge invisible**: a provisional number is the install position, so the
    number a person already read is the number that freezes. Measured live
    on the Tiny House: 86 panels, press **Issue for fabrication**, **zero
    numbers moved.** Widening 24ft to 25ft then added 4 panels, which showed
    `—` rather than a borrowed number and took `0087`—`0090` on the next
    issue while the first 86 held.

    ⚠ **An install STEP is a plain integer now** (*"step 42 of 134"*), and
    `formatInstallSequenceNumber` is DELETED — the zero-padding was the
    whole mechanism of the confusion. `panelCodeKey` and
    `installSequenceKey`, two byte-identical bodies kept equal by a test
    because neither module could import the other, are one `panelKey`.

    **Stride 3**: the plan canvas, the Plan View sheet, every elevation, the
    3D view and the fabrication chips label by NUMBER with `N3` beside it as
    its own location field. `PanelInstance.panelNumber` is renamed
    `indexInSeries`. ⚠ The one forced concatenation is an OBJ group name
    (`0042_N3`), which is a single string with nowhere to put a second
    field.

    ⚠ **CROSS-REPO**: the crew CSV's `Panel code` carries `0042` not
    `P-0042`, and `Install no` is renamed `Install step` with a plain
    integer. **Tip4urTime's importer needs to know about both.**

    ⚠ **And the gate missed a defect again, found only in the browser**:
    `toReviewLog` keeps only `pending-BI-confirmation` entries, so the
    issued-state line (filed `confirmed`) rendered in no build while all
    three gates passed. The filter is right — a cleanly issued project is
    not a review item — so the log is silent then and speaks only for
    panels with no number or numbers with no panel.

    His `i`/`e`/`x` idea and functional names (`RIDGE1`) are argued against
    in the plan, with reasons: `I` reads as `1` on a shop label, and a name
    that says what a wall DOES goes stale when the roof changes.

17. **Roof bracing built into the panel, instead of structural sheathing.**
    ⚠ **RESEARCHED AND PLANNED 2026-11-18, NOT STARTED.** His idea:
    *"why not also build in the roof bracing??? ... the structural value of
    plywoo sheathing is absolute over kill or at least let in diagonal 2x4
    bracing - just as the super carrot is - would structurally check out
    fine."* It comes out of his own vapour-open roof problem: thin OSB,
    Adhero, a 1½in vented gap, then structural sheathing.

    ⚠ **FIRST, A MEASURED FACT: a roof panel has NO plywood on its large
    faces and this app models NO roof diaphragm at all.** Checked, not
    assumed — the only plywood in a 48in x 18ft roof panel is two end
    plates and three girt webs. So this is not replacing plywood; it is the
    first in-plane element a roof panel would ever have, and it deletes the
    site-applied layer that is doing the whole job today.

    **The research backs the instinct**: SIPA/FPL testing finds panelized
    diaphragm strength is governed by the JOINT FASTENERS, not the skin
    (415-1,180 plf by screw spacing; doubling screws bought 60%; segment
    count did not matter). And 475's own roof case study says the second
    sheathing over a vented gap is mostly a shingle substrate and code
    comfort. ⚠ **Against it**: diagonal lumber is the weakest recognised
    system (300 plf 2006 IBC cap) and let-in bracing could not be grouped
    with the IRC's other methods because test data did not support it.

    ⚠ **Two design findings.** One X per panel is useless — a diagonal in a
    48in x 18ft panel sits ~76deg off the short axis. It wants to be a
    horizontal TRUSS (joists as chords, 4-5 diagonals near 45deg). And the
    panel-to-panel JOINT governs: a diagonal delivers a node force where a
    skin delivers distributed flow, so the connection gets harder, not
    easier. Five strides and four questions for him in
    `Claude outputs/roof-bracing-instead-of-sheathing-2026-11-18.md`.

13. **B34 — Multiplex.** ✅ **EVERY STRIDE BUILT — 1, 2, 3, 3b, 3c, 4 AND 5.**
    **Stride 3b: a wall that carries the roof is BUILT up to it — 2026-11-18.** It
    used to be tiled at the story height under a ridge a full rise above
    the eave. His rule: ONE panel however tall, until the peak passes
    16ft, then courses of the project's max panel height, greedy from the
    bottom. On his 36x36 at 8:12 the centre wall is 10' + 10' + 2' and
    each purlin wall 10' + 6'2⅝"; the roof lands on a truss plate like an
    exterior wall's. ⚠ The under-16ft exemption puts a panel past
    `panelHeightInRange.maxIn`, which is ALSO his number — obeyed, and
    named in the Review Log at the real heights. ⚠ Three older defects
    surfaced in the browser: the panel COUNT was a slot count (62 shown
    for 99 built), the plan canvas labelled from its own instance list
    rather than the building's, and a banded safety gap's sheet carried
    the wrong height. All three fixed.
    ✅ **The ELEVATION tab — 2026-11-18, and B34 is COMPLETE.** The Edit
    menu reads *2D Floor Plan, Elevation: N, E, S, W, C, CB, CC*. It
    turned out small because `WallElevationDiagram` reads exactly two
    fields off a wall in 2,400 lines, `id` and `lengthFt`, so the prop
    narrowed to `ElevationWall` and an `InteriorWall` fits with nothing
    invented. ⚠ Gable End, Box Beam and Stop Wall are ABSENT and the
    panel says why; everything else is live, the right-click menu
    included. ⚠ The browser then found a cut height off the eighth
    grid — `194.58333333333331"` on a purlin wall — now snapped.
    **Stride 5: the interior walls are DRAWN — 2026-11-18.** They had been
    tiled, counted, priced, numbered and given shop sheets since stride 2 and
    drawn nowhere. Now on the 2D plan, the Plan View sheet and the 3D views,
    through the outline's own renderers rather than second ones. ⚠ The
    thickness STRADDLES the stored line where an outline wall's hangs inward,
    which is what `ridgeBearingWallFor` and `multiplexStudioWidthFt` already
    assume — get it wrong and the two studios come out different sizes.
    Measured in the browser: 11 panels summing to exactly 401in per wall,
    flush between the exterior walls' inner faces, centre wall centred on the
    18ft midline; and a test pins 2D and 3D equal panel for panel.
    ✅ **The elevation tab it said was missing arrived the same week** — see
    the top of this item. The Review Log entry is deleted with it.

    **Stride 4: the tile, at his 8:12, with a Four-plex.** The tile states
    its own pitch (12'-0" rise over an 18ft half-span, measured live) and
    its own storey count; the four-plex draws 126 wall panels, exactly twice
    the single-storey 63, and its LABEL says there is no stair yet. ⚠ It
    exposed a defect older than the tile: a resize that re-derives the roof
    reset the pitch to the app's 4:12 DEFAULT, silently. Fixed by reading the
    pitch back out of the stored rise (`roofPitchFromRise.ts`, both
    directions in one module so they cannot drift). ⚠ Left for him: a resize
    that does NOT re-derive carries the RISE, so the pitch drifts — measured,
    4.00:12 became 4.36:12 on a 2ft depth change. Hold the rise or hold the
    pitch is his call.
    **Stride 3c: a wall under each roof purlin — his answer** over posts to
    the floor, raking struts and a loft knee wall. A plane crossed by an
    interior wall builds TWO bands of panels, each bearing on that wall, so
    his worst roof panel goes from 21.6ft to 11.2ft and the refusal clears.
    No purlin beam either, by stride 3's own rule. ⚠ The tile is now two
    ONE-BEDROOMS, four rooms of 7'-4⅝", which he chose knowingly. ⚠ And a
    figure wrong since stride 1 fell out: a studio is **16'-0¾"** clear, not
    17'-4¼" — three wall thicknesses cross a Multiplex, not one. ⚠ Left for
    him in the Review Log: `C21` cannot be read (wall C2 panel 1, or wall C
    panel 21) once a building has more than one interior wall.
    **Stride 3: the centre wall IS the ridge beam.** The ridge now follows the
    wall rather than the building's long dimension (it ran east–west, square
    across it, until this), the gable ends move to N and S with it, and
    `roofNeedsRidgeBeam` returns false — no beam, no ridge posts, no load path
    or floor girts under them. A third roof-bearing case beside shed and peak,
    and the only one where a peak has no beam. ⚠ It also surfaced
    `decideRoofForm`'s `refusal`, which **has never been read anywhere in this
    app**: his 36ft Multiplex needs a 19.0ft roof panel at 4:12 against an 18ft
    maximum, and so does The Cindy at 17.4ft a side. Said in the Review Log
    now — and CLEARED on the Multiplex by 3c, while The Cindy still shows it,
    which is correct: it has no interior wall to carry one. ⚠ **Stride 3b, named not implied:** the wall is panelized to the
    story height while the ridge sits a full rise above it, so the row that
    does the carrying is not built. Stride 2:
    the centre wall is PANELIZED — 11 panels summing to exactly 401in, named
    `C1`-`C11`, install-numbered 0075-0085, on their own shop sheets and in
    the price, reachable from a new **Multiplex** Home tile. ⚠ It is in every
    total and on NO drawing yet, which the Review Log says out loud.
    ⚠ **The safety-gap question recorded here was based on a wrong
    measurement and is CLOSED.** A cornerless run does NOT get two gaps where a
    cornered one gets one — at 401in both get two. His answer ("a safety gap,
    not necessarily both ends, a similar amount to the threshold we have for
    all other walls") confirms what the tiler already did; the only change was
    to stop hard-coding WHICH end the gap goes to. **Stride 1: a wall can be
    interior.** `Footprint.interiorWalls` (optional, so every saved project
    is untouched), `buildMultiplexFootprint` for his 36x36, and the eight
    places that rebuild a footprint now carry it instead of silently
    dropping it. ⚠ Two traps caught: `corners` is the RING, not a bag of
    points, so an interior wall holds its own endpoints; and a surviving
    mutation showed the difference between carried and quantized.
    Strides 2-5 in the multiplex doc. Original text: Queued
    2026-11-16, not started. *"a home page option that says multiplex … a
    36x36' square with a straw wall running down the center and acting as the
    ridge beam … two rectngle studio apartments … at least the two options
    for duplex and four plex where its the same drawing, except with another
    story."* Stairs/decks and the loft are **explicitly deferred by him**.
    ⚠ **This is not a template, and sizing it as one would be the mistake.**
    `Footprint` is `corners[] + walls[]` and every wall is an edge of a CLOSED
    LOOP — the courtyard, the only multi-loop shape, is a second ring wound
    the other way. A dividing wall ends in **T-junctions**, which the mitre
    rules, `outwardNormal`'s winding, the gap rules, the roof planes and the
    deck cut all have no answer for. The real item is *"a wall can be
    interior"*; the 36x36 duplex is its first customer. ⚠ And *the centre wall
    acts as the ridge beam* replaces the ridge-beam-on-a-column arrangement
    entirely — a third roof-bearing case beside shed and peak. Six questions
    for him, two of which move the geometry, in
    `Claude outputs/multiplex-template-queued-2026-11-16.md`.


14. ~~**B35 — Sequential panel numbers + compass-coloured labels.**~~ **BUILT
    2026-11-16** on his *"go with your recommendations on b35 and build it"*.
    Live: **86 items numbered 0001–0086** on the 16ft Octagon — floor deck,
    walls clockwise from the least-accessible corner, gable row, tilted gable
    row, truss plates clockwise, roof panels last — each printing as a
    compass-coloured chip on its shop sheet, plus an `Install no` column on
    the crew CSV beside the stored code. All four recommendations taken:
    derived not stored, a tag never a group key, the number JOINS the name,
    and the direction colour only on the chip. ⚠ **Four ordering faults found
    in the BROWSER, three of them the same shape** — a fabrication group
    gathers identical panels, so the export's order is shape order, not
    building order: roof panels numbered with the floor deck (they share one
    export family), the gable row numbered backwards (its `slotIndexInWall` is
    negative and counts down), and the truss plates came out N/E/S/W then the
    four diagonals. Original text: Queued
    2026-11-16 at his request (*"give me a sanity check on this change and lets
    consider it to be planned and added to the queue"*). Panels renamed to
    `0001, 0002, ...` running from the point of least accessibility, clockwise,
    out to in, bottom to top, with each label coloured by its wall's compass
    direction using Feng Shui element colours.
    ✅ **The ordering half is already built**: `leastAccessibleCorner` is a
    real, user-set, persisted field that already drives the truck load order,
    `computePanelLoadOrder` already walks the perimeter from it, and the wall
    ring already runs clockwise as drawn (screen-up is North). So this is a
    LABEL on a sequence the app already computes.
    ⚠ **One serious problem and three collisions**, all in
    `Claude outputs/panel-numbering-and-compass-colours-queued-2026-11-16.md`:
    a sequential number RENUMBERS when the design changes (and stability is
    what he liked about the T4T code, which is stored precisely so it cannot);
    unique names would un-group the shop packet from ~12 sheets to 74; a number
    does not say what to build, which is what B25 was for; and the sheets
    already carry TYPE colours that green and blue would collide with. Plus
    three of the eight Feng Shui colours (white, grey, black) cannot be printed
    on a white sheet. Recommendations for all of it in that doc; **his call**.


## D. Open questions that are not blocking anything

- **Shipping bundles**: *"full panel height x 3 panel depths tall"* — on the
  interview list, not sized. ⚠ Lands on packing maths still flagged
  illustrative and truck-bed dimensions that are industry-typical placeholders.
- **Gable window's own BODY** — the opening, the cap, the sills, the jack
  studs and now the seeding are built (2026-11-14). What is still only a spec
  from 2026-11-01 is the *header body* reading: *"gable panel + header body,
  no sill, bottom edge on the truss plate."* Today a gable window gets sill
  instances like a wall window does.
- **A header's straw** — B33, 2026-11-06. A Big Header is given **zero** straw
  and a window/door header a **member-aware volume**, for the same kind of
  cavity, and he has said the two *"are really the same thing."* Which way they
  agree is his: is the space between a header's chords and W-web stuffed, or
  void? ⚠ Not blocking anything; both numbers are small.
- **Saving an edited panel to the library as a named type** — needs its own
  interview; a saved type is stored JSON, so it has to be stored as a recipe,
  not a member list, or it goes stale.
- **Cross-tilt low edge undersized** — 5 pinned overlaps; the 3½″ low face
  cannot hold its own layers.
- **The roof eave cap's make-up** — bearing width is settled, the ply/stiffener
  make-up is still this app's reading.

## E. Closed this session, for the record

- **3/4″ vs 1/2″ girt web plywood** — asked four times, now moot: the **default
  Blocking girt has no plywood in it at all** (a centred depthwise 2x6), and
  floors and roofs are 3/4″ throughout. Nothing to change.
- **Panel editor stride 2** — interviewed and built the same day. What is left
  of it is the pointer-drag GESTURE, which needs the 3D member hit test.
- **Floor lid asymmetry** — found 2026-11-04, answered and fixed 2026-11-05:
  *"Plywood should always be on the exterior side for lids/plates."*
- **Mid-wall beam's place in the packet** — he overruled my reading; it sits
  with the walls.
- **Ring Girts as a curved member** — I had this wrong. It is a rectangle, not
  an arc.

## F. Standing rules this work runs under

- No overlapping members, ever — the audit pins floor panels at zero.
- Wall lengths are exact; refuse rather than guess.
- Panel identity is **derived**, never stored — *"not from a memory file."*
- Real-world building, fastener, dimension and cost values carry an honest
  `pending-BI-confirmation` rather than a plausible-looking number.
- Nobody does real work in the app until after November, so cloud data is test
  data and deploys are low user-risk.
