# Screwed brace connections — the running note

**Started 2026-11-24.** Tommy: *"I will keep you updated on the screw discussion
with Larry. Please make a tidy note of anything regarding that subject."*

This is the one place the screw question lives. Add to it as Larry answers;
don't restate it in three files. Background: `K_Panel_Claude_Discussion-2026-11-23.odt`
(Larry's transcript) and `k-panel-implications-2026-11-23.md` (the full reading).

---

## Where it stands

**Tommy, 2026-11-24:** *"My interpretation of all of this screw talk is that
we're probably perfectly fine using screws for the connection."*

That is also what the app already builds to, and has since October. It is not a
new decision — it is the existing one, now checked against an engineer's attempt
to reach the opposite conclusion.

**Open, and it is the whole of what's open:** `Ceg` and `CΔ`. Both are taken as
**1.0** today and each is worth about a third of every brace-end number. See
"The two open factors" below.

---

## The detail this app specifies

Two **5/16 x 4in GRK RSS**, predrilled and driven, at each end of each diagonal.
Walls and roof alike.

> *"Each end of each 2x4 on the diagonals has 2 5/16in GRKs 4in screws
> **predrilled and driven**."* — Tommy, 2026-10-25

> *"Diagonal bracing ends should have a 4-in grk going through the inch and a
> half stud leaving 2 and 1/2 in of penetration into the bracing piece. This
> applies to both walls and roof."* — Tommy, 2026-11-20

**The geometry that makes it work.** A brace end is a true **plumb cut flush to
the stud's own face**. A screw driven **level through the stud** therefore
travels in the plane of the panel, enters that cut face, and runs **lengthwise**
into the brace. The depth available that way is the brace's 3½in width divided
by the sine of its slope — **over 5in** on a typical brace — not its 1½in
thickness.

**Penetration: 2.375in.** The 5/16 x 4in RSS is 3⅞in under the head, not 4in
(ESR-2442). Through a 1½in stud that leaves 2.375in. `6D = 6 × 0.276 = 1.656in`,
so it passes — and 2.375in is also *exactly* Table 3's minimum row for this
screw. ⚠ **It clears by nothing at all.** Any thickening of the side member, any
skin the screw has to cross, or a head left standing proud drops the connection
off the table and onto calculated values.

Code: `packages/calc-engine/src/fastenerCapacity.ts` (`BRACE_END_SCREWS`,
`BRACE_END_PENETRATION_IN`, `GRK_5_16_RSS`).

---

## Larry's three blockers, and which survive

Larry abandoned screws for 16 ga steel face plates and a connector nailer. His
analysis assumed the diagonal lies **flush in the frame plane**, so there is no
face to screw through. This product does not have that geometry.

| Larry's blocker | Against this app's detail |
|---|---|
| Inclined screws are outside ESR-2442's scope | The screw is driven **level, perpendicular to the stud's face**. In scope. |
| 5/16 RSS fails the 6D minimum — needs 1.656in, has 1.5in | Penetration is **2.375in**, because the screw runs lengthwise into the brace through its plumb-cut face. **It passes.** |
| Flush members leave no face to screw through | The stud's face **is** the face. No lap needed, so nothing overlaps either. |
| Screws crowd at the corner and split the diagonal | ⚠ **Still live, and it is now his headline reason.** |

**On the last one, do not over-claim.** Larry's crowding is a property of his
`>` K's topology — two diagonals landing on one chord at mid-height, and corner
joints where a diagonal meets a chord and a plate. Nothing above makes it go
away. What the detail above refutes is *"there is no face to screw through"* and
*"5/16 cannot reach 6D"*, which is what sent him to steel.

**Predrilling is the lever on crowding**, and it is already the shop note.
Splitting is what drives the large self-drilled spacing and end distances; a
lead hole removes the wedging that splits. His own write-up says it in passing —
*"predrilling relaxes the edge distances if you need it"* — and then moves on.

---

## The two open factors

Both on the Shear Derivation sheet's Inputs block, both `pending-BI-confirmation`
since 2026-11-24, both taken as **1.0**.

**1. `Ceg` — end grain.** NDS 12.5.2 puts it at **0.67** for a dowel driven into
end grain. This screw enters a cut face and runs *lengthwise* into the brace,
which is close to the geometry the factor exists for. **At 0.67 every brace-end
capacity in this app is about a third too high** — and there is no margin,
because the penetration clears Table 3 by nothing.

**2. `CΔ` — geometry.** Justified here as *"spacings far above Table 5's
minimums"*, which holds for a brace landing on a stud and a plate. Larry reports
the opposite where it matters:

> *"the screws end up spaced too closely together at the corners where the
> braces come together. This would probably split the diagonal braces."*

**Each is one sentence from the engineer of record. Neither needs a test
programme.** Both are checkable against the NDS and ESR-2442 today. These are
the first two questions in the drafted message.

**Deliberately not changed.** Moving either to 0.67 on my own reading would cut
the app's capacity by a third on an argument no engineer has made.

---

## The third question, and it is his to answer

**Does ESR-2442 permit predrilling for the RSS line?** Its published values are
tied to the as-tested self-drilled installation. If predrilling falls outside
the report, the connection leaves Table 3 and is designed as an NDS Chapter 12
dowel-type connection instead — which this app is **already equipped for**:
`ndsYieldLimitZ` recomputes the same connection from first principles using only
`Dr` and `Fyb`, and was built as the conservative cross-reference for an
engineer who declines test-based values. It would simply become the primary
route. Larry has the report; we don't.

---

## Two catches in Larry's own numbers

- **3 panels vs 4.** He wrote *"3 or 4 such panels would be needed within a
  typical one story wall."* At 4, the four 5/16 screws into the LVL top plate
  are about **225 lb each** and fine. At 3 they are about **300 lb against
  roughly 290 lb of capacity** — over. A three-panel wall wants a fifth screw,
  or a rule of at least four K panels per 40ft wall. He quoted "3 or 4" without
  flagging it.
- **Plates on both faces — ~~ambiguous~~ ANSWERED, and the answer is no.**
  *"need to go on the inside as well as the outside of the K-panel."* Either
  (a) both frames' outer faces, which is what his transcript drew — 6 plates,
  88 nails per panel; or (b) both faces of every joint — **12 plates, ~176
  nails**. (b) resolves the one-sided ⅜in eccentricity his own write-up flags.
  **It is refused on manufacturing grounds — see below.**

⚠ **Build nothing from the plate detail.** He said *"I am still not happy with
the results"* twice. It is a working hypothesis its own author is dissatisfied
with.

---

## ⚠ NOTHING GOES ON THE STRAW SIDE — the constraint that settles it

**Tommy, 2026-11-24:**

> *"I think he was wanting to put steel plates on each side of the brace
> member, one of which right next to the straw — which I do not want to design
> like that, because I can't really compress straw into the frame if the
> pieces are there."*

**This is not a preference; it is the fabrication sequence this app has
modelled from the start, and Larry's two-sided detail contradicts it.** Three
places already say so in the repo:

- `panelRecipe.ts`, quoting him 2026-10-25: *"The diagonals for each panel are
  added after it comes out of the compression table via panel surgery."* —
  *"A member added after pressing IS a composition. The panel leaves the table
  as a plain box and then gets routed and fitted."*
- The same file on HOW: *"Inside the panels depth — the straw router bit'ed
  out a little groove for a wooden member to sit where straw was."*
- `data.ts`, the Braced Panel's own description: *"diagonal bracing carved
  into the finished compressed panel afterward."*

**So the order is: fill, compress, then route and fit.** Anything on the
EXTERIOR face can be let into a routed groove after pressing, which is what
every brace in this app already is. Anything on the **straw side of the
interior frame** has to be there *before* the straw is, and then there is no
way to pack the cavity around it — Tommy's sentence exactly. You cannot route
to it from outside either; the groove would have to go clean through the
panel.

⚠ **So option (b) is dead, and the one-sided eccentricity Larry's write-up
flags stays unresolved by that route.** If plates come back at all they are
6, not 12, and the eccentricity needs a different answer. Worth telling him
in these terms rather than as a preference: it is the compression table that
refuses it, not the drawing.

⚠ **AND IT IS A GENERAL RULE WORTH STATING ONCE:** a part this app can add to
a braced panel must be reachable from a face after pressing. That is already
true of every brace, tie and nailer modelled today. **It has not been written
down anywhere as a rule, and it should be** — it is the thing that makes
"panel surgery" a real constraint rather than a description.

⚠ **One existing part to check against it.** The chevron's
`brace_center_connector` stands on edge — 1½in across the face but **3½in
into the cavity**, where the braces it joins are 1½in. It is still reachable
from the exterior face, so it does not break the rule, but it asks for a
groove more than twice as deep as any other surgery member. **Is that routable
in practice?** If not, the connector wants to lie flat like everything else.
Nobody has been asked.

---

## The largest uncertainty is not the connection

Larry's note that the **straw may brace the diagonal against buckling through
its thickness** takes the compression capacity from about **980 lb to about
4,700 lb** — a 4.8× swing, larger than the connection choice.

**This app sits at the conservative end of it, explicitly.** The Shear
Derivation sheet says each brace is a pin-ended strut buckling about its 1½in
dimension *"because nothing restrains it out of the wall's plane"* — i.e. the
straw is credited with nothing. If a racking test moves that, every number on
that sheet moves with it, and it may change which connection is needed at all:
at 980 lb a three-panel wall is marginal; at 4,700 it is not close.

---

## Log

- **2026-11-23** — Larry's transcript added to the repo (`c738ee7`), read against
  the app (`59cb420`). Message drafted: `message-to-larry-2026-11-23.md`.
- **2026-11-24** — Tommy: screws are probably fine. `Ceg` and `CΔ` split out of
  the `CD` note into their own flagged rows so the Shear Derivation sheet carries
  the question to whoever reads it. Nothing numeric changed.
- **2026-11-24, later** — Sheet sent; **Larry read it.** No answer yet on
  `Ceg`/`CΔ`. Tommy ruled out the straw-side plate on compression grounds —
  see the section above. Note-passing stays as it is for now; connecting
  Larry's own Claude to this repo is **undecided**, not declined.
- *(next: Larry's answers on `Ceg`, `CΔ`, and ESR-2442 on predrilling)*
