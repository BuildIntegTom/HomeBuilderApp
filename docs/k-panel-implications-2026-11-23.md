# The K Panel discussion — digest, and what it means for this app

**Source:** `docs/K_Panel_Claude_Discussion-2026-11-23.odt`, with a plain-text
transcript beside it at `docs/K_Panel_Claude_Discussion-2026-11-23.txt` so it is
greppable and diffable. Larry's conversation with Claude, handed over by Tommy
2026-11-23. Larry states in it that he is **the engineer of record, a licensed
PE**.

> Read the transcript before relying on anything below. This file is a reading
> of it, not a substitute for it.

---

## 0. Two provenance classes inside one document — read this first

The transcript mixes two very different kinds of statement, and the app's flags
rule turns on the difference:

| Class | Examples | Status it earns here |
|---|---|---|
| **Larry's own statements of what Building Integrity builds** | 47.5in wide, 14in thick, 9ft tall; two 2x4 SPF#2 frames one per face; 3½in in the plane of the wall; K from the two left corners to mid-height of the right chord; block at that joint; internal braces every 36in; LVL top plate 1.25 x 11.25 flat with four 5/16 x 4in GRK RSS from above; 2x4 bottom plate; straw 7 pcf; U-0.026 | **`confirmed`** — Building Integrity said so, from the engineer of record |
| **Numbers the assistant computed for him** | every wind and seismic figure, every brace force, every capacity, the plate sizes, the nail counts, the drift | **`pending-BI-confirmation`** — computed, not signed |

The assistant flagged its own worst input, and the flag has to travel with the
numbers: *"My extracted copy had flattened tables, and I matched values to rows
and columns by position."* It also recorded a concrete symptom of that — NDS
yield gives 168 lb for a 5/16 RSS through a 1½in side member where the report's
table lists 236–239. **Nothing from that document goes into this app as
`confirmed` unless Larry signs it.**

It also carries a correction worth keeping, because the first version of the
claim is the intuitive one and it is wrong: the assistant initially said a K
layout gives the braces a shallower angle, then withdrew it. *"A correction: in
my earlier outline I said the K layout gives the braces a shallower angle. In
this layout it doesn't."* The real advantage is that each load reversal puts one
diagonal in tension and one in compression, so each carries about half of what a
single brace would.

---

## 1. The envelope — the thing the app has never had

Larry committed to a rating envelope. This is the single most useful item in the
document, and it needs no new engineering to be useful:

