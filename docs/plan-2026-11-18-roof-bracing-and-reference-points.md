# Roof bracing, full-plane patterns, and the Reference Points page

**2026-11-18.** This supersedes sections 5 and 6 (*The plan* and *What I need
from him*) of `Claude outputs/roof-bracing-instead-of-sheathing-2026-11-18.md`.
Sections 0–4 of that document — the measured facts, the research and the two
geometry findings — still stand and are not repeated here.

Six decisions arrived at once. Four of them change the plan, one adds a phase,
and one is a long-term direction to write down rather than build.

---

## His decisions, verbatim

1. **Go.** *"if this can work for 2, 3 and 4' roof panels lets freakin do it."*
2. **A Reference Points page.** *"there should be some good effort put into
   prepping all of this in a nice tidy Reference Points page or something like
   that where a summary of all the connections are shown and shown how theyre
   derrived."*
3. **The fastener schedule, and spacing as an OUTPUT.** *"typically we are doing
   every 16" of 5/16" 4" grk structural screws on the outside of the panel and
   2' on the inside. if we could spec the calculations of all this and suggest
   adequate spacing measures for each side based on required loads to handle
   that would be awesome."*
4. **The assembly.** *"this replaces structural sheathing above... structurally
   braced straw sip, mento, furring strips, metal roof. there is also
   interestingly no need for soffits too because you can just wrap around the
   corner monopoly house style and have you roof vent draw from the bottom of
   the wall rainscreen."*
5. **Full-plane patterns.** *"this is going to sound crazy... want to do full
   plane patterns. like there should definetely be one big x, the individual
   pieces of which are throughout all of the different panels on that plane.
   and then on each of the spaces around the x there could be a carrot < of
   some more bracing."* And, separately: *"i imagine the diagonal roof bracing
   would basically be 4 diagonals per roof panel on just the exterior face."*
6. **No engineer, and the app's job.** *"no there has definetely not been any
   engioneer that has looked at this. this app shouldnt be that and i cant
   believe thats even a possibility. but this app should prime an engioneer to
   look at and make it really easy for them to do the calculations and see how
   the estimated values here were derrived."*

---

## Three findings that change the shape of the work

### A. The Reference Points page is a GENERALISATION of a sheet that already exists

`packages/calc-engine/src/shearDerivation.ts` — the Shear Derivation sheet,
B18, 2026-11-02 — was built on the rule he has just restated. His words then:

> *"Id rather have a pattern be described to an engineer with estimated values
> rather than prescribe an engineer seismic zone thing."*

His words now: *"this app should prime an engioneer... and see how the estimated
values here were derrived."* **Same rule, a second time, nine strides apart.**
So this is not a new principle to invent — it is an existing module to widen
from braces to connections.

It already carries the exact vocabulary the new page needs. `DerivationInputStatus`
has four values, and every number on the Reference Points page can take one:

| status | means |
|---|---|
| `code-constant` | the code specifies it outright; not a choice |
| `pending-BI-confirmation` | a published figure BI has not yet confirmed |
| `app-assumption` | a simplification this app makes, named not hidden |
| `from-the-drawing` | measured off the building that was drawn |

⚠ **And it carries the refusal that must survive onto the new page.** The shear
sheet names no seismic zone, deliberately, because a rating is capacity against
DEMAND and this app has no demand numbers. The Reference Points page inherits
that: it may state **what crosses each connection** and **what a given spacing
resists**, and it may not state that a building passes.

### B. His two fastener numbers are already in the app — and are shown nowhere

`packages/panel-catalog/src/data.ts:1464`, `fastenerSpacingTable`, has carried
eight connections for a long time. Two of its rows are, word for word, the
schedule he has just quoted from memory:

```
Panel to panel, exterior | GRK 5/16"x4" star drive washer head | 16" o.c., staggered
Panel to panel, interior | GRK 5/16"x4" star drive washer head | 24" o.c., staggered "stitching"/zipper pattern
```

Two consequences.

⚠ **The exterior row's status should change, and his sentence is why.** Its note
reads *"Building Integrity's resolved value — NFW's own two source docs
conflicted at 6" vs 18"."* The whole table is `pending-BI-confirmation` on the
grounds that it is *"NFW reference points"*. He is Building Integrity, he has
now stated both numbers first-hand and unhedged, and that is the standard the
flags convention sets for `confirmed`. **Two of eight rows move; six do not.**

