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

13. **B34 — Multiplex: a pre-draw with a LOAD-BEARING CENTRE WALL.** Queued
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
