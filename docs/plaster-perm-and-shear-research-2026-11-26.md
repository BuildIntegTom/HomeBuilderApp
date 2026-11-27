# Plaster: vapour permeance and structural shear — what the literature actually measured

**Researched 2026-11-26** in answer to Tommy's questions:

> *"Plaster perm rating - enter research mode and gather what you can find out
> there about plaster perm ratings for clay plasters and lime plasters... Can
> you research any structural value associated with lime and clay plasters
> (separately) and think about if there is a difference in sheer strength for
> panels that are preplastered on most of the face but not on studs, and then
> shopped and installed, and then screwed together and seams plastered. How is
> the sheer value of plaster transfered to the studs? Is that the importance of
> stainless steel medium gauge staples and fibalsth through tar paper?"*

⚠ **Everything in this file is published third-party test data, transcribed
from primary sources. None of it is a Building Integrity value and none of it
is engineering.** Any number that reaches the app from here carries
`pending-BI-confirmation` and a citation. Four of the five source PDFs were
unreadable to the fetch agent (compressed streams); the numbers below were
extracted locally with `pdftotext -layout` from the saved copies, so they are
transcriptions of the real tables, not search-snippet paraphrases.

---

## 1. Vapour permeance — the question that was printing "not computable"

The app's proposal prints *"not computable"* twice because clay and lime had no
numeric perm rating. They have one. Several, in fact.

### 1.1 The code floor you must clear

From the proposed strawbale appendix (the text is reproduced in full inside the
Ecobuild seismic PDF, §105.6):

> **§105.6.1** *"Plastered bale walls shall be constructed without any membrane
> barrier between straw and plaster to facilitate transpiration of moisture
> from the bales, and to secure a structural bond between straw and plaster...
> Where a water-resistive barrier is placed behind an exterior finish, it shall
> have a minimum vapor permeance rating of 5 perms."*

So: **5 US perms minimum for a WRB**, and elsewhere the appendix bars any
finish below a Class III vapour retarder. The widely quoted figure is a
**3-perm minimum for plaster on a bale wall**.

### 1.2 Measured — EBNet's own tests (Straube, CMHC/EBNet, Table 4.1)

All samples **38 ± 1 mm (1.5 in) thick**, average of triplicates. US perms are
as printed in the report (metric ÷ 57.1, the report's own conversion).

| Mix | Permeance (ng/Pa·s·m²) | **US perms @ 1.5"** |
|---|---|---|
| Portland cement plaster (1:0.2:3) | 355 | **6.2** |
| Cement-lime plaster (1:1:6) | 514 | **9.0** |
| **Lime plaster (1:3)** | 804 | **14.0** |
| **Earth plaster – 1** | 1,259 | **21.9** |
| **Earth plaster – 2** | 1,133 | **19.7** |
| **Earth plaster – 3** | 1,073 | **18.7** |

> *"The earth plasters tested are the most permeable samples we have tested."*

**⚠ Note the 1:3 lime row is Tommy's own base coat.** His spec is 3:1 sand:lime
base — i.e. 1 part lime to 3 sand — which is exactly the tested mix. **14.0 US
perms at 1.5".** His float (2.5:1) and finish (2:1) are *richer* in lime, and
the report's Figure 2.2 shows increasing lime content *raises* permeance
(*"Pure lime:sand stuccos were the most permeable tested"*), so the 3-coat
system should sit at or above 14 perms, not below it.

### 1.3 Measured — Minke, via the same report (Table 2.4)

Also at 38 mm / 1.5 in. The right column is permeability in US perm-inch.

| Material | Permeance (ng/Pa·s·m²) | **US perms @ 1.5"** | US perm-inch |
|---|---|---|---|
| **Clay earth plaster** | 612 | **10.7** | 16.0 |
| Silty earth plaster | 502 | 8.8 | 13.1 |
| Cowdung-earth-lime (12/4/3/20) | 620 | 10.9 | 16.2 |
| **Lime plaster** | 445 | **7.8** | 11.6 |
| Lime-casein (10:1) | 377 | 6.6 | 9.8 |
| Lime-linseed oil (20:1) | 347 | 6.1 | 9.1 |

### 1.4 The answer, as a range

| Plaster | Measured range, 1.5 in | Code floor | Verdict |
|---|---|---|---|
| **Clay / earth** | **10.7 – 21.9 US perms** | 3 (5 for a WRB) | clears it 3.5–7× |
| **Lime** | **7.8 – 14.0 US perms** | 3 (5 for a WRB) | clears it 2.6–4.7× |
| Cement-lime | 5.2 – 9.0 | 3 | clears it |
| Pure 1:3 cement | **0.68** (Straube 2000) | 3 | **FAILS — prohibited** |

Two honest caveats to print with any of this:

1. **Spread between sources is wide** — Minke's lime is 7.8, EBNet's is 14.0,
   for nominally the same thing at the same thickness. Mix, sand, cure and
   protocol all move it. A single number would be false precision; the app
   should print a range.
2. **The protocol is modified.** *"ASTM E96 is used as a basis but some
   modifications were required."* These are not clean E96 certificates.
3. **Thickness dominates and coatings matter.** The same report shows oil paint
   dropping a 1:1:6 stucco to ~0.6 US perms — *"oil paint can render a typical
   stucco a vapour barrier."* Limewash and clay paint (ALIZ) barely moved it
   (19.2 and 20.9 perms). Siloxane and sodium silicate did not close it either.
   **A plaster's perm rating is only as good as what gets painted over it.**

### 1.5 What to do in the app

Replace both *"not computable"* rows with the measured range, the thickness it
was measured at, the source, and a `pending-BI-confirmation` flag. Printing
*"10.7–21.9 US perms at 1.5 in (clay; Minke / Straube-EBNet, modified ASTM
E96) — not a certified rating for this mix"* is strictly more honest than
printing nothing, because *"not computable"* currently reads as *"this wall has
no vapour performance"*, which is the opposite of the truth.

