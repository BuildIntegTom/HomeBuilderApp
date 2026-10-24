# Bracing schemas — queued for interview, 2026-10-24

> *"Here's a pic of the bracing pattern I'm thinking about of how to
> replace/rework the current Chevron/braced panels with more of a pattern
> overlay rather than individually cycling panels. This needs some more
> planning out, so let's add interview me about bracing schemas and
> implementation and the follow through of all that into the queue"*

Nothing built. This is the record of what the sketch shows and what has to be
asked before anything is.

---

## What the sketch shows

Three named kinds, each drawn as a **pair of panels**, left to right:

| | |
|---|---|
| **SuperBrace Pair** | a full X across the pair, plus diagonals returning to the outer top and bottom corners — the densest |
| **Braced Pair** | a single long diagonal across the pair with a horizontal member at mid-height |
| **Nailer Pair** | verticals only, no diagonal |

and at the far left, drawn separately and dimensioned:

> **Corner/Edge — 15.5" x 15.5"**

⚠ The same 15.5in square he gave for the column panel on the same day. So the
corner/edge panel, the column panel and the wall thickness are all one number,
which is worth confirming is deliberate rather than three coincidences.

---

## ⚠ The change this actually is

Today bracing is a **panel TYPE**: a slot is "braced", it carries a chevron or
a hatch pattern, and you cycle an individual panel through the options. The
brace geometry lives inside one panel and stops at its edges.

The sketch is a **pattern spanning a PAIR of panels** — the X crosses the seam
between them. That is not a different pattern inside the existing model; it is
a different model. A brace that crosses a seam belongs to the WALL, not to a
panel, and each panel then carries whatever part of it falls inside its own
width.

Consequences worth naming up front, because they decide the shape of the work:

1. **Panel identity stops being enough.** Two panels of equal width are no
   longer interchangeable if they carry different halves of a brace, so the
   fabrication grouping — "one sheet per unique panel, exact copies grouped"
   — has to key on the brace fragment too.
2. **Re-tiling gets harder.** Change a wall's length and the pairs re-pair.
   Under the tile-once editing model, what happens to a brace pattern when a
   panel between its two halves is dragged?
3. **Pairs need an anchor.** A wall with an odd number of panels cannot be all
   pairs. Something has to decide where pairing starts and what the leftover
   gets.
4. **The existing brace geometry survives.** `computeBraceBoardCornersIn` and
   the cut-note jig work (2026-10-13: the shop builds a reversed triangle jig
   from the missing triangle) are about cutting one trapezoidal board. That is
   still exactly what each fragment needs. The machinery is reusable; what
   changes is who decides the angles.

---

## Questions to put to him

**On the patterns themselves**
1. Are SuperBrace / Braced / Nailer the complete set, or a sample?
2. Does the X in SuperBrace cross the seam as one continuous board, or is it
   two boards meeting at the seam? (Fabrication-wise these are very different:
   a continuous board cannot be pressed into two separate panels.)
3. The Braced Pair's horizontal member at mid-height — is that the existing
   girt, or an additional member?
4. Nailer Pair looks like verticals only. Is that the plain standard panel
   under a new name, or does it carry something extra?

**On placement**
5. What decides which pair gets which pattern — the user, or a rule about
   wall length, openings, or seismic?
6. Where does pairing start on a wall, and what does an odd panel out get?
7. Do pairs ever straddle a corner, or do they always stay within one wall?

**On the model**
8. Should a pattern be stored on the WALL (and panels derive their fragments),
   or on each panel (and the pair is only a drawing convention)? The first is
   truer to the sketch; the second is a far smaller change.
9. What happens to an existing project's chevron/hatch panels — migrate them
   to the nearest pair pattern, or leave them as a legacy type?

**On the follow-through** — the part he asked to be included
10. Cut lists and material totals: each fragment is its own trapezoid, so the
    counts change. Fastener counts too.
11. The 3D view and the elevation views both draw braces today from the
    per-panel geometry.
12. The shop fabrication sheet's "exact copies grouped together" promise —
    see consequence 1 above.
13. The overlap rule: braced panels are currently **unchecked** for member
    overlap because their diagonal members need real oriented-box
    intersection. A pattern spanning a seam makes that worse, not better, and
    this is the moment to decide whether to build that check properly.

---

## Where this sits in the queue

Behind the roof-layout work being interviewed on the same day (auto gable
ends, shed-vs-peaked, roof catcher beam, column panels to the foundation),
because that is the one blocking the 3D view he is looking at now.

⚠ Not behind it forever, though: question 8 decides whether bracing is a panel
property or a wall property, and the longer the roof work builds on the
current per-panel assumption, the more there is to unpick.
