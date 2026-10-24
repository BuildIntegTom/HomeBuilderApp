# Hip panels for the octagon ring — design research

Asked for on 2026-10-23: *"The design of the hips... I need your help researching
on that. We should give hips a nice surface area to land on, not a sharp
triangle but more of a trapezoid. Ideally thre would be two halves so that one
half is parrelel while building it in the table press and blocked on the other
side with an inverted carpentry block."*

Nothing below is built yet. This is the study, the numbers, and a
recommendation to argue with.

---

## 1. How big the hips actually are

Measured off `ringRoofPlanes` on real octagon rings, not estimated:

| Octagon (flat-to-flat) | Ring width | Facet inner edge | Facet outer edge | Span | **Wedge base, each end** | Rake |
|---|---|---|---|---|---|---|
| 40ft | 12ft | 79½" | 198¾" | 144" | **59⅝"** | 22.5° |
| 40ft | 10ft | 99¼" | 198¾" | 120" | **49¾"** | 22.5° |
| 60ft | 14ft | 159" | 298¼" | 168" | **69⅝"** | 22.5° |
| 30ft | 8ft | 69½" | 149" | 96" | **39¾"** | 22.5° |

⚠ **The headline: on a 40ft/12ft ring the two wedges are 119¼" of a 198¾"
outer edge — 60% of it.** Hips are not a detail to tidy up at the end of the
roof. They are most of the roof at the outer wall, and whatever they cost in
labour gets multiplied by sixteen.

The rake is always 22.5°, whatever the building — it is half the octagon's
45° turn, so it never varies. One jig angle covers every hip on every octagon
ring ever drawn.

---

## 2. The constraint that drives the whole design

> *"They need their joists to all bear on the panel below it."*

This is the thing that rules out the obvious shapes. Take one facet's plan: a
trapezoid, inner edge short, outer edge long, ends raking out at 22.5°.

- **Joists running along the wall** (across the span) would land on the hip
  rafter at one end, not on a wall. ✗
- **Joists running parallel to the hip** land on the hip at one end. ✗
- **A sharp triangular wedge with span-wise joists**: the joists near the point
  start part-way along the span, so their inner ends die on the hip line with
  nothing under them. ✗ — and this is exactly the failure the sharp triangle
  causes, which is, I think, why you went to a trapezoid by instinct.
- **Span-wise joists in a shape whose inner and outer edges are both full
  width**: every joist runs the whole span and lands on the inner wall and the
  outer wall. ✓

So the rule *"all joists bear"* is equivalent to: **every panel on the ring
roof must reach from the inner wall to the outer wall.** Nothing may start or
stop in the middle of the span. That one sentence decides everything else.

Happily, the facet's inner and outer edges **are parallel** — the inner and
outer octagon sides of one facet face the same way — so a span-wise panel has
two parallel bearing edges to sit on.

---

## 3. Scheme A — rectangular field plus hip panels (recommended)

What I believe you are picturing, made to satisfy the bearing rule.

Each facet gets:
- a **field** of rectangular panels across the middle, limited in total width
  by the *inner* edge, and
- one **hip panel** at each end: a right trapezoid, not a triangle.

The hip panel in plan:

```
        outer wall  (long edge, a + 59 5/8")
   ┌───────────────────────────────┐
   │                            ╱
   │  span 144"               ╱  <- hip line, raked 22.5°
   │                        ╱
   └──────────────────────┘
      inner wall  (short edge, a)   <- the landing surface
```

- Both parallel edges bear on walls, so **every joist runs the full 144" and
  lands at both ends**. ✓
- The straight left edge butts the field panels. **Parallel to the press.** ✓
- The raked right edge is the hip, closed by a raking plate cut at 22.5° and
  blocked in the press by an inverted 22.5° wedge. ✓
- `a` is the truncation — what turns the triangle into a trapezoid, and the
  *"nice surface area to land on."*

**Two halves.** The two hip panels meeting at one corner belong to different
roof facets, so they are already two separate pieces, mirror images of each
other, meeting along the hip with a bevel. That is your two halves, and each
one has exactly one parallel edge and one raked edge.

### What to set `a` to

