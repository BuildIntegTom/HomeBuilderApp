# Building the roof bracing into the panel — research and a plan

**His idea, 2026-11-18:**

> *"i have been struggling with how to sheath these roofs in a open
> permeability way. for my house i used some thin osb and then adhero and then
> air gap 1.5" and the structural sheathing. that was fine but just now i had
> the idea... why not also build in the roof bracing??? that would make so much
> sense for install reasons. surely... the structural value of plywoo sheathing
> is absolute over kill or at least let in diagonal 2x4 bracing - just as the
> super carrot is - would structurally check out fine."*

---

## 0. The thing to know before anything else

⚠ **A roof panel in this app has no plywood on its large faces, and the app
models no roof diaphragm at all.** I checked rather than assumed — built a
48in × 18ft roof panel and listed every plywood member it contains:

| member | size |
| --- | --- |
| `lid-start-skin` | 11.17in × 48in (the eave end plate) |
| `lid-end-skin` | 21.51in × 48in (the plumb tall end plate) |
| `anti-twist-0/1/2-web` | 15.5in × 45in (three girt webs standing between the joists) |

That is the whole of it. The panel is **an open frame**: two pairs of 2x6
joists, a plate at each end, three girt webs between them, straw in between.
Nothing closes the 48in × 18ft faces.

So this is not "replace the plywood with diagonals" in the model. **It is
adding the first in-plane structural element a roof panel has ever had.** Today
the entire roof diaphragm is whatever gets applied on site — in his house, the
structural sheathing above the 1½in air gap. That is exactly the layer he wants
to stop needing, and it is doing a real job.

That reframing makes his idea stronger, not weaker: there is no redundancy to
argue about, because there is nothing there yet.

---

## 1. What the research says

### 1a. His instinct about the sheathing is supported — by SIP test data

The closest precedent to these panels is the SIP, which has the same problem: a
building made of discrete panels that together have to act as one diaphragm.
SIPA's own technical bulletin on SIP diaphragms found that

> *the shear strength of stand-alone SIP diaphragms can be reasonably estimated
> using single fastener lateral strength values*

— and the Forest Products Laboratory study behind it found **no apparent impact
on diaphragm shear strength from changing the number of SIP segments**, while
doubling the screws raised strength only about 60%.

**The fasteners at the joints govern, not the skin.** That is the technical
content of his *"absolute overkill"*: in a panelized roof the face material's
own shear capacity is far more than the joints can ever deliver to it. Reported
SIP design capacities run **415 plf to 1,180 plf**, and the bulletin says screw
spacing is what moves that number.

### 1b. And the outer sheathing layer is partly a shingle substrate

475's own wood-frame roof retrofit case study describes the same assembly he
built — vapour-open membrane, ventilated space, second sheathing above it — and
says plainly that the second sheathing layer was there **to give a substrate for
shingles and to ease code approval**, and that it was not strictly needed from a
building-science standpoint.

So the outer layer is carrying three jobs at once: diaphragm, nail base, and
code comfort. His idea separates them, which is the right instinct.

### 1c. Roof-plane bracing instead of a deck IS a real system — but engineered

Pre-engineered steel buildings routinely have **no roof deck diaphragm at all**
and use horizontal rod X-bracing in the roof plane to carry lateral load to the
sidewalls. Trussed-rafter practice in the UK and Australia uses diagonal timber
or steel strap wind bracing in the roof plane for the same purpose.

⚠ **But none of it is prescriptive.** There is no IRC table for a diagonally
braced roof plane. Everything above is an engineered lateral system: the load
path, the chords, and above all the connections have to be designed and shown.
An Australian guideline on ceiling diaphragms puts it as *the design of any
additional bracing system should provide clear details of all connections.*

### 1d. ⚠ The one finding that argues against "surely it checks out"

Diagonal lumber is the **weakest** recognised option, by a lot:

| system | capacity |
| --- | --- |
| single diagonally sheathed lumber (2006 IBC cap) | **300 plf** |
| diagonal lumber nominal, in an AWC worked example | 520 plf nominal → **260 plf** ASD |
| unblocked WSP roof diaphragm, ⅜in OSB, 8d @ 6in | **505 plf** nominal |
| SIP diaphragms, by fastener schedule | **415–1,180 plf** |

And for walls specifically: when the 2009 IRC sorted its bracing methods into
700 plf and 400 plf groups, **let-in bracing could not be grouped with them** —
the test data did not support it, so LIB was handled separately. A test-based
white paper puts a let-in brace panel at about **1,400 lb allowable**.

