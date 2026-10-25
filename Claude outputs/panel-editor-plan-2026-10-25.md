# Panel Editor, panel library, and where bracing goes — plan

Written 2026-10-25, after he answered the thirteen bracing questions and
proposed the editor:

> *"Oooo!!! Perhaps!!!! There could be a Panel Editor! Where users can create
> their own panels, name them, and use them as a library for designing with."*

---

## 1. What I think of it: it is the right idea, and the app is closer to it than it looks

Today every panel kind is a **bespoke builder**: `buildStandardPanelMembers`,
`buildBracedPanelMembers`, `buildColumnPanelMembers`, and a dozen more. Adding
a brace pattern means writing another builder. Adding "one more stud here
because an engineer asked" is impossible without code.

But every one of those builders returns the same thing — `PanelMember[]` — and
the whole app downstream already consumes only that. The cut list, the weight
checker, the 3D view, the OBJ exporter, the fabrication sheet, the overlap
check: none of them know what KIND of panel they are looking at. They read
members.

⚠ **So the data model for a panel editor already exists and is already proven.
What is missing is composition and storage, not geometry.** A panel becomes:

```
base panel (standard, at a width/height/depth)
  + a list of added members
  = a named panel in a library
```

and a "pattern" is just a function that generates added members. That is a far
smaller change than it sounds, and it collapses several scattered things —
brace patterns, the nailer, extra studs, the gable's sloped top — into one
mechanism.

**His "panel surgery" is the physical fact that makes it work.**

> *"The diagonals for each panel are added after it comes out of the
> compression table via panel surgery."*

Members added after pressing are added to a finished panel. That is exactly
what composition means, and it is why this is not a hack: the model matches
how the panel is actually built.

---

## 2. What panel surgery settles, and the one thing it raises

**Settles — the pair problem.** The X is *"4 smaller pieces, each one leg of
the x, on two different panels"*. So nothing crosses a seam as one board, and
a pattern spanning a pair is just two panels each carrying their own legs.
That is why storing the pattern **on the panel** (his answer to Q8) works
rather than being a compromise.

**Settles — fasteners.** *"Each end of each 2x4 on the diagonals has 2 5/16"
GRK 4" screws predrilled and driven."* Two per end, two ends, so four per leg,
sixteen per SuperBrace pair. `computeFastenerWeight` already walks members, so
these count automatically once they are members.

**Settles — cut length.** *"For 2x4 length counts just count the longest tips'
length."* The trapezoid's long edge is the cut, which is what the shop cuts to
anyway.

**⚠ Raises — are added members INSIDE the panel or ON its face?** Measured
today, the braced panel's diagonals sit inside the depth, flush with each face
(y 0–1.5 and 14–15.5 on a 15.5 panel). A member screwed to a pressed panel
sits PROUD of the face instead. The difference is 1.5in of built wall
thickness per face, it decides whether plaster goes over or around the braces,
and it decides whether these members can collide with anything internal.

**This same question answers a live bug.** The optional nailer is modelled
inside the depth, and measurement shows the whole 90in of it sits inside the
centre nailer stud a 4ft panel now carries, with another 1.5in inside the
bottom plate. Put it on the face and both clear at once. I tried suppressing
the nailer where the stud already is and reverted it: silently dropping a
member somebody asked for is worse than the overlap.

---

## 3. The shape of the work, in the order it should happen

**Stage 1 — composition.** A `PanelRecipe`: a base + an ordered list of added
members, each with enough to rebuild it (kind, position, size, rotation).
`buildFromRecipe(recipe)` returns `PanelMember[]`. Every existing builder
stays exactly as it is; this sits beside them.

**Stage 2 — patterns as recipes.** SuperBrace, Braced, Nailer expressed as
functions from (panel width, height, which half of the pair) to added members.
⚠ Default SuperBrace, per his answer. The existing `computeBraceBoardCornersIn`
and the 2026-10-13 cut-note jig work carry straight over — they are about
cutting one trapezoidal board, which is still exactly what each leg is.

**Stage 3 — pattern overlay on a wall.** Walk a wall's panels from the least
accessible end (his answer to Q6), pairing as it goes, applying the chosen
pattern until it runs out; the odd panel at the end takes whatever a half-pair
means. Per wall, never round a corner (Q7).