---

## 2. Structural value — lime vs clay, separately

### 2.1 The allowable shear table (the real one)

**Table 106.16 — ALLOWABLE SHEAR (plf) FOR PLASTERED STRAWBALE SHEAR WALLS.**
This is the proposed IBC/IRC table, reproduced inside the Ecobuild seismic
document. **Allowable stress design. Plaster on BOTH sides. Aspect ratio ≤ 1:1.**

| Wall | Plaster | Thick (each side) | Sill | Anchor bolt | Mesh | Staple spacing | **Allowable shear** |
|---|---|---|---|---|---|---|---|
| **A1** | **Clay** | 1.5 in | 2×4 | 32 in | **None** | **None** | **60 plf** |
| **A2** | **Clay** | 1.5 in | 2×4 | 32 in | 2×2 HD polypropylene | 2 in | **140 plf** |
| **A3** | **Clay** | 1.5 in | 2×4 | 32 in | 2×2 × 14 ga | 4 in | **180 plf** |
| B | Soil-cement | 1 in | 4×4 | 24 in | 2×2 × 14 ga | 2 in | 520 plf |
| **C1** | **Lime** | **7/8 in** | 2×4 | 32 in | 17 ga woven wire | 3 in | **330 plf** |
| **C2** | **Lime** | **7/8 in** | 4×4 | 24 in | 2×2 × 14 ga | 2 in | **450 plf** |
| D1 | Cement-lime | 7/8 in | 4×4 | 32 in | 17 ga woven wire | 2 in | 380 plf |
| D2 | Cement-lime | 7/8 in | 4×4 | 24 in | 2×2 × 14 ga | 2 in | 520 plf |
| E1 | Cement | 7/8 in | 4×4 | 32 in | 2×2 × 14 ga | 2 in | 540 plf |
| E2 | Cement | 1.5 in | 4×4 | 24 in | 2×2 × 14 ga | 2 in | 680 plf |

Footnotes that change the numbers:

- **(f)** Values are for aspect ratio **≤ 1:1**. **Reduce to 50% at 2:1**, linear
  interpolation between. Full value is allowed above 1:1 only if a *second
  layer of mesh* runs from the base up to where the remainder is 1:1 or less,
  is stapled to the sill, and the sill bolts tighten by interpolation.
- **(g)** **Clay on one side + anything stiffer on the other:** a registered
  design professional must show the load going into the **stiffer plaster
  only**, and **50% of that designation's value** applies. You do not get to
  add the two skins.
- **(h)** **+40% for wind design.**
- **(i)** 16 ga mesh instead of 14 ga → **×0.60**.

### 2.2 Lime vs clay, head to head

**Lime is worth 2.4–3.2× clay, at 60% of the thickness.**

- Lime at 7/8 in with 14 ga mesh: **450 plf**
- Clay at 1.5 in with 14 ga mesh: **180 plf**

