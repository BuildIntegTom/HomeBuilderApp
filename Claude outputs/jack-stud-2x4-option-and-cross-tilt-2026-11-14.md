# Two decisions from 2026-11-14 — jack studs, and the cross-tilt low edge

---

## A. Jack studs: plywood is right, and they take optional 2x4s — **BUILT**

**I had this backwards and he corrected it.** I flagged that jack studs still
default to a 3/4in plywood sheet, reading his *"I don't think we need plywood
skins on either side"* as covering them. It does not:

> *"I misunderstood the plywood. Jack stud question, those are definitely
> supposed to be plywood. It would be nice if there was an option to change or
> add 2x4s to the jack studs. Perhaps Jack studs should have editable options
> to add a 2x4 to the inside and a 2x4 to the outside, making Jack studs
> default 3/4 in horizontal elevation view with the option of adding 2x4s to
> make them two and a quarter horizontal elevation view length."*

So **nothing about today's default changes.** The plywood jack sheet stays.

### What to build

Two independent toggles per project (or per opening — see the open question):
**add a 2x4 at the exterior wythe** and **add a 2x4 at the interior wythe**.

⚠ **"Inside" and "outside" are the two WYTHES, not two sides along the wall,
and that is what makes his 2¼in arithmetic work.** The plywood sheet is
panel-depth wide, so it already spans both wythes. A 2x4 added at each wythe
sits beside the sheet at the *same* X band — both in the same 1 1/2in of
elevation length. So:

| | elevation (X) footprint |
|---|---|
| sheet alone (today's default) | **0.75in** |
| sheet + one or both 2x4s | **2.25in** |

That is exactly his *"3/4 in ... with the option of adding 2x4s to make them
two and a quarter"*, and it only reconciles under the wythe reading. Adding
them end-to-end along the wall would give 3.75in and contradict his number.

### ⚠ What it moves downstream, which is the real work

`jackStudThicknessIn` is not a cosmetic number. It feeds:

- `computeRoughOpeningWidthIn` — the clear RO shrinks by 1.5in per side, so
  **the window or door gets 3in narrower** unless the slot grows.
- A Big Header's chords and chord caps, which are cut to the clear span
  between the jacks (`buildBigHeaderChords`), and its web's end inset
  (`bigHeaderEndInsetIn`), which decides whether a web fits at all — see the
  solid-blocking threshold shipped the same day.
- The sill run width, which is inset from the slot by the jack thickness.

So this is a real stride, not a toggle. It also wants the existing
`JackStudConfig = "plywood" | "2x4-stud"` reworked: today it is an
either/or, and he is asking for **plywood PLUS optional 2x4s**. The honest
shape is `{ sheet: true; ext2x4: boolean; int2x4: boolean }`, with the
existing two values migrated onto it.

### Decided: project-wide

Every other framing choice of this kind in the app is a project setting, and
per-opening would mean a new stored field on the slot plus a new reason for
two visually identical openings to be different parts. It lives in
**Settings → Panelizer**, as a five-option select rather than the old pair of
toggles — the choice stopped being either/or, and five toggles would read as
five independent switches rather than one choice.

### ⚠ And it was never saved at all

`jackStudConfig` was **not in `ProjectState`**. A project saved with 2x4 jack
studs reopened as plywood — silently a different building, since the setting
moves the clear rough opening on both sides, a Big Header's chord lengths and
its web's end inset. Persisted now as an optional field (so no
`PROJECT_FILE_VERSION` bump, and an old file loads as plywood, which is what
it was drawn with) and classified `document` for undo.

### Measured

`jackStudThicknessIn`: 0.75 → 2.25 with a 2x4 at either wythe or both, and
the pre-existing `2x4-stud` replace mode still 1.5. A 48in slot's clear rough
opening goes 46.5in → 43.5in. The 2x4 stands at x = 0.75, inboard of the
sheet, and `overlappingMemberPairs` on the assembly is empty. Confirmed in the
browser: the note under the control reads 1½" off the slot width at the
default and 4½" with both 2x4s.

### Also closed

> *"Sorry about the 2x6 web comments, I think I was confused."*

Nothing to undo — the default girt is still two 2x4 bars plus a 2x6 laid flat,
which is what he described, and the 3/4-vs-1/2 plywood question was already
moot because the default girt contains no plywood at all. **No change made.**

---

## B. Cross-tilt low edge: no extra 2x4, and the current code is already right

> *"Use your best judgment for the cross tilt flat and let's go with that,
> it's still hard for me to visualize. As long as the panel takes up the
> entire space of where it's really supposed to fill as well as structurally
> support the beam, And make it buildable in the shop — those are the goals."*

### Decision: do NOT thicken the low edge. No code change.

His three goals, against what the builder does today:

| goal | today |
|---|---|
| fills the space it is supposed to fill | ✓ `crossTiltRowHeightsIn` derives the low edge from the shed plane with **no clamp**, so the wedge between the wall top and the roof's underside is exactly filled |
| structurally supports the beam | ✓ `crossTiltMinimumLowHeightIn` already includes **a real stud in both wythes** — his own earlier requirement — so the bearing is there |
| buildable in the shop | ✓ below that minimum it refuses in words rather than drawing a panel thinner than its own layers |

⚠ **Adding a 2x4 would break goal 1, not serve it.** The low edge is not a
free dimension — it is the roof plane. Thickening it pushes the panel **up
through the roof it is carrying**, which is exactly what the "no clamp" note
on `crossTiltRowHeightsIn` already warns against. My original question was
built on a stale memory that said the edge was 3 1/2in; it has been derived
from the real layer stack since 2026-11-01 (6.81–8.34in depending on pitch).

### ⚠ The one case that does violate goal 1 — and it is NOT the 2x4

On a **very shallow shed** the derived low edge falls under the minimum and
the row is **left undrawn**: a hole along the whole tall wall. Nothing is
built where something should be, which is his goal 1 failing in the other
direction.

**Queued fix, and it is the same move made for shallow headers the same day:**
a wedge too thin to FRAME is not a framed panel, it is a **solid tapered
filler** — a board ripped to the taper, which fills the space, carries the
bearing and is trivially buildable. Replace the refusal with that below the
minimum, keep the framed panel above it.

### ⚠ MEASURED 2026-11-14 — and it argues for NOT building the filler

I measured how reachable the refusal actually is before spending a stride on
it, on a 24 x 16 Tiny House:

| pitch | minimum low edge | what the Tiny House actually gets |
|---|---|---|
| 1:12 | 7.71in | **14.7in** |
| 2:12 | 7.43in | 29.4in |
| 3:12 | 7.15in | 44.1in |
| 4:12 (default) | 6.87in | **58.8in** |
| 6:12 | 8.34in | 88.3in |
| 12:12 | 6.81in | 176.5in |

Even at the shallowest pitch the app will draw, an ordinary small building has
**twice** the low edge it needs; at the default it has eight times. The
refusal needs a near-flat roof on a tiny footprint.

**And when it does fire it already says so in words** —
`crossTiltTakeoff.refusal` is rendered as a disclaimer in the Roof section
(`page.tsx:14361`), naming the two numbers. So the failure is reported rather
than silent, which is the half of his "fills the entire space" that actually
matters: the drawing never quietly omits the row.

**Recommendation: close this, do not build the filler.** A new member builder,
shop sheet, price bucket and overlap pin — the four things the Big Header
needed — for a case that requires a roof almost flat enough to pond. If he
disagrees the design above is ready to build.