**Stage 4 — the editor UI, in the 2D elevation view.** He has said twice this
is where it belongs, and that the diagonals should be visible there. Pick a
panel, add or remove members, name it, save it.

**Stage 5 — the library.** Named recipes, stored with the project, reusable
across projects. ⚠ This is the stage with a real backend question: a library
that only lives in one project file is barely a library.

**Stage 6 — the follow-through he asked to have included.** Cut lists and
totals (automatic once members exist), the fabrication sheet's "exact copies
grouped together" promise, and the overlap check.

---

## 4. ⚠ Three things that will bite, called out now

**Grouping.** The fabrication sheet promises one sheet per unique panel with
exact copies grouped. Two panels of equal width carrying different halves of a
pattern are no longer copies. The grouping key has to include the recipe.

**The overlap check cannot currently see any of this.** Braced, gable and big
header panels are excluded from it today because an axis-aligned box around a
diagonal claims space the diagonal does not fill. Diagonals are about to go
from a special case to the common case. ⚠ Real oriented-box intersection
should be built BEFORE the editor lets people add arbitrary diagonals, not
after — otherwise the app's one guarantee against unbuildable geometry quietly
stops covering most panels.

**Migration.** Existing projects carry `bracedPattern`/`bracedMirrored` on
slots. Those can map to recipes mechanically, but the saved-file version
bumps, and the tile-once editing model means a project's panels are already
individually edited.

---

## 5. What I would do first

Stage 1 and Stage 2, behind no UI at all — composition plus the three patterns
as recipes, tested against the existing braced panel so the new path provably
reproduces the old geometry before anything switches to it. That is the piece
everything else needs and the piece that can be proven correct without
designing a single screen.

⚠ But if the roof work is still the priority, this waits — with the caveat
already recorded: every day the roof builds on per-panel bracing assumptions
is more to unpick.

---

# Progress, 2026-10-25

**Stages 1 and 2 are built** (`panelRecipe.ts`, `bracePairPatterns.ts`, 35
tests). No UI. A recipe with nothing added is member-for-member identical to
`buildStandardPanelMembers`, which is the guarantee everything else rests on.

**The face-vs-inside question is ANSWERED** — *"Inside the panels depth - the
straw router bit'ed out a little groove for a wooden member to sit where straw
was."* So today's geometry was right all along and my face-mounting idea was
wrong. ⚠ **That also means the nailer collision is NOT solved by moving it to
the face.** The whole 90in of the nailer still sits inside the centre nailer
stud on a 4ft panel, and it still needs an answer of its own.

**Corrected along the way:** brace screws were counted as 6in; his spec is
**4in**, two at each end. Count was right, length was not.

---

## Still to do, in order

3. **Pattern overlay on a wall** — pair from the least accessible end, per
   wall, never round a corner.
4. **Oriented-box overlap check** — ⚠ still gating stage 5, and now more
   urgently: the recipe path makes diagonals ordinary.
5. **Editor UI in the 2D elevation view**, with the diagonals drawn.
6. **Library + storage.**
7. **Follow-through:** fabrication grouping must key on the recipe, migration
   of existing `bracedPattern`/`bracedMirrored` slots.

---

# Also queued, 2026-10-25

**Seed Collaborate membrane + furring strips + siding.**

> *"We will eventually need an option for Seed Collaborate labeled Membrane
> from 475 Mento wrap and model furring strips and siding options."*

Belongs with the Membranes tab (to be renamed **Install**), beside the
sleepers/decking/roof-material work already queued there. What it needs:

- The membrane as a selectable product in the wall assembly layer list, where
  Intello, Exto Seal and Tescon Vana already live with their coverage rules.
  ⚠ 475's SOLITEX MENTO under a Seed Collaborate label — confirm the exact
  product and whether its perm rating and coverage rule differ from the
  Pro Clima original, because the assembly's vapour check reads that number.
- **Furring strips** modelled as real members, which the existing member
  pipeline will then count, weigh and draw for free.
- **Siding options** — ⚠ an open list, and the one place this could balloon.
  Worth pinning down how many he actually wants before building a catalogue.