That is a 1x4 let in and nailed with 2-8d per stud. His Super Carrot diagonal is
a **2x4 with GRK screws at each end**, and this app's own first-pass NDS
estimate for a braced panel is **~4,500 lb** — about three times the code let-in
brace, which is believable given the member and the fasteners. But the gap
between "a 1x4 let-in is the weakest thing in the code" and "surely a 2x4
diagonal checks out" is exactly where an engineer earns their fee.

**Nothing here says it won't work. It says the number has to be produced, not
assumed** — and this app has never had a structural engineer look at any of its
figures, which the Review Log says on every page.

---

## 2. ⚠ The geometry problem, and what it means for the pattern

A Super Carrot diagonal crosses a wall panel 48in wide × 10ft tall — a 1:2.5
rectangle, and the diagonal sits at a useful angle.

A roof panel is **48in wide × up to 18ft long**. One corner-to-corner diagonal
there sits at about 76° off the short axis — nearly parallel to the joists, and
nearly useless in shear: almost all of its axial force goes into the chords and
almost none across the panel.

**So it cannot be one X per panel.** What works in that shape is the thing the
shape already is: **a horizontal truss**. The two joist pairs are the chords, the
girt webs are the verticals, and 2x4 diagonals between them are the web
members — a Warren or Pratt truss lying in the plane of the roof, with a
diagonal roughly every panel width so each triangle is near 45°.

On an 18ft panel at 48in wide that is about **four to five diagonals**, not one.
The panel already carries three anti-twist girt webs at spacing, so the
diagonals would land in the same bays — and that is where they will collide,
which the overlap audit will catch the moment this is built.

---

## 3. ⚠ And the joints are the real design, not the diagonals

This is the part the SIP research makes unavoidable. A braced panel is not a
diaphragm. A row of braced panels is not a diaphragm either, unless the shear
can cross the joints between them.

Worse: a continuous skin delivers **distributed shear flow** into a joint, while
a diagonal delivers a **concentrated node force** at the point it dies. So
moving the shear into diagonals makes the panel-to-panel connection *more*
critical, not less, and changes it from a nailing schedule into a designed
connection at each node.

**That is the thing to design first, and the thing to ask an engineer about
first.** The diagonals are the easy half.

---

## 4. What this would actually buy

1. **The outer structural sheathing becomes optional**, so the roofing substrate
   can be chosen for permeability and weather rather than for shear. His own
   assembly — thin OSB, Adhero 3000 (8 perms wet cup, 0.00004 cfm/ft² air), 1½in
   vented gap — stops having a structural layer bolted onto the end of it.
2. **It arrives built**, which is his *"so much sense for install reasons"*: the
   lateral system is in the panel the crane sets, not a second trade on a roof.
3. **It is the same part the shop already makes.** A 2x4 diagonal with screwed
   ends is the Super Carrot's own member, and the app already builds, prices,
   weighs, draws and shop-sheets exactly that.

---

## 5. The plan

Five strides. The first two are honest groundwork with no structural claim; the
claim only arrives in stride 3, behind a flag, with his engineer's number.

### Stride 1 — the member, and the pattern that fits the shape
- A `roofBracePattern` on `FloorRoofPanelOptions`: `"none"` (today) or a Warren
  layout of 2x4 diagonals between the joist chords.
- Reuse `buildBracedPanelMembers`' own trapezoid end-cut geometry — the brace
  end cut, its angle note and its waste-triangle jig note are all built already
  and are his own 2026-10-11 decision.
- ⚠ **Flat, 1.5in through the depth**, per [[vertical-lies-flat]] — a brace on
  edge would eat 3.5in of the straw cavity for no in-plane gain.
- ⚠ **Resolve the collision with the anti-twist girt webs in the same stride**,
  or the overlap audit reports every roof panel in the building. The ring-girt
  work has the precedent for how to do this honestly.

### Stride 2 — it reaches the paperwork
- Price, weight, board feet, the shop sheet's cut list with its angles, the 3D
  view and the crew export. All of this is automatic once the members exist —
  it is the same path the Super Carrot takes — but it needs checking in the
  browser panel by panel, because that is where the last five defects were
  found.

### Stride 3 — the capacity, and the refusal
- Extend the **Shear Derivation sheet** (B18) to the roof plane: cut length,
  angle, fastener count, the NDS steps, pounds per panel and plf across the
  roof.
- ⚠ **It must state what it does NOT include**: the panel-to-panel joint, which
  governs. A roof shear number that silently assumes a perfect joint is the
  kind of figure this app exists not to print.