⚠ **The table is rendered for the FOUNDATION only.** `foundationFastenerSchedule`
is its one consumer. The panel-to-panel rows — the connections that actually
hold the building up — have never appeared on a screen or a sheet. That is the
hole the Reference Points page fills, and it is bigger than the roof.

⚠ **There is no roof row at all.** Not roof-panel-to-roof-panel, not
roof-panel-to-wall, not ridge. Eight connections and the roof is not among them.

### C. ⚠ A full-plane X is NOT what the walls do, and the difference is the seams

This is the finding that matters most, because it looks like reuse and is not.

`applyWallBracingPattern` is a **pair** mechanism. The Carrot Pattern's X spans
**exactly two panels**, and the module says why in its own words: *"every leg of
an X runs to the seam the two panels share, and panels separated by a third thing
share no seam."* A wall gets many small Xs, each two panels wide, each crossing
**one** seam.

What he is asking for is one X across the whole plane. On a roof plane twelve
panels wide, that X crosses **eleven seams**, and a diagonal is only as strong
as the weakest seam it crosses. The research already found that the joint
governs rather than the skin; a plane-wide pattern multiplies the number of
joints in the load path by an order of magnitude.

**This is not a reason to refuse it.** It is the reason his decision 3 and his
decision 5 are the same feature: a plane-wide diagonal is exactly what creates
the need for a per-seam force number, and *"suggest adequate spacing measures
for each side based on required loads"* is exactly the answer to it. Build the
pattern he asked for; make the page state, per seam, what crosses it and what
spacing that needs. The 16"/24" schedule becomes the **default and the check**,
not the whole answer.

### And his two pattern statements agree — they are not competing specs

His *"one big x... and then on each of the spaces around the x... a carrot"* and
his *"4 diagonals per roof panel"* describe the same thing from two ends.

A roof plane is W wide along the eave and L long up the slope; panels take ~24in
of W each and run the full L. A plane diagonal from `(0,0)` to `(W,L)` crosses
each panel's 24in band exactly once, so **the big X puts two segments in every
panel**. The X divides the plane into four regions, and a carrot in the region
covering a given panel adds **about two more**. Four per panel is his own
pattern's output, predicted correctly.

⚠ **One rule the plane-wide X needs that a pair-wide X does not: a proportion
limit.** On a 40ft-wide plane with a 12ft slope run, the plane diagonal sits at
17° off the eave — nearly along it, which section 2 of the research document
already identified as the useless direction. So the X cannot always be one
plane-spanning figure. Beyond some aspect ratio the plane is divided into bays
and each bay gets its own X. **That threshold is a building decision and is on
the question list below.**

---

## The five phases, revised

Order changed. His *"good effort... prepping all of this"* and *"prime an
engineer"* put the **page before the member** — the opposite of the research
plan, which had the paperwork at stride 2 and the joint at stride 5. Building
the diagonals first would mean adding an unmeasured lateral system to the app
and *then* writing the document that says how it was derived. The page first
means the derivation exists before anything leans on it.

### Phase 1 — The Reference Points page

Every connection the app knows about, on one page, each with its fastener, its
spacing, the load it is assumed to carry, and the provenance tag from finding A.
No roof bracing in it yet; this is the frame.

- Widen `shearDerivation.ts`'s four-status vocabulary into a shared
  `derivation` concern the new page and the existing sheet both read.
- Surface all eight `fastenerSpacingTable` rows, not just the foundation's.
- Move the two panel-to-panel rows to `confirmed` on his statement, and say in
  the note that it was his statement that moved them.
- ⚠ Name the roof's absence on the page rather than leaving a reader to notice.
- The page prints and exports with the rest of the packet.

**This phase is worth having even if the bracing never gets built**, which is
why it is first.

### Phase 2 — Spacing derived from load, not just quoted

Turn the schedule from a table into a calculation whose default output is that
table. Per connection: the force crossing it, the capacity of one GRK
5/16"×4" in the relevant mode, the count that needs, and the spacing that count
implies over the connection's length — with his 16" exterior / 24" interior
shown beside it as the stated schedule, and a flag when the derivation asks for
tighter.

⚠ **Single-fastener capacity is a published value this app does not have yet**
and must not invent. It is on the question list.

