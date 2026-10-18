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
