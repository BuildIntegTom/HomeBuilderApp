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
3. **The 3D member hit test** — unblocks BOTH the pointer-drag gesture in the
   panel editor and the right-click menu in the 3D view. One piece, two
   surfaces; building it twice is how they come to disagree about what you
   clicked.
4. **Starter templates** — the single highest-value idea out of the PBM
   teardown; see `pbm-designer-teardown-2026-11-05.md`.

## D. Open questions that are not blocking anything

- **Shipping bundles**: *"full panel height x 3 panel depths tall"* — on the
  interview list, not sized. ⚠ Lands on packing maths still flagged
  illustrative and truck-bed dimensions that are industry-typical placeholders.
- **Gable window** — spec given 2026-11-01 (gable panel + header body, no sill,
  bottom edge on the truss plate). Not built.
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