So Tommy's exterior lime choice is the structurally stronger one by a wide
margin, and it gets there with a thinner coat. That is worth knowing — it was
chosen for craft and breathability reasons, and it happens to also be the
better shear skin.

**⚠ But there is a binder catch, and it bites his current spec:**

> **§104.4.6.2 Structural walls.** *"Lime plaster on structural strawbale walls
> in accordance with Table 105.14 or Table 105.15 shall use a binder comprised
> of **hydraulic or natural hydraulic lime**."*

Tommy's spec is **Type S slaked lime** — allowed as *lime plaster* generally
(§104.4.6.1 lists Type N/S hydrated, hydraulic, NHL and quicklime) but **NOT
permitted as a structural lime plaster**. To claim the 330/450 plf rows he
would need **NHL** (NHL 3.5 or 5), not Type S hydrated. This is a real,
actionable finding and it is cheap to fix at spec time, expensive to fix after
a wall is up.

Corroborating why the binder matters: the 2003 plaster tests used a
non-Type-S high-calcium hydrated lime and got about **half** the expected
strength — *"We believe that a portland cement lime plaster produced with Type
S lime would yield a plaster with about twice the compressive strength."*
Lime quality is not a detail here.

### 2.3 Does un-meshed plaster on 7 lb/ft³ straw do anything?

**Yes — 60 plf.** Row A1 is clay plaster, 1.5 in both sides, **no mesh, no
staples**, and it still carries 60 plf allowable. That is the direct answer to
*"if 7 lbs/cuft straw actually has any shear associated with it"*: bales run
roughly 6.5–8 lb/ft³, so 7 is squarely in the tested range, and the bare
plaster-on-straw sandwich is worth a real, small, code-recognised number.

**Why it works at all** is the part that matters for panel design:

> **§105.6.1** *"...to secure a structural bond between straw and plaster."*

And from Bath, quoting King:

> *"The plaster coats act as skins in a form of construction analogous to
> structural insulated panel composites."*

The two plaster skins are the faces of a SIP and **the straw core is the web
that transfers shear between them.** That only works where plaster is bonded
directly to straw.

### 2.4 Corroborating full-scale tests

**University of Bath, three-bale wall, lime plaster, in-plane racking:**

> *"In the racking load test the load capacity of the plastered wall was over 4
> times higher than that of unplastered wall."*

Also: out-of-plane deflection under the same load was **~30× higher**
unplastered; vertical capacity improved **~200%**; and a 1 kN/m vertical
service load improved the plastered wall's racking capacity by **~50%** (gravity
helps — pre-compression closes cracks).

**Ash et al. (2003), full-scale reversed cyclic, 8×8 ft** — the test program the
code table is derived from. Max average shear **17.65 kips** (cement, 8×8) and
**7.5 kips** (4×8, Faurot 2004). Drift reached **±7.5% of wall height with no
loss of gravity support** — *"cracks opened between the bale courses but the
cracks would close on reversal."* Factor of safety **2.5** was applied to get
the clay allowables; a further **10% reduction** where plaster strengths and
reinforcement were taken from the proposed table.

**Seismic factors** derived for the appendix: strawbale shear walls as a
bearing wall system **R = 3.5, Ω₀ = 3, Cd = 3** (height limits 25/25/15/15/NP
by SDC B–F); as a building frame system **R = 4, Ω₀ = 3, Cd = 3.5**
(35/35/25/15/NP).

---

## 3. "How is the shear value of plaster transferred to the studs?"

**It isn't.** That is the real answer, and it reframes the question.

> **§106.11 Transfer of loads to and from plaster skins.** *"Where plastered
> strawbale walls are used to resist in-plane lateral loads, such loads shall
> be transferred to the **reinforcing mesh** from the structural member or
> assembly above and to the **sill plate** in accordance with Table 106.16."*

The load path is:

```
   shear in the plaster skin
            ↓
   the MESH embedded in it
            ↓
   STAPLES, diagonally across mesh intersections
            ↓
   the TOP PLATE above and the SILL PLATE below
            ↓
   anchor bolts → foundation
```

**Nothing in that path is a stud.** The plaster skin is a shear web spanning
between two horizontal boundary elements, and the mesh-plus-staples is the only
connection it has. Studs resist out-of-plane and carry vertical load; they are
not how in-plane shear leaves the plaster. (This is why the table's variables
are sill plate size, anchor bolt spacing, mesh type and *staple spacing* — and
why there is no stud column in it at all.)