- **115 mph** basic wind speed, **Exposure C** (conservative — *"most of our
  houses are in exposure B"*), K_zt 1.0, enclosed
- **IBC 2024 / ASCE 7-22**, **ASD**, Risk Category II, Site Class D
- **SDC A or B**, whichever is more restrictive
- **One story**, representative footprint **40 x 60 = 2,400 sq ft**, rectangular
- Explicitly **out**: 140 mph, coastal, seismic-governed sites. Those get a
  separate calculation *"or we will go back to plywood shear walls with which I
  am familiar."*

The plate height was worked at 10ft and then at **9ft**, which is the number the
final tables use. 6:12 gable, ridge along the 60ft side, mean roof height 15ft,
overhangs ignored, flexible roof diaphragm, no interior shear walls.

**The assistant found the seismic escape hatch is narrower than Larry assumed.**
A K-braced timber frame is not a listed system in ASCE 7 Table 12.2-1. If it
lands in *"shear panels of all other materials"* at **R = 2**, seismic overtakes
wind at the top of SDC B in the short direction and **throughout SDC B in the
long direction**. So "ignore seismic" holds cleanly only in **SDC A**, or while
S_DS ≲ 0.28. At R = 6.5 (equivalence to wood structural panel shear walls, which
would have to be earned by test) wind governs throughout SDC B. The R-value
question is therefore not academic — it sets the market envelope.

---

## 2. The K panel as Larry builds it

Per panel, two 2x4 SPF #2 frames, one near each face, each carrying half the
panel shear.

- **Both diagonals start at the LEFT corners and meet at mid-height of the RIGHT
  chord** — a `>`. Run 46in, rise 53⅜in, length ~70½in, **49.6°** from
  horizontal. Frame height 106¾in below the LVL plate.
- Upper diagonal in compression, lower in tension; they swap when the wind
  reverses.
- At the mid-height joint the two diagonals' **horizontal components cancel**;
  their **verticals add** and run down that chord.
- **A short vertical seat block** at that joint, 4–6in, grain running vertically,
  so the diagonals bear parallel to grain and the block is screwed through the
  3½in chord into side grain. Larry asked whether a full-width horizontal stud
  would be stronger: **no** — the horizontals cancel, so a full-width member
  carries almost no axial load in the design case, and it butts end-grain into
  the chord, which is the weak way to fasten.
- **Keep the block short.** Every inch of offset between the two diagonal
  centrelines puts V x e of bending into the chord — about 1,800 in-lb (≈600 psi
  in a 2x4) at 4in of offset. *"Acceptable, but don't let it grow."* **This is a
  dimensional rule the app could enforce and currently does not know about.**
- **Internal braces every 36in**, inner stud to outer stud and left stud pair to
  right stud pair, to stop the compressed straw bowing the studs out.

**Force ratios, which are the portable part of the analysis:**

- diagonal force = **1.53 x V_frame**
- vertical at the chord joint, and the hold-down force = **2.32 x V_frame**

---

## 3. The numbers

Wind, ASCE 7-22 Ch. 28 envelope method, Exposure C:
q_h = 0.00256(0.85)(115²) = 28.8 psf, **24.5 psf** with K_d = 0.85.

| | strength | **ASD, governing** |
|---|---|---|
| 40ft end wall (perp. to ridge), 9ft plate | — | **3,610 lb** |
| 40ft end wall, 10ft plate | 6,390 lb | 3,830 lb |
| 60ft side wall (parallel) | 7,230 lb total | 2,170 lb — does not govern |

Wall dead load ≈ **27 psf** (8.2 straw + 3 frame + 2 wood fibre + 9 clay plaster
+ 5 exterior finish), against ~10 psf for a stick-framed wall. Seismic weight
W ≈ 75 kips, of which the walls are almost half.

Per-panel, 9ft, final `>` geometry, 40ft end wall:

| K panels in the wall | per panel | unit shear | per frame | diagonal T/C | **hold-down per panel** |
|---|---|---|---|---|---|
| 3 | 1,200 lb | 304 plf | 600 lb | 920 lb | **2,790 lb** |
| 4 | 900 lb | 228 plf | 450 lb | 690 lb | **2,090 lb** |
| 5 | 720 lb | 182 plf | 360 lb | 550 lb | 1,670 lb |
| 6 | 600 lb | 152 plf | 300 lb | 460 lb | 1,390 lb |

For scale: 7/16 OSB with 8d at 6in o.c. edges ≈ **260 plf** ASD.

**Diagonal compression is the governing member check, and the straw is a 4.8x
unknown sitting on top of it.** Buckling through the wall thickness, le/d = 47,
gives about **980 lb** — adequate at 4 or more panels, marginal at 3. *"If the
straw braces the diagonal against buckling through the thickness, capacity
becomes about 4,700 lb, governed by in-plane buckling. That's worth testing."*

**The K's weak point, stated plainly:** if the compression diagonal buckles or
its joint slips, the horizontal components at the chord joint no longer cancel,
and the chord takes a sideways load of up to V at mid-height in bending. A 2x4
bending about its 3½in dimension over 9ft resists only modestly. So the
compression-buckling check is not a formality.

Drift ≈ **0.15–0.2in** at design load in the 4-panel case plus hold-down slip,
*"comparable to a plywood wall at the same unit shear."*

---

## 4. The connection saga — the headline, and it is a negative result

Larry asked for screws. The answer, after three passes, is that **GRK screws
cannot do this job the way he wanted**:

1. **Inclined fully threaded screws** (European practice, strong and stiff) are
   **outside ESR-2442's scope**. The report requires installation perpendicular
   to the face of the side member, and excludes angled screws and screws into
   end grain. *"Under US standards, then, the inclined-screw joint has no code
   design values."* Larry had already said inclined screws suited his process
   best — this reverses that.
2. **Lapped diagonals + perpendicular screws** works within the report, **but
   only at 1/4in, not 5/16in.** Main-member penetration must be ≥ 6D excluding
   the tip; through a 1½in diagonal into a 1½in chord only 1½in is available:
   - 1/4in: 6 x 0.236 = **1.42in** — meets it with a 3½in screw
   - 5/16in: 6 x 0.276 = **1.66in** — **does not**
3. **The chosen detail: 16 ga steel face plates with connector nails.**

### The plates (what he asked to have drawn)

- 16 gauge (0.060in) Grade 33, **G185 galvanized**, 11/64in punched holes
- **0.148 x 1½in connector nails**, positive-placement pneumatic nailer, **no
  press** — 1.44in penetration meets 6D; Z = 111 lb Mode IIIs, **178 lb ASD** at
  C_D 1.6
- **P1 corner plate** 8 1/16 x 10 5/16in, 12 holes (6 diagonal / 3 chord / 3
  frame plate). Top-left; bottom-left is the same part flipped.
- **P2 mid-height plate** 7 13/16 x 16 11/16in, 22 holes (6 into each diagonal,
  10 into the chord — raised from 8 because 8 came out at 99% of capacity)
- **Per panel: 4 x P1 + 2 x P2, and 88 nails.**
- **Keep the bearing-cut ends.** The diagonal pushes into the joint by bearing,
  so the plate carries tension only, and nail slip stays out of the compression
  half of every load cycle.
- **One-sided plate is the open risk.** The force acts ¾in off the member
  centreline — ~540 in-lb of out-of-plane twist at 690 lb. Pressed truss plates
  are always installed on both faces for this reason. *"This detail should be
  confirmed by test."*

### Still open in Larry's own list

- **LVL-to-panel screws.** The report does not tabulate an LVL side member; NDS
  yield gives ~180 lb, **290 lb at C_D 1.6**. Demand is 225 lb/screw at 4 panels
  (OK) and **300 lb at 3 panels (over)**. So either **5 screws per panel**, or a
  **rule of at least 4 K panels per 40ft wall**. The app currently builds four.
- **LVL splices along the wall are collector splices** and have to carry the
  accumulated shear across them. No detail yet.
- **The hold-down has to grip the joint, not just the chord** — at the
  bottom-left corner part of the vertical comes straight out of the diagonal.
  And **the bottom P1 plate covers the chord face to ~10½in up**, so the
  hold-down goes above that or onto another face.
- **Straw packing vs. the lapped option** — a lapped diagonal intrudes 1½in into
  the cavity and may cross the left-to-right spreaders. (Moot if the plates win.)
- **Chord combined bending + axial** needs a value for the straw's outward
  pressure on the studs, which nobody has measured.

---

## 5. Where this app already agrees — three independent cross-checks

Worth recording, because they mean the app's structural core is not an
invention:

1. **Same compression model, same answer.** `panelStructuralEstimates` /
   `shearDerivation` compute a brace's resistance as Fc' x A x sin(tilt) with C_P
   from NDS 3.7.1, le = the brace's own cut length, d = 1.5in out of the wall
   plane. Larry's assistant did exactly that: le/d = 70.5 / 1.5 = 47 → ~980 lb.
   Two independent passes, same idealisation.
2. **Same chord orientation.** Larry: *"the 3-1/2 in dimension is in the plane
   of the wall for the diagonals and the center stud."* The app's corner studs
   (`buildCornerStuds`, `panelMemberHelpers.ts`) are 2x4s at `rotationDeg: 0`,
   1.5in through the depth and 3.5in across the width. They match.
3. **Same 36in.** Larry's internal braces are *"every 36 inches"*;
   `computeStandardGirtRowCount` is `ceil(heightIn / 36) - 1` — *"a girt every
   36in, starting past 36in"*. The app already builds the member Larry's
   slenderness fix depends on, and the Blocking girt's 2x6 is centred in the
   panel depth resting on bars at both wythes, which is the right topology for
   tying the two frames together.

**And the app's own ESR-2442 constant confirms his negative result.**
`GRK_5_16_RSS.outsideThreadDiameterIn` is **0.276**, read from the current
(Oct 2025 / Mar 2026) reissue — a better-sourced copy than the flattened one
Larry's assistant worked from. So 6D = **1.656in**, and the finding that a 5/16
RSS cannot make a 1.5in-into-1.5in lap stands on this app's own number.

**Consequence nobody had written down: the 36in girt spacing is structural.**
Larry's chords are 3½in in-plane, so they buckle about 1.5in **through the wall
thickness** — le/d = 108/1.5 = **72**, over the NDS limit of **50**. The 36in
bracing is what drops it to 24 and makes the chord work. The app moves girts for
other reasons (`girtDodgesTheBrace`, 2026-11-21: deck girts move back to clear
bracing). **A girt moved far enough to stretch a span past 36in now has a
structural consequence it did not have yesterday.** That wants a check, and
`girtBraceDodge.test.ts` is where it would go.

---

## 6. Where the app has a hole this document fills

The app's refusal is on record in its own words, in two places:

> *"A rating is capacity measured against DEMAND, and demand needs a design base
> shear this app has no numbers for."* — `shearDerivation.ts`

> *"UPLIFT IS STILL NOT A CHECK — the app has no wind or seismic uplift
> DEMAND."* — `data.ts:1566`

**This document is the demand half, for one envelope.** That changes what the
app can honestly offer, in four places.

### (a) An envelope gate — the cheapest big win

The highest-value addition is not a number, it is a **boundary**: *this building
is inside / outside the envelope Building Integrity's engineer has analysed*
(115 mph, Exp C, SDC A–B, one story, rectangular). Outside it, say so and stop.
That needs no new engineering and it is the most honest thing the app could say
about structure today.

### (b) Wall-line demand — real, but it is an extrapolation

`WallShearDerivation` already has `wallLengthFt` and `lbPerFt`, so the sheet is
shaped to take a demand beside the capacity. **But Larry worked one building:**
40 x 60, one story, 9ft plate, 6:12, ridge along the long side, flexible
diaphragm, no interior shear walls. This app draws octagons, courtyards,
multiplexes and second stories. Generalising 3,610 lb to an arbitrary plan is an
engineering extrapolation, not a transcription. Two honest routes:

- **(i) Implement ASCE 7-22 Ch. 28 properly** inside the stated envelope, with
  every coefficient tagged for provenance the way the Derivation Sheet already
  tags material inputs. The app has the drawing to do it from — footprint, wall
  lines, plate height, pitch, opening fractions.
- **(ii) Hard-code only the representative case** and show it as a *comparison
  building*, refusing to quote a demand for anything else.

**Recommend (i) with a tight gate.** (ii) produces a number people will read as
theirs. **This is a building decision and needs Tommy's word before any code.**

### (c) Hold-downs — the clearest missing part in the whole app

**2,090 lb per panel at 4 panels; 2,790 at 3.** The app has no concept of a
hold-down, chord tension, or overturning anywhere: no member, no shop item, no
price, no install step, no drawing. Larry's constraints are specific and
buildable — grip the chord/diagonal joint, clear the bottom P1 plate's ~10½in,
and credit panel self-weight (27 psf x 9ft x 3.96ft ≈ 1,070 lb, **640 lb after
0.6D**). If hold-downs existed as members, the existing overlap gate would catch
the plate collision by itself.

### (d) The derivation sheet is deriving the wrong governing term

Larry's step 5 is titled *"Design the connections (usually what governs)"*, and
the thread proves it: the members were never close to governing; three
connection schemes were tried before one survived. The Reference Points page
already found the app quotes eight fastener spacings and checks none of them
against a load. **So the Shear Derivation sheet derives member capacity and
stops, and member capacity is the second-order term.** The next phase of that
sheet is the brace-end connection.

---

## 7. New parts the app would have to carry

| Part | Count | Notes |
|---|---|---|
| **P1 corner plate** | 4 / panel | 16 ga G185, 8 1/16 x 10 5/16, 12 holes. A flat part with holes — exactly what `dxf.ts` is for, and `projectExportAssemblies.ts` is the one list every export reads. |
| **P2 mid plate** | 2 / panel | 7 13/16 x 16 11/16, 22 holes |
| **Connector nails** | 88 / panel | 0.148 x 1½in, positive-placement nailer |
| **Hold-down** | 1 / chord, or per wall-segment end | 2,090–2,790 lb; must grip the joint |
| **Mid-height seat block** | 2 / panel (one per frame) | 4–6in, grain **vertical**, screwed through the chord |

Plus a **bearing cut** on each diagonal end — a double miter seating against
both the plate and the chord. The app's brace ends are cut plumb and level
(`brace_end_cut_argument_order`: arg 1 plumb, arg 2 level). **A double bearing
cut into a corner is a different cut and a different cut note.**

**And the standing no-overlap rule turns out to have a structural reason.** A
face plate needs a flat plane across chord, diagonal and frame plate — which is
precisely what "no overlapping members" guarantees. It also kills option 2:
lapped diagonals overlap by design, so they were never available to this app
anyway. Worth writing into `no_overlapping_members` — the rule was adopted for
fabrication and it has been earning its keep structurally.

---

## 8. Roof panels — Tommy asked specifically

The roof's zigzag landed yesterday (`766a5ed`). Larry's document is about wall
shear, but it splits cleanly into what transfers and what does not.

### Transfers

- **The roof and the walls are two ends of one load path, and nothing in the app
  connects them.** Larry's step 1: *"Distribute those loads through the roof and
  floor diaphragms to each braced wall line."* His whole wall calculation
  **assumes** a flexible roof diaphragm delivering 12,420 lb to the wall lines.
  The zigzag is what makes the roof a diaphragm. This is the biggest conceptual
  addition in the document.
- **The same connection problem, and it is worse up there.** The zigzag's whole
  virtue is corner-to-corner contact with the bodies clear — flush, zero
  overlaps. Which means a roof brace node has exactly the problem Larry hit: no
  member overlaps another, so you cannot screw through a face. He solved it with
  a 16 ga face plate. **A zigzag node needs the same answer and does not have
  one** — and on the roof there is no plywood to fall back on (`roof_brace_
  exterior_face`: no plywood on the roof; Blocking girts carry none either). The
  app already computes the corner-to-corner step (width/cos θ, 4.33in at 36°),
  so a node plate's shape is derivable.
- **The 6D penetration finding applies anywhere a screw goes through 1.5in into
  1.5in** — worth sweeping the roof schedule against it.
- **Uplift is where the roof actually hurts,** and `data.ts:1566` already says
  the truss screw has a capacity with nothing to compare it to. q_h = 24.5 psf
  is the input that check has been missing.

### Does not transfer

- **The 2.32V chord accumulation is specific to the `>` K**, where both
  diagonals land on one chord. The zigzag's chain enters a bay at one corner and
  leaves at the diagonally opposite one, so its vertical accumulation is a
  different sum and has to be worked out on its own.
- **The listed-system / R-value problem is a shear *wall* question.** A wood
  diaphragm sits in a different article.
- **The angle band.** Larry's K is at **49.6°**, above Tommy's preferred 30–45°
  band. At 49.6° the brace force is 1.54V; at 36° it is 1.24V — so the shallower
  band is genuinely better for brace force, and the zigzag note's *"stops
  fighting the panel's proportions"* was the right instinct. Larry's 49.6° is
  **forced** by 46 x 53⅜, not chosen. But it does mean the band is a
  floor/roof preference, not a universal rule, and the engineer of record has
  signed off on something outside it for walls.

---

## 9. What it means for the engineering prep the app offers

The app's posture — publish capacity with provenance, refuse to state a pass,
name no seismic zone — is right and should not change. What changes is the
target:

1. **There is now an engineer of record with a stated envelope.** The app can
   stop being envelope-less. Gate first, numbers second.
2. **Connections govern.** The derivation sheet's next phase is the brace-end
   joint, not a better column check.
3. **Stiffness distribution becomes a real app-level warning.** Larry's
   assistant: *"if K panels share a wall line with plywood panels, the stiffer
   plywood takes more than its share of the load."* **The app lets a wall line
   mix braced, patterned and nailer panels freely and presents that as a free
   choice.** It is not one. At minimum the Review Log should say so when a wall
   line mixes a diagonal-braced panel with a nailer-plus-covering panel.
4. **Three things are explicitly "confirm by test", and one of them is a 4.8x
   swing.** The straw bracing the diagonal (980 → 4,700 lb), the one-sided plate
   eccentricity, and cyclic behaviour under reversal. **The app's capacity
   numbers assume no straw contribution** — the conservative end of that swing.
   That deserves to be said out loud on the derivation sheet: this is the
   unbraced-by-straw case, and a racking test could multiply it.
5. **The test program is the gate on everything.** Connection tests (ASTM
   D1761), racking static (ASTM E564) and cyclic (ASTM E2126), with and without
   straw and with plaster. Capacity, stiffness, ductility, failure mode. Then a
   design table per panel type: allowable shear, stiffness, hold-down force,
   required connections, aspect-ratio limits.

---

## 10. Decisions that are Tommy's, not mine

1. **Is the `>` K a figure this app should produce at all?** It is not any of the
   three current ones. `superbrace`/`braced` put diagonals on the **exterior
   face**; Larry's sit **in the plane of each 2x4 frame, flush with the chords**,
   two frames per panel, with no plywood. Closest in spirit is `braced` ("one
   long diagonal across the pair, with an added horizontal tie at mid-height"),
   and even that is a different topology.
2. **47.5in / 14in, or 48in / 15.5in?** Larry states 47.5 x 14. The app builds
   48in panels in a 15.5in wall, and 15.5 was chosen deliberately on 2026-11-01
   so wall joints stack on deck joints. One of these is out of date and I do not
   know which.
3. **Demand route (i) or (ii)** from §6(b).
4. **Does the app carry the steel plates**, or do they stay on Larry's
   fabrication drawings outside it?
5. **Do hold-downs become members** — with a price, an install step and a place
   in the overlap gate — or a note?

## 11. Things I am not claiming

- That any number in §3 is right. They are computed, unsigned, and the
  assistant that produced them flagged its own fastener-table extraction.
- That the app's girt row actually braces the chord through the wall thickness.
  The topology is right — the Blocking 2x6 is centred in the depth and rests on
  bars at both wythes — but it **rests**, and whether that connection develops
  the restraint the le/d = 24 assumption needs is a question for Larry.
- That the 3-panel marginal cases matter in practice. The app builds four GRK
  screws per LVL joint already, which is the 4-panel rule by accident.
