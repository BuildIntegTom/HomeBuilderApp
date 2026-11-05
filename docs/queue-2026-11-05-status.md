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

## B. Waiting on Tommy — nothing moves until these are answered

| # | question | why it is stuck |
| --- | --- | --- |
| 1 | **Ring girt placement** — how many rings per panel, and at what heights? | His 2026-11-05 spec gives the parts (four 2x4s on edge: two 45″, two 12½″ on a 4ft panel) and the screws, but not **how many rings a panel gets or where they sit** — the straight girt rule is one per 3ft of span. |
| 2 | **Does a ring girt change where a brace lands?** | A brace's low point rides the girt bar's top face (his 2026-10-13 rule). A ring stands on edge, 3½″ not 1½″, so every diagonal in a ring-girt panel moves up 1″ unless he says otherwise. |
| 3 | **Big Header price rate** | He said build the sheet AND the rate. A $/unit is his number, not a researched placeholder — or it ships flagged pending-BI. |
| 4 | **Second-storey floor deck in the packet** | The deck sheets print once, at the front. A two-storey building sets its upper deck *after* the ground-floor walls. |

## C. Next up, in order, all unblocked

1. **Panel editor stride 2** — interviewed 2026-11-05, all four answers in hand:
   drag snaps to neighbour faces then ⅛″; a diagonal dragged plumb **converts**
   to a nailer and says so; member right-click offers delete / duplicate /
   change lumber size / move to the other wythe; an overlapping drop is
   **refused** and snaps back.
2. **Ring girts** — the parts and the fastening are settled (28 × 3½″ #10 per
   ring: 4 per corner, 3 at each of the four frame contacts). Blocked only on
   B1 and B2 above.
3. **Big Header's own fabrication sheet** — the last panel type without one.
4. **Starter templates** — the single highest-value idea out of the PBM
   teardown; see `pbm-designer-teardown-2026-11-05.md`.

## D. Open questions that are not blocking anything

- **Shipping bundles**: *"full panel height x 3 panel depths tall"* — on the
  interview list, not sized. ⚠ Lands on packing maths still flagged
  illustrative and truck-bed dimensions that are industry-typical placeholders.
- **Gable window** — spec given 2026-11-01 (gable panel + header body, no sill,
  bottom edge on the truss plate). Not built.
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