### Phase 3 — The full-plane pattern

The geometry he asked for: one X per plane (or per bay, above the proportion
limit), carrots in the regions, sliced at panel boundaries, **exterior face
only**, 2x4 flat.

- New plane-level pass; it is not `applyWallBracingPattern` widened, for
  finding C's reason.
- A segment lands in whatever panel its band falls in, including a 12in tail.
- ⚠ Lands in the bays the anti-twist girt webs occupy — the overlap audit will
  fire, and the ring-girt cut-and-tie pass (B32) is the precedent for resolving
  it.
- Must work at 2ft, 3ft and 4ft, which is his explicit condition; the app's
  actual deck panel range is **12in to 48in**, so the sweep runs the full range
  and not just his three.

### Phase 4 — Capacity, the seams, and the refusal

The diagonals get a shear number by the same NDS path the wall braces use, and
the page gains the per-seam statement finding C calls for: how much of the
plane's diagonal force crosses each panel-to-panel seam, and what spacing that
needs there.

⚠ **And it must be able to refuse.** A plane whose proportions make the pattern
useless, or whose seam count puts more force through a joint than the schedule
carries, says so out loud — the Review Log is where the app already does this.

### Phase 5 — The assembly it frees

His decision 4, in the app's own layer model: **structurally braced straw SIP →
Mento → furring strips → metal roof.** The structural sheathing above the
vented gap comes out.

- `wallAssemblyLayers` has the permeability model; the roof needs the same.
- ⚠ **No soffit, and the vent path is the interesting part**: wrap the corner
  *"monopoly house style"* so the roof vent draws from the bottom of the wall
  rainscreen. That makes the wall's rainscreen and the roof's vent gap **one
  continuous cavity**, which is an assembly the app currently models as two
  unrelated layer stacks.
- ⚠ **It does not change the price.** One flat rate is $25/sq ft for everything;
  deleting a layer changes what the shop buys, not what the client pays.

---

## Long term, written down because he asked for it

> *"put down in a plan document somewhere that id like to long term build this
> app into populating literally the entire house's material lists such as
> siding and roof ect. and of course plaster as it is already."* — 2026-11-18

**The target: the app emits the whole house's material list, not just the
panels.** Plaster Master already does this for one trade. Siding, roofing,
membranes, furring, flashing, fasteners and finishes would each be the same
shape of thing: a layer with a coverage rule, a unit, a waste factor and a
price, driven off surface areas the app already computes.

Three things make this a direction rather than a phase:

- ⚠ Every trade added is a new set of real-world costs, and the shop-item table
  that was **13× too high and reached main** (2026-11-15) is the standing
  warning about what that costs to get wrong.
- The flat $25/sq ft covers the panel. A siding list is either inside that
  number or it is a second price, and that is his decision, not a modelling one.
- Phase 5 above is the first instance of it — a roof assembly with real layers —
  so this direction starts getting built as a side effect of this item rather
  than as a project of its own.

---

## Where this sits in the queue

Answered in full in the reply this plan accompanies. The short version: **the
queue has nothing in front of it.** Section C of `queue-2026-11-05-status.md`
is items 1–16, all done; section D is small non-blocking interviews. The only
scheduled work is the external readiness assessment (December) and hardening
(January, hardened off by 1 February 2027), and this belongs **before** the
assessment rather than after it, because an assessment run before this is built
assesses a different app.

---

## ⚠ What is still only his to answer

The research document's four questions are now down to three, and one is new.

1. **ANSWERED** — ~~which layer this replaces~~. The structural sheathing above
   the vented gap. His decision 4.
2. **ANSWERED** — ~~every panel or braced bays~~, and ~~how many diagonals~~.
   Every panel on the plane, four per panel, exterior face only, from one
   plane-wide X plus carrots. His decision 5.
3. **ANSWERED, in the direction of "no"** — ~~is there an engineer~~. *"no there
   has definetely not been any engioneer that has looked at this... this app
   shouldnt be that."* So nothing in this build may state that a roof passes.
   What it states is what was drawn, in the units an engineer's own demand
   calculation is already in. That is phase 1's whole job.
