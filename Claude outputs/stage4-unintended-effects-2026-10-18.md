# What Stage 4 changed that we did not intend — audit, 2026-10-18

Tommy, after showing the app to a friend: *"Let's get to the bottom of what is
affected in ways we did not intend and how to fix them."*

The re-tile did more per wall than compute widths. Stage 4 replaced it with
`resizeWallRun`, which only grows and shrinks panels at one end — so everything
ELSE the re-tile settled silently stopped being settled. This is the inventory
of that, measured rather than guessed.

## What the re-tile used to settle, per wall

1. `gapEndFor` — which end the safety gap belongs at
2. `wallRunFor(ownership)` — whether this wall BUILDS a corner panel at each end
3. `tileOneWallPreservingOpenings` — the widths (this is the part Stage 4 kept)
4. `reconcileBracedPlacement` — braced patterns, zones, locked widths, by position
5. `markSafetyCorner` — the mitered-shape safety corner

Stage 4 reproduced **only 3**. The findings below are 1, 2 and 4.

---

## FINDING 1 — corner ownership flips, and nothing moves the corner panel

**Severity: high. Produces wrong physical parts.**

Corner ownership is decided by *"THE LONGER WALL RUNS THROUGH"* — it reads
`wall.lengthFt`. So changing a length can flip which wall builds a corner.
Measured on a real footprint:

| | 30ft x 30ft | widened to 40ft x 30ft |
|---|---|---|
| AB corner panels | 1 | **2** |
| BC corner panels | 1 | **0** |

`resizeWallRun` adds and removes STANDARD panels only. It will never add AB's
second corner panel or remove BC's. After that edit the model has **two corner
panels at one corner** and BC's framing is 25.5in short of its own run.

⚠ The wall TOTALS still come out right, which is why nothing failed: the delta
is measured from `wallGeometryFor(...).lengthIn`, which already accounts for the
inset change. The sum is correct and the composition is wrong — the worst shape
of bug, because every invariant we have still passes.

## FINDING 2 — the safety gap's end can flip, and the gap does not move

**Severity: medium-high. A rule-placed part ends up at the wrong end.**

`computeGapEnd` picks the end by DISTANCE from the least-accessible corner.
Changing wall lengths moves corners, so those distances change and the chosen
end can flip. `resizeWallRun` deliberately steps over the gap — correct for a
length change, wrong when the rule itself has moved.

## FINDING 3 — bracing does not follow a wall that grew

**Severity: design question, not clearly a defect.**

Growing a wall inserts plain `standard` panels. The braced-panel spacing rule
(`bracedSeed.spacingIn`) is not re-applied, so a wall grown from 30ft to 50ft
gains 20ft of unbraced framing. Under tile-once that may be exactly right — the
user places braces — but it is a decision, not an accident, and it should be
recorded as one.

---

## The shape of the fix

Findings 1 and 2 share a cause: **a rule-placed part's RULE changed, and only
its width was being maintained.** The fix is the same for both — on a length
change, re-evaluate the rule for each wall, and add, remove or move the
rule-placed slot before resizing the remainder.

That keeps tile-once's promise intact. The user's panels are still never
re-derived; what gets re-derived is only what was never theirs — the corner
panels and the safety gap, which the model already names as *"the two parts
that remain rule-placed and therefore keep moving by themselves."*

⚠ **This is not a retreat to re-tiling.** It is the model's own rule 4, applied
where Stage 4 forgot to apply it.

---

# ADDENDUM, same day — what the audit itself missed

The three findings above were all written from the DELTA. That was the wrong
place to look from, and it hid a fourth problem that is worse than any of them.

## FINDING 4 — a wall whose own corners never moved was skipped entirely

**Severity: a dimensional-tightness violation, shipping.**

`resizeSlotsForShapeChange` asked `wallGrowthEnd` which end moved, and skipped
the wall when the answer was `null`. `wallGrowthEnd`'s own doc comment said
`null` means *"this wall's run did not change and its panels must not be
touched at all."* That sentence is false.

A wall's run is its nominal length **less whatever a neighbour's corner panel
occupies at each end**, and that ownership is decided by comparative wall
length. So a wall can keep both of its own corner points and still change
length, because a NEIGHBOUR's ownership flipped.

Measured, on the same 30x30 → 40x30 edit the audit used:

| wall | own corners moved? | run before | run after | what happened |
|------|--------------------|-----------:|----------:|---------------|
| AB   | yes (B)            | 344.5in | 480in | resized, gained a corner panel |
| BC   | yes (B, C)         | 344.5in | 329in | resized, lost its corner panel |
| CD   | yes (C)            | 344.5in | 480in | resized, gained a corner panel |
| DA   | **no**             | 344.5in | **329in** | **skipped — panels left 15.5in long** |

DA's panels summed 2756 eighths into a wall 2632 eighths long. Not a
composition error — the wall's parts did not add up to the wall.

⚠ **Why the audit missed it, which matters more than the bug.** The audit
reasoned that the totals must be right because the delta is measured from
`wallGeometryFor(...).lengthIn`, which already accounts for the inset change.
That reasoning is sound *for every wall the loop actually resizes*, and DA was
never in that set. Reasoning about the arithmetic could not see a wall that
the control flow skipped before the arithmetic ran. It was found by printing
all four walls' sums and comparing them to their own lengths — measurement,
not argument.

The fix is `runChangeEndFromInsets`: when no corner moved, the end that changed
is the end whose INSET moved, because an inset change is the only thing that
can alter a run without moving a corner point. There is now no early bail at
all — a wall with genuinely nothing to do falls through to the zero-delta
shortcut and keeps its panel array **by identity**, which a test asserts with
`toBe` rather than `toEqual`.

## OPEN QUESTION — a safety gap does not slide outward when its end grows

Finding 2 was about the gap changing SIDE. There is a second case it did not
cover: the gap keeping its side and the wall growing at that side.

Measured: growing BC from 20ft to 60ft at its end leaves the gap at index 6 of
21 slots, about 20ft inboard of the end the rule points at. A fresh tile of the
same wall puts it near that end.

**This is a building decision and is left to Tommy.** The gap exists for access
on the least accessible side, which argues for staying adjacent to that end —
but it is also a real joint in a real wall, and a joint that wanders when an
unrelated dimension changes may be worse. The CURRENT behaviour is pinned by a
test so that whichever way he answers, the change has to be deliberate.

## What is now fixed

- Findings 1, 2 and 4 are fixed and pinned by
  `packages/geometry/src/lengthChangeRulePlacedParts.test.ts`, which replays
  `page.tsx`'s own pipeline through the exported functions.
- Finding 3 is fixed per his answer of 2026-10-18 — *"extend bracing to match
  the spacing rule"* — via `reconcileBracedPlacement`, which seeds only
  genuinely new standard-slot positions and leaves every pattern the user
  chose where it is.
- A corner panel changing walls now raises a notice, per his answer that it
  *"changes two walls' parts."*
- ⚠ **The test file carries a CONTROL** that runs the same pipeline with the
  rule-placed step switched off and asserts the old behaviour: totals right,
  composition wrong. An assertion that cannot fail against the bug it was
  written for is not evidence, and this one fails.