- A Review Log entry carrying the whole of section 1d above, at
  `pending-BI-confirmation`, until an engineer signs a number.

### Stride 4 — the assembly it frees
- A roof assembly chooser in Plaster Master / the Roof tab for the vapour-open
  stack: thin OSB or none, membrane, vented batten depth, nail base. The
  permeability engine (`permeability.ts`) already exists and already prints a
  perm rating; this is giving it the roof's layers.
- ⚠ The vented gap is a drying path, not a structural one, and the app should
  not let the two get confused in one control.

### Stride 5 — the joint
- The panel-to-panel shear connection as a real detail: a spline or strap at
  each diagonal node, drawn, counted and priced.
- This is the one that genuinely needs an engineer before it is built, and it
  is the one that makes the rest of it a diaphragm rather than a set of braced
  boxes.

---

## 6. What I need from him

1. **Which layer does this replace?** My reading: the structural sheathing above
   the air gap, leaving a nail base chosen for permeability. Not the thin OSB,
   which is doing air-barrier and membrane-substrate work.
2. **Every roof panel, or braced bays?** Steel buildings brace a bay or two per
   direction, not every bay. Bracing every panel is simpler to build and
   probably cheaper than it sounds, but it is a real choice.
3. **How many diagonals per panel, or should the app derive it** from the
   panel's length at a target angle near 45°?
4. **Is there an engineer to put a number on this?** Everything above can be
   built and drawn honestly without one. It cannot be *claimed* without one, and
   this is the first time the app would be asserting a lateral system that no
   code table covers.

---

## Sources

- [SIPA — Design of SIPs Used as Diaphragms](https://www.sips.org/documents/SIPA_TB_13_Design_of_SIPs_Used_as_Diaphragms.pdf)
- [Forest Products Laboratory — Lateral Load Performance of SIP Diaphragms (FPL-RP-700)](https://assets.apawood.org/asset/471f3c4b-c9b7-4e4c-980a-b9e1d76b3f67/FPL-RP-700.pdf)
- [Premier SIPS — Shear Wall & Diaphragm Capacity (Tech D-5)](https://sips.premierbuildingsystems.com/hubfs/Premier%20SIPS/Content%20Resources/Technical%20Docs/Technical%20Bulletins/TechD-5_Premier%20SIPS%20Shear%20Walls%20Diaphram%20Capacity.pdf)
- [SIP Engineering Design Guide, 1st ed. 2019](https://epsbuildings.com/wp-content/uploads/2024/06/SIP-Engineering-Design-Guide-July2019.pdf)
- [WoodWorks — Wood-Frame Shear Wall and Diaphragm Design](https://www.woodworks.org/wp-content/uploads/presentation_slides-STRASSER-Shearwalls-and-Diaphragms-WDS-200225.pdf)
- [APA — Designing Engineered Wood Diaphragm Systems](https://www.apawood.org/data/sites/1/documents/handouts/Designing-Engineered-Wood-Diaphragm-Systems-handout.pdf)
- [2006 IBC §2306 — diagonally sheathed lumber diaphragm limits](https://www.optasoft.com/applications/codes/2006IBC/HTMLHelp/2306.htm)
- [XPSA — IRC Bracing Methods, Relevant Test Data, and Recommended Design Values](https://xpsa.com/wp-content/uploads/2020/06/IRCBracingMethodsandDesignValuesWhitePaper.pdf)
- [Crandell — The Story Behind IRC Wall Bracing Provisions](https://aresconsulting.biz/wp-content/uploads/2020/12/Crandell-Wall-Bracing-Provisions-7-5-07-Final.pdf)
- [Applied Building Technology Group — IRC Wall Bracing Guide](https://www.appliedbuildingtech.com/sites/default/files/abtg_irc_2024_wall_bracing_guide_final_secured.pdf)
- [Steel Construction Info — Braced frames (horizontal roof-plane bracing)](https://steelconstruction.info/Braced_frames)
- [MiTek AU — Structural Ceiling Diaphragms (GN 197)](https://www.mitek.com.au/wp-content/uploads/2021/05/GN-Guideline-197.pdf)
- [475 — ADHERO 3000](https://475.supply/products/adhero-3000)
- [475 — Wood Frame Roof Retrofit Case Study](https://475.supply/blogs/case-studies/wood-frame-roof-retrofit-case-study)
- [475 — Foam-free wall assembly by climate zone](https://475.supply/blogs/product-intros/foam-free-wall-assembly-by-climate-zone)