A column panel is **25½"** wide (`COLUMN_TOTAL_WIDTH_IN`). If one column panel
sits under each inner corner and the two halves share it, each half lands on
about **12¾"** of it — which happens to clear the 12" minimum panel width you
just set, and matches the 13¼" edge panel already in the floor/roof catalogue.
So `a = 12¾"` has three independent reasons to be right, which is usually a
good sign.

### ⚠ The problem with Scheme A, stated plainly

With `a = 12¾"`, the hip panel's outer edge is **72⅜"** on a 40ft/12ft ring.
That is a six-foot-wide panel, 12ft long. Too big for the press and probably
too big for the truck.

So it has to be split — and the moment you split it, the inner pieces are back
to being narrow or pointed, because the taper has to go somewhere. Splitting it
into three gives three tapered panels of 4¼" → 24⅛" each, and a 4¼" inner edge
is below your 12" minimum.

**This is the real design problem, and it is not solved by choosing a shape for
one panel.** The facet's outer edge is 2.5× its inner edge; that ratio has to
be absorbed by *something*.

---

## 4. Scheme B — every panel tapers, and there are no hips at all

Give up the rectangle. Divide the facet into `n` identical trapezoids, each
spanning inner wall to outer wall.

On a 40ft/12ft ring with **n = 6**:

| | |
|---|---|
| Inner edge | 79½ / 6 = **13¼"** |
| Outer edge | 198¾ / 6 = **33⅛"** |
| Span | 144" |
| Edge splay | 45° / 6 = **7½"** per panel, i.e. 3¾° each side |

- Every joist runs the full span and bears at both ends. ✓
- Every panel on the facet is **identical** — one jig, one press setup, 48
  panels for the whole ring instead of 32 rectangles plus 16 bespoke hips.
- The inner edge lands on 13¼", above your 12" minimum, and is the same number
  the floor/roof edge panel already uses.
- No sharp triangles anywhere, because no panel is a triangle.
- The hip becomes nothing special: just where two facets' end panels meet, each
  raked at 22.5° as before.

**What it costs:** every panel is a trapezoid, so none of them are rectangles,
and the 19¼" sheet module and the plywood-diamond trick do not apply to the
ring roof at all. The sheathing above would be cut to fit rather than landing
on seams.

My read: on a ring roof the diamonds were never going to work anyway, because
the panels fan. Scheme B admits that and buys uniformity with it.

---

## 5. What I recommend

**Scheme B for the ring roof, with Scheme A's hip panel kept for one case:**
a hip where the two facets meet at *different* pitches, or where the ring
width changes, in which case the panels stop being identical and a bespoke hip
earns its keep.

If you would rather keep rectangles in the field — and there is a real argument
for it, since a rectangle is easier to build and easier to sheathe — then
Scheme A works, and the answer to the oversize hip panel is to let the hip be
**two or three tapered panels** and accept that the innermost of them is
narrow. That is a decision about what you would rather fabricate, and it is
yours.

---

## 6. Questions this needs you to settle

1. **Scheme A or B** — bespoke hips against a rectangular field, or a fan of
   identical tapered panels with no hips at all?
2. **Is `a = 12¾"` the right landing**, i.e. do the two halves share one 25½"
   column panel at the inner corner, or does each half want its own?
3. **Does the column panel sit in the inner wall, the outer wall, or both?**
   The hip lands on both rings, so both ends need bearing, and you have only
   said the carriers are column panels — not where.
4. **Maximum panel width** for the press and the truck. The whole oversize
   problem in §3 turns on a number nobody has written down. The wall panels
   have `fabricationMinPanelWidthIn` (24", yours) but no maximum.

---

## 7. Already decided, recorded here so it is not re-litigated

- They are called **hip panels**.
- The panels carrying them are **column panels** — *"Column panels can carry
  more weight so hopefully they'll be good enough."*
- The skins are **¾" plywood, as on the safety gap panel**, nailed with
  **sheathing nails, 2 per 6 inches**, and those nails **count in the material
  totals**.
- An **error sign when a multi-level roof exceeds the estimated strength of the
  panels below it** is wanted — noted as a want, not yet specified. ⚠ The
  honest obstacle: the catalogue carries no load-bearing figure for any straw
  panel (`PanelStructuralStatus` deliberately has no `value` field, because
  nobody has engineered one). A warning needs a number to compare against, so
  this one is blocked on real capacities rather than on code.