4. ✅ **ANSWERED 2026-11-20 — the proportion limit.** *"i like keeping angles
   between 30 and 45 degrees where possible."*

   A BAND, not the single threshold this question anticipated, and **"where
   possible" is load-bearing** — it makes this a preference with a tolerance
   rather than a refusal. The geometry: a plane W wide along the ridge and H up
   the slope, split into n bays, has a diagonal at `atan(n·H/W)`. **More bays
   means a STEEPER diagonal**, which is the whole lever — there is no way to
   make a diagonal shallower except by using fewer, wider bays.

   So the rule is: take the smallest n whose angle reaches 30° (the flattest
   option inside the band); if that angle also sits at or under 45°, it is the
   answer.

   ⚠ **AND THE BAND IS NOT ALWAYS REACHABLE, which this answer has to survive.**
   Bay count is an integer, so the angle jumps, and two cases miss:

   - **A plane too tall and narrow for any of it.** A 12ft-wide gable end at a
     14.4ft slope is **50.2° at one X**, and adding bays only steepens it.
     Nothing can bring it into the band; his *"where possible"* is exactly this
     case, and the app must accept it and say so.
   - **A plane that STRADDLES the band.** A 24x24 at a 4ft rise is **27.8° with
     one X and 46.5° with two** — no integer bay count lands between 30 and 45.

   Therefore: prefer an n inside the band; when none exists, take the n nearest
   to it and **name the miss in the Review Log**, with the angle it settled for
   and the angle one bay either side would have given. A preference the app
   silently failed to honour would be worse than one it never had.

   Measured against real templates: The Tank (48ft plane) wants **3 bays at
   38.3°**, the Multiplex **2 bays at 37.1°**, a 60ft shed **3 bays at 40.0°**,
   and a 16ft Tiny House **1 bay at 38.3°** — four of six inside the band on his
   first statement of it.
5. ✅ **ANSWERED 2026-11-19 — single-fastener capacity.** *"can you find a
   number? ... anything this app produces is an estimate because im not really
   sure how to make it official or have the liability for it."* It entered as
   `pending-BI-confirmation` with its source cited, exactly as this item
   anticipated. **ICC-ES ESR-2442** (reissued Oct 2025, revised Mar 2026 — note
   the copy GRK hosts is the lapsed Oct 2023 reissue), in
   `packages/calc-engine/src/fastenerCapacity.ts`:
   - **884 lbf** allowable steel shear, Table 1. A flat ceiling, never × C<sub>D</sub>.
   - **Z = 239/236 lbf** (SG 0.42–0.50), 333/236 (0.50–0.55), 333/257
     (0.55–0.67), Table 3, for a 1½" side member and 2⅜" penetration. ¾" side
     member (a jack sheet) is the lower row: 168/133 · 168/133 · 214/178.
   - **§4.1.5**: the allowable is the LESSER of the two. C<sub>D</sub> = 1.6 for
     wind/seismic multiplies the wood value only.
   - **Cross-referenced**, as he asked: `ndsYieldLimitZ` recomputes the same
     connection through the NDS 12.3 yield-limit equations using nothing from
     Table 3, and lands **1.3–1.8× LOWER** — which is what §4.1.4 says must
     happen, since Table 3 is test-based. The calculated route is the
     conservative floor and the only one that answers where Table 3 refuses.
   - ⚠ **§4.3 excludes the PRESCRIPTIVE route for braced walls** (*"outside the
     scope of this report"*) but not the engineered one. **Phase 4 must never
     cite Table 4 for a braced wall.**
   - ⚠ **It immediately refused the brace end.** Table 3 needs 2⅜" of
     penetration; a brace lies flat on a 1½" member with ¾" of skin behind it.
     Through the calculated route that is **133 lbf a screw, ≈267 lbf a brace
     end, against a measured median 3,064 lbf strut — the ends are ~11½×
     smaller.** Not a check, not a verdict; both are capacities.

   **What phase 2 still does NOT have is the other half: DEMAND.** A spacing
   derived from a load needs a load, and this app has no wind or seismic
   demand figures — the same hole the Shear Derivation sheet refuses to paper
   over. Phase 2 can now state a per-screw and per-foot CAPACITY for any
   spacing, and compare spacings to each other; it cannot say a spacing is
   adequate.
6. **OPEN, small — the continuous cavity.** Wall rainscreen and roof vent as one
   path is an assembly decision with a detail at the corner. Phase 5 can model
   the layers without it; it cannot draw the corner without it.