Two more requirements that fall out of this:

- **§106.12 Support of plaster skins** — *"shall be continuously supported
  along their bottom edge... An unsupported weep screed is not an acceptable
  support."* Every structural plaster skin needs real bearing underneath it.
- **§106.13** — uplift: mesh per Table 106.16 with staples at 2 in o.c. is good
  for **200 plf per plaster skin**, not counting in-plane shear.

### 3.1 The staples — his guess was right

> **§106.10.2.1 Staples.** *"Staples shall be pneumatically driven, stainless
> steel or electro-galvanized, **16 gauge with 1 1/2-inch legs, 7/16-inch
> crown**; or manually driven, galvanized, **15 gauge with 7/8-inch legs**.
> Other staples shall be permitted to be used as designed by a registered
> design professional. **Staples into preservative-treated wood shall be
> stainless steel.**"*

> **§106.10.2.2 Staple orientation.** *"Staples shall be firmly driven
> **diagonally across mesh intersections**."*

> **§106.10.2.3 Staple spacing.** Top plate: **2 in o.c. max**. Sill plate:
> **4 in o.c. max**, unless the table or an approved design says otherwise.

So **"stainless steel medium gauge staples"** is exactly right: 16 ga pneumatic
or 15 ga hand-driven, and **stainless is mandatory wherever they go into
treated wood** — which is the sill plate on essentially every job. Diagonal
across the intersection, not parallel to a wire.

### 3.2 The tar paper — his guess was half right, and the half that's wrong matters

Tar paper appears in the appendix exactly **once**, and it is not a layer behind
the plaster:

> **§106.10.3 Steel mesh.** *"Steel mesh shall be galvanized, and shall be
> **separated from preservative-treated wood** by grade D paper, 15# roofing
> felt, or other approved barrier."*

That is a **galvanic-corrosion separator between steel mesh and the treated
sill plate** — a small strip at the bottom plate, nothing more.

**A membrane between straw and plaster is prohibited** (§105.6.1, quoted above),
and the reason given is *both* moisture transpiration *and* *"to secure a
structural bond between straw and plaster."* Running felt across the face of a
panel behind the plaster would destroy the SIP action in §2.3 and forfeit the
straw core's shear transfer between skins.

**And §106.10.4:** *"Required mesh shall be embedded in **middle third of the
plaster** excluding its finish coat, except where staples fasten the mesh to
horizontal boundary elements."* Tommy's fibermesh-in-the-base-coat practice is
the right placement — provided it ends up mid-thickness, not laid on the straw
and buried.

---

## 4. Pre-plastered panels vs site-plastered — the question he's really asking

> *"Difference of preplastered and seams done on site vs site plastered the
> whole thing with fibamesh embedded in it."*

**The literature does not answer this.** Bath says so in as many words:

> *"The bond and shear connection between the lime plaster coats and straw is
> key to performance and **remains subjects of further research**."*

Nothing in the 2003 tests, the Ash/Faurot program, the Bath walls or the code
appendix tested a wall assembled from pre-plastered pieces. Every tested
specimen was plastered in place as one continuous wall. **So there is no
measured value for the pre-plastered case, and the app must not imply there
is.**

But the code tells you precisely *which* requirement a pre-plastered panel
collides with, and it is not the plaster — **it is the mesh**:

> **§106.10.1 Mesh laps.** *"Mesh required by Table 106.16 shall run
> **continuous vertically from sill plate to the top plate** or roof or floor
> bearing element, **or shall lap not less than 8 inches**. Horizontal laps in
> such mesh shall be not less than 4 inches."*

This is the whole problem in one sentence. A pre-plastered panel's mesh **stops
at the panel edge**, buried in cured plaster. On site you can screw the panels
together perfectly and trowel the seam beautifully, and the shear skin is still
**discontinuous**, because:

- the mesh does not run sill-to-top-plate within the panel *and* across the joint;
- you cannot produce an 8 in lap into plaster that has already set;
- and §106.11's load path needs that mesh stapled to the plates — which means
  mesh reaching the plates, at 2 in o.c. on top and 4 in at the sill.

**Three ways out, in increasing order of defensibility:**

1. **Leave a mesh selvage.** Pre-plaster the field of the panel but hold the
   plaster back along both vertical edges and top and bottom, leaving bare mesh
   tails long enough for an 8 in lap onto the neighbour and to reach the plates
   for stapling. The seam plaster then encapsulates a properly lapped,
   properly stapled, continuous mesh. This is the only version that plausibly
   earns the table values, and it is a real change to the panel's edge detail.
2. **Second layer of mesh on site**, run continuous over the assembled wall
   and stapled to both plates, with the seams plastered over it. Costs a mesh
   layer and a plaster coat, but makes the shear skin unambiguously continuous
   and is exactly what footnote (f) already contemplates for tall walls.
3. **Don't claim the plaster's shear at all.** Treat the pre-plastered skin as
   finish and insulation, and carry 100% of the lateral load on the braced
   panels, the screws and the plywood that the app already engineers. Then the
   plaster is a bonus nobody is relying on.

**⚠ Option 3 is what the app currently does, and it is the honest default.**
The shear derivation sheet (B18) does not count plaster, and it should not
start counting it. What the research justifies adding is a **separate,
clearly-labelled, non-structural indicator** — Tommy's own framing: *"additional
sheer value indicators that most certainly do not need to be used/somewhat
separate calculation estimate."* That is the right shape. It says *"a
comparable site-plastered bale wall of this length would be good for roughly N
plf under IRC Appendix S Table 106.16 row C2; this is not your panel, your
panel is not pre-qualified for it, and nothing in this proposal relies on it."*

---

## 5. Items for the printable building guide

Tommy: *"proper techniques of how to execute... I want this app to be able to
fully explain how to do this for DIYers and contractors."* The research above
yields concrete, citable, checkable instructions:

- **Mesh laps:** 8 in vertical minimum on shear mesh, 4 in horizontal; 4 in on
  non-shear mesh. Continuous sill-to-plate preferred.
- **Mesh depth:** middle third of the plaster, excluding the finish coat.
- **Staples:** 16 ga × 1½ in legs × 7/16 crown pneumatic, or 15 ga × 7/8 in
  hand; stainless into treated wood, always; diagonal across intersections;
  2 in o.c. at the top plate, 4 in at the sill.
- **Felt:** only as a galvanic separator between steel mesh and treated wood.
  Never as a sheet between straw and plaster.
- **Binder:** NHL for structural lime plaster. Type S is a finish-grade choice.
- **Bottom edge:** continuous bearing. A weep screed alone is not support.
- **Mixed plasters:** clay inside + lime outside means the lime does all the
  work and you take 50% of its row.
- **Aspect ratio:** 50% knockdown at 2:1; interpolate.
- **Wind:** +40%.
- **Coatings:** oil paint will turn a breathing wall into a vapour barrier.
  Limewash and clay paint will not.

---

## Sources

- [Seismic Design Factors and Allowable Shears for Strawbale Wall Assemblies (Ecobuild Network, 26 Sep 2013)](https://ecobuildnetwork.org/wp-content/uploads/2024/12/Seismic-Design-Factors-and-Allowable-Shears-for-Strawbale-Wall-Assemblies.September.26.2013.pdf) — Table 7, Table 106.16, and the full proposed appendix text (§104.4.6, §105.6, §106.10–106.16)
- [John Straube, Moisture Properties of Plaster and Stucco for Strawbale Buildings (CMHC / EBNet)](https://tallerconco.org/wp-content/uploads/2017/05/Straube_Moisture_Tests.pdf) — Tables 2.3, 2.4, 4.1, 4.2
- [Structural Characteristics of Load Bearing Straw Bale Walls (University of Bath)](https://purehost.bath.ac.uk/ws/portalfiles/portal/218752081/Structural_Characteristics_of_Load_Bearing_Straw_Bale_Walls.pdf) — racking, out-of-plane and compression results, lime plaster
- [Structural Testing of Plasters for Straw Bale Construction (8 Dec 2003)](https://tallerconco.org/wp-content/uploads/2017/05/Plaster_tests.pdf) — earth and cement-lime plaster mixes, Type S lime finding
- [IRC Appendix S, Strawbale Construction (2018 IRC, ICC)](https://codes.iccsafe.org/content/IRC2018/appendix-s-strawbale-construction) — the adopted version of the appendix above
- [BSD-112: Building Science for Strawbale Buildings (Building Science Corporation)](https://buildingscience.com/documents/digests/bsd-112-building-science-for-strawbale-buildings) — corroborating permeance ranges
