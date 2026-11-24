<!-- BEGIN:nextjs-agent-rules -->
# Checking your work in this app

- **Typecheck BOTH projects.** `npx tsc --noEmit` in `apps/web` does not
  cover `packages/geometry`, which has its own `tsconfig.json`. A signature
  change there was silently accepted by a geometry test file because only
  `apps/web` was checked. Run it in both.
- **Lint needs more heap than the default.** ESLint OOMs at 2GB on
  `app/page.tsx`; `npm run lint --workspace=apps/web` now runs node with
  `--max-old-space-size=4096`. Run it from `apps/web` — the flat config
  lives there, and from the repo root ESLint reports a migration error and
  writes nothing.

  ⚠ **4096 IS NO LONGER RELIABLY ENOUGH, and it fails SILENTLY.** Measured
  2026-11-13: three runs at 4GB produced a **zero-byte** JSON file while the
  shell happily reported success, because the OOM goes to stderr and the
  usual incantation sends stderr to `/dev/null`. A single-file run on
  `page.tsx` alone then took over ten minutes before being killed. The same
  tree linted clean at `--max-old-space-size=6144` in one pass.

  So: **use 6144**, and **never discard stderr** — redirect it to a file and
  look at it. A successful run's stderr is one benign Babel note ("has
  deoptimised the styling of ... page.tsx as it exceeds the max of 500KB");
  anything else, or an empty JSON, means the gate did not run. An empty
  result is not a clean result, and it is easy to read as one.
- ⚠ **THE COMPILER RULES CAN GO SILENT ON `page.tsx` AND STILL LOOK LIKE A
  PASS — measured 2026-11-24.** A run came back with
  `preserve-manual-memoization` **83 → 0**, `refs` 2 → 0, `purity` 1 → 0,
  `immutability` 1 → 0 on `page.tsx`, while every other rule in the repo was
  byte-identical. That reads like a 87-problem improvement. It is the React
  Compiler **bailing out of `LayoutEditor` entirely** and reporting nothing.

  ⚠ **It is environmental, not a code change, and here is how that was
  settled**: lint HEAD's own `page.tsx` under the same conditions. Copy it
  aside under a different name and lint that one file —

  ```
  git show HEAD:apps/web/app/page.tsx > apps/web/app/__tmp_head.tsx
  (cd apps/web && node --max-old-space-size=6144 ../../node_modules/eslint/bin/eslint.js app/__tmp_head.tsx -f json)
  ```

  — and it came back with the same 3 as the edited file. **The baseline had
  degraded, not the diff.** Everything else on `page.tsx` matched exactly
  (`no-unused-vars` 14, `exhaustive-deps` 11, `no-unescaped-entities` 15,
  `set-state-in-effect` 3), so the change still measured a true zero delta —
  it was just measured against a gate that had lost a rule family on both
  sides.

  ⚠ **The cause is MEMORY, and this machine has 8GB.** `--max-old-space-size=6144`
  asks for a 6GB heap on an 8GB box; that run had ~3GB actually free. The
  tell is the clock: AGENTS.md's own earlier note records a single-file
  `page.tsx` run finishing in **about a minute** at 6144. This one took
  **12m25s** — twelve times slower — and then skipped the compiler pass.

  ⚠ **This is a WORSE failure than the 4GB one documented below it.** At 4GB
  the gate wrote a zero-byte file, which is obviously broken. Here it writes a
  complete, well-formed, plausible JSON with one rule family quietly missing.
  Both say "an empty result is not a clean result"; this one adds **a SMALLER
  result is not a better result**. `preserve-manual-memoization` on `page.tsx`
  sat at 90 across fourteen runs from 2026-11-19 to 2026-11-23 — if it moves
  by tens, suspect the gate before the diff.

  **So, before trusting a run:** close the dev server AND the browser preview,
  check free memory (`Get-CimInstance Win32_OperatingSystem`), and sanity-check
  that `page.tsx` still reports ~83 `preserve-manual-memoization`. If it
  reports a handful, the compiler bailed and the correctness rules
  (`refs`, `purity`, `immutability`) measured nothing — say the gate is
  unverified rather than reading zero as clean.

- **Measure a lint DELTA, not a total, and count WARNINGS too.** This app
  carries pre-existing errors (94 across the editor files as of
  2026-09-25), so "eslint reported errors" means nothing on its own.
  Compare rule+message counts against the base commit — **including
  severity-1 warnings**. A "zero delta" claim that counted only errors once
  missed a live `react-hooks/exhaustive-deps` warning on a memo that fed the
  cut list, which is a warning that cuts real parts wrong.
- **The zero-delta gate is not one rule — judge by which rule moved.** The
  gate exists because a `react-hooks/exhaustive-deps` **warning** once hid a
  live defect on a memo that fed the cut list, i.e. a warning that cut real
  parts wrong. So: `exhaustive-deps`, `refs`, `set-state-in-effect`,
  `set-state-in-render`, `purity` and `immutability` must **never** rise —
  those track correctness. `preserve-manual-memoization` tracks React
  Compiler memoization hints and **`page.tsx` is already saturated with it**
  (61 on `ac55a39`, including 6854/6855/6872/6873 around the
  `absorbedCornerWalls` memo). It may rise **only** when copying an existing
  flagged pattern, **or is a new `useMemo` in a file already saturated with
  it**, and only if every new error is named individually with what it came
  from. **A rise you cannot attribute is a failure, not an exception.**

  ⚠ **Recorded exception, 2026-09-30 — and the first version of this rule
  was wrong.** The corner-brace Review Log entry took +4 of that rule
  (61 → 65) with `exhaustive-deps` unchanged at 12 and no correctness rule
  moving. I first wrote this rule as "only when copying an existing flagged
  pattern", on a report that said 3 of the 4 were copies. The builder then
  checked the raw ESLint JSON and corrected me: **only 2 are copies**
  (`cornerBraceCombineRefusals` and its `secondStory` dep, mirroring
  `absorbedCornerWalls` directly above, which carries the identical two).
  The other two are `slotIndexPinnedWallIds`, a **brand-new** memo, and that
  same memo appearing in the Review Log memo's dependency array. Both are
  accepted as an explicit exception rather than reclassified as copies.
  Note what that second one means: adding a new memo to a dep array can
  flag *there* while its neighbours on the lines above do not — so expect
  one new memo to cost two errors, and say so rather than rounding down.
  ⚠ **Recorded exception, 2026-11-02 — the Derivation Sheet (B18), +3.**
  `preserve-manual-memoization` 58 -> 61, every other rule byte-identical, no
  correctness rule moved. All three are the SAME new `useMemo`,
  `shearDerivation` in `page.tsx`, which is the file this rule is already
  saturated with:

  - `8463:27` — the `useMemo` call itself.
  - `8488:74` — `defaultBracePattern` in its own dependency array.
  - `8488:95` — `defaultBracedMirrored`, likewise.

  So the 2026-09-30 note's *"expect one new memo to cost two errors"* is a
  FLOOR, not a ceiling: a new memo costs one for itself plus one for each
  already-flagged value in its dep array, and this one carries two.

  ⚠ The same change had `exhaustive-deps` at **13** for one run, and that was
  fixed rather than accepted — the memo was calling a helper defined in the
  component body. The helper moved to `shearMembers.ts` as a pure function
  taking an explicit context object, which removed the dependency instead of
  listing it. `useCallback` would have traded a banned rule for a rationed one.

  ⚠ **Recorded exception, 2026-11-14 — the gable-window seed, +10.**
  `preserve-manual-memoization` 62 -> 72. Every other rule byte-identical and
  no correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1). It is **one call**:
  `seedGableWindowsForFootprint(fp, autoGableWallIds, nextSlots, …)` inside
  `applyRoofDefaultsForFootprint`.

  ⚠ **This one is NOT a new `useMemo` and not a copied pattern**, so it does
  not fit either case above. It is recorded as an exception on the strength of
  the bisect rather than waved through, and the bisect is the useful part:

  - Removing that one call returns the count to **exactly 62**.
  - A bare `setGableWindowAnchorsByWallId((prev) => prev)` in the same place
    costs **nothing**, so it is not "a second writer of that state".
  - Moving the body into its own module, replacing the options object with
    positional arguments, and moving the `existing` read inside the updater
    each changed **nothing** — all three were tried and all three read 72.
  - What it leaves is `nextSlots`, the whole freshly-tiled slot record,
    escaping into a function the compiler cannot see through. That record is
    also this function's RETURN value and feeds `setBaseWallSlots`, so every
    memo downstream of the building's slots stops being preservable. The ten
    are all memos keyed on `gableEaveHeightIn` / the gable row.

  ⚠ **Recorded exception, 2026-11-15 — the ridge beam's parts list, +1.**
  `preserve-manual-memoization` 72 -> 73. Every other rule byte-identical and
  no correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, `no-unused-vars` 35).

  It is ONE dependency: **`secondStory` at `page.tsx:8054:5`**, added to
  `ridgeBeamForPlan`'s dep array so that memo can work out how tall the ridge
  posts are per story. That is the 2026-09-30 note's own case — adding an
  already-flagged value to a dep array flags *there* while its neighbours do
  not. `wallHeightFt`, added on the line above it, costs nothing, because it is
  a plain number.

  ⚠ **It is not a choice between +1 and 0.** The dependency is REQUIRED: drop
  it and `exhaustive-deps` rises instead, and that rule may never rise. So the
  trade is one rationed error against one banned one.

  ⚠ **And the useful half: TWO BRAND-NEW `useMemo`s cost NOTHING** —
  `ridgeBeamFabricationGroups` and `ridgeColumnFabricationGroups`, both added
  in the same change. Each reads exactly one already-memoised value
  (`ridgeBeamForPlan`) and nothing else. That is worth knowing against the
  2026-09-30 note's *"expect one new memo to cost two errors"*: the cost is not
  in the memo, it is in how many already-flagged values its dependency array
  touches. A memo with one clean dep is free.

  ⚠ **Recorded exception, 2026-11-15 (second of the day) — the gable-window
  roofline entry, +1.** `preserve-manual-memoization` 73 -> 74. Every other
  rule byte-identical and no correctness rule moved (`exhaustive-deps` 12,
  `refs` 29, `set-state-in-effect` 12, `purity` 1, `immutability` 1,
  `no-unused-vars` 35).

  It is ONE dependency, attributed by the single-file bisect below rather than
  by reading line numbers: **`gableTilesByWallId` in the new
  `gableWindowRooflineReviewEntries` memo's dep array**. The memo itself is
  free; its other three deps (`footprint`, `gableEaveHeightIn`, `unitSystem`)
  are free; the one already-memoized value costs one. That is the 2026-11-15
  ridge-beam note's rule holding again, now in both directions: **a memo costs
  one per already-flagged value its dep array touches, and nothing for
  itself.**

  ⚠ **The accompanying one-line behaviour fix cost NOTHING** — replacing
  `setGableWindowAnchorsByWallId((prev) => ({ ...seeded, ...prev }))` with
  `setGableWindowAnchorsByWallId(seeded)` measured 73, identical to HEAD. Worth
  knowing: removing an updater function from a setter is free here, so a merge
  that has to become a replacement never has to be argued against this budget.

  ⚠ **A correction to the 2026-11-15 ridge-beam entry above.** It attributes
  its +1 to `secondStory` at `page.tsx:8054:5`. That line was ALREADY flagged
  at HEAD along with `gableEaveHeightIn` at `8051:5` — the `ridgeBeamForPlan`
  dep array carries two, not one, and did before that change. The entry's
  conclusion stands (the dep was required, and dropping it would have raised
  `exhaustive-deps`); its line-number attribution does not. **Attribute by
  diffing the flagged SOURCE LINE TEXT between two runs, not by eye against
  shifted line numbers** — an edit earlier in the file moves every number below
  it, and this file is 17,000 lines long.

- **2026-11-16, the gable's dual bevel, +1.**
  `preserve-manual-memoization` 76 -> 77. Every other rule byte-identical and
  no correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, `no-unused-vars` 35,
  `no-unescaped-entities` 15).

  One line, `page.tsx:12389` — the dep array of the new
  `gableBevelRefusedReviewEntries` memo,
  `[allInstances, thicknessIn, gableEaveHeightIn, gableCrossRiseInByWallId]`.
  The rule holding a fourth time: one per already-flagged value a dep array
  touches, nothing for the memo itself.

  ⚠ **Two things in this change cost NOTHING, and the second is the useful
  one.** The whole compound-bevel part — a new `MemberPosition` field, an
  exact 3D separating-axis test in `memberPrism`, a rewritten gable top
  assembly, a new geometry module and three new test files — is outside
  `apps/web` and never touches this budget at all. And inside `page.tsx`, the
  wiring itself (a widened memo, four new call sites, a group-key field and a
  prop threaded through two components) measured **zero**.

  ⚠ **A plain helper function is NOT free, and that is the trap worth
  remembering.** The cross rise started as
  `const gableCrossRiseInFor = (wallId: string) => ...` in the component body.
  A function declared there is a new value every render, so every memo calling
  it grew a **missing dependency** — `exhaustive-deps` went 12 -> 13, and that
  rule may never rise. Wrapping it in its own `useMemo` fixed that and cost a
  `preserve-manual-memoization` instead. Building the record **inside the memo
  that already derives it** (`gableRoofTops`, which now returns both the map
  and the record) costs neither. Reach for that shape first: a derived lookup
  belongs in the memo that produced the data, not beside it.

- **2026-11-16, the ground story's corner mitre: ZERO delta.** 183 / 136 / 47,
  every rule byte-identical again.

  ⚠ **A brand-new `useMemo` cost nothing** — `wallPlanMitreByWallId`, over
  `[footprint, thicknessIn]`. Both are plain `useState` values, so the rule
  from 2026-11-15 holds once more: a memo over raw state is free however much
  it does. Two new call sites, a widened group key and a prop threaded through
  two components also moved nothing.

  ⚠ **AND THE GATE DID NOT CATCH THE REAL DEFECT IN THIS CHANGE**, which is
  worth recording beside the number. Giving `buildCornerStuds` a
  `PanelPlanMitre` closed an import cycle — `panelMemberHelpers` is imported by
  almost everything and `panelPlanMitre` imports IT for its constants — so
  `MIN_MITRED_INTERIOR_LENGTH_IN = 2 * PLATE_2X4_THICKNESS_IN` evaluated before
  that constant existed. **`tsc`, `vitest` and lint all passed; the dev server
  answered 500** with *"Cannot access 'PLATE_2X4_THICKNESS_IN' before
  initialization"*. Same family as the module-scope catalog read further up
  this file. **Adding an import to a widely-imported leaf module is the move
  to be suspicious of, and only the browser finds it** — which is the argument
  for opening the preview on any change that touches the catalogue's shared
  helpers, not only on changes you can see.

- **2026-11-17, B34 stride 2 (the centre wall panelized): ZERO delta.** 185 /
  137 / 48, every rule byte-identical to the post-B35 baseline
  (`preserve-manual-memoization` 80, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **A NEW `useMemo` COST NOTHING AGAIN, and its dep is why**:
  `interiorWallNotDrawnReviewEntries` is keyed on `[footprint]` alone, a plain
  `useState` value. The 2026-11-15 rule holding for the seventh time — **a memo
  over raw state is free however much it does.** Worth reaching for
  deliberately: when a Review Log entry can be derived from state rather than
  from other memos, it is free, and when it needs another memo it costs one.

  ⚠ **`no-unused-vars` read 36 for one run and it was a real leftover again** —
  the `CompassDirection` TYPE import in `panelInstances.ts`, dead the moment
  `counters` and `pushInstance` widened to `WallSeriesLabel`. The function
  `wallCompassDirection` is still used; only the type went. Second time in two
  days that widening a type left its narrower neighbour behind, so: **after
  widening a field's type, check whether the old one is still imported.**

- **2026-11-18, the Reference Points page: ZERO delta — after a +2 that was
  attributed and then FIXED rather than recorded.** Final: **188 problems**,
  every rule byte-identical (`preserve-manual-memoization` 83,
  `no-unused-vars` 35, `refs` 29, `no-unescaped-entities` 15,
  `set-state-in-effect` 12, `exhaustive-deps` 12, `immutability` 1,
  `purity` 1).

  ⚠ **THE FIND, AND IT IS THE 2026-11-17 RULE IN A NEW DISGUISE: a plain
  render-time `const` can cost this budget, not just a `useMemo`.** The page's
  sheet is deliberately NOT memoised — it is a dozen object literals built from
  values already in scope, and a memo would have touched two already-flagged
  values. That part worked. But the first run still came back **83 -> 85**, and
  the source-line diff printed **one line, twice**:

  ```
  +2  [footprint, foundationType, pierSpacingFt],
  ```

  Nothing was added to either array. **`foundationType` BECAME a flagged
  value**, and then cost one in each of the two dep arrays that touch it. The
  cause: the sheet read `foundationFasteners` (a component const derived from
  `foundationType`) and passed it into `buildReferencePoints`, an imported
  function the compiler cannot see through — the same escape the 2026-11-14
  gable-window entry found with `nextSlots`.

  ⚠ **Fixed, not recorded as an exception, because it fit NEITHER case the
  rule allows** — not a new `useMemo`, not a copied pattern. The derivation
  became a module-scope pure function taking the plain `useState` id,
  `foundationFastenerConnections(foundationTypeId)`, so `foundationType` never
  escapes. Re-measured: **83, and every other rule on `page.tsx` identical to
  HEAD.** Same prescription as 2026-11-17: **if something needs a derived
  value, give it a pure function, not a closure over the component's own
  const** — and now it is known to apply to a render-time const, not only to a
  handler declared above the value.

  ⚠ **The function reads the catalog INSIDE its body**, which is forced: a
  module-scope `const` reading `data.ts` throws at module evaluation under
  Turbopack (see the note further down this file). A module-scope FUNCTION that
  reads it when called is fine.

  ⚠ **And the single-file bisect settled the whole-app number without a second
  20-minute run.** All 85 of that rule were in `page.tsx`, and nothing else in
  `apps/web` had changed since the full run — so linting `page.tsx` alone at
  HEAD, before the fix and after it gave all three columns at once. Worth
  reaching for whenever the moved rule lives in one file.

  ⚠ **The gate missed every real defect again, for the eighth time.** Three of
  them, all found by READING THE PAGE IN A BROWSER: a duplicate brace row
  quoting 232 screws directly beneath the tally line's 344 **for the same
  screw**; a *Jack stud to panel* row filed under a *Panel to panel* heading
  and carrying a sentence about diaphragm seams; and five copies of one
  paragraph burying the only line that differed between the rows. `tsc`,
  `vitest` and lint passed on all three. The narrow lesson is new: **a page
  whose job is to be read is only testable by reading it** — none of the three
  is expressible as a wrong number.

- **2026-11-18, a stacked panel buys its own height's materials: ZERO delta.**
  **188 problems**, every rule byte-identical again. The change is six
  arguments inside one existing `useMemo` plus a `const` at the top of its
  loop; no memo was added, removed or re-keyed, and its dep array did not move.

  ⚠ **A BROWSER A/B ON A TEMPLATE IS NOT A CONTROLLED COMPARISON, and that
  is worth knowing before quoting one.** The window seeder places one window
  per 12ft of wall AT RANDOM, so drawing the same Home tile twice gives two
  buildings that differ by a panel or two — here 101 wall + 23 safety gaps on
  one draw and 100 + 26 on the other. Every total downstream (weight, price,
  sheets, board feet) moves with that. A delta far larger than one panel is
  still evidence, and this one was (90 sticks of 2x4); a delta of the same
  order as one panel is not. For an exact figure, save the project and load
  the same file on both sides.

- **2026-11-18, the interior-wall elevation: ZERO delta.** **188 problems**,
  every rule byte-identical to the stride-3b run
  (`preserve-manual-memoization` 83, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **A new exported function, a narrowed prop type, a new optional prop,
  three JSX conditionals and a DELETED `useMemo` all measured zero together.**
  The deleted one (`interiorWallNotDrawnReviewEntries`, keyed on `[footprint]`)
  cost nothing to begin with — the 2026-11-17 note's rule from the other side:
  a memo over raw state is free, so removing one refunds nothing. And
  `viewerStops` kept its single `[footprint]` dep while its body became one
  function call, which is why extracting it was free.

  ⚠ **DO NOT RUN `npx prettier --write` ON A FILE IN THIS REPO.** Measured
  the hard way: `prettier --write app/page.tsx` rewrote **10,883 lines and
  deleted 5,317** in one command. This repo is NOT prettier-formatted — its
  line width and wrapping are its own — so prettier does not tidy a file here,
  it reformats the whole thing and buries a 100-line change inside a 16,000-line
  diff. Recovered by `git checkout HEAD -- app/page.tsx` and replaying the
  edits, which only worked because every edit had been made by a saved script.
  **Keep patch scripts; they are the undo for a mistake like this.** If a file
  genuinely needs formatting, match the surrounding style by hand.

  ⚠ **AND THE BROWSER FOUND A NUMBER OFF THE 1/8in GRID.** The new
  elevation printed `194.58333333333331"` as a dividing wall's height. Two
  separate faults behind one symptom: the label was rendered raw (`{eaveHeightIn}"`,
  fine for as long as a wall height was always whole), and the HEIGHT ITSELF
  was unquantized, because a purlin wall's rise is a roof plane's over a
  fraction of its run. The second is the one that mattered: it is a CUT
  height, the shop sheet was already rounding it to an eighth, and the model
  was holding a figure 1/24in away from the sheet. Both fixed, and the grid is
  now asserted. **A number that only a drawing ever shows is still a number
  somebody cuts to** — and no test was looking at it, because no test renders
  a label.

- **2026-11-18, B34 stride 3b (a wall that carries the roof is built up to
  it), +2.** `preserve-manual-memoization` 81 -> 83, **188 problems** against a
  freshly re-measured 186. Every other rule byte-identical and no correctness
  rule moved (`exhaustive-deps` 12, `refs` 29, `set-state-in-effect` 12,
  `purity` 1, `immutability` 1, `no-unused-vars` 35,
  `no-unescaped-entities` 15).

  Attributed by the flagged-SOURCE-LINE-TEXT multiset diff against a real lint
  run of the base commit (`git stash` the change, lint, pop). It printed three
  additions and one removal, and the removal is the useful half:

  - `+1  const roofBearingModel = useMemo(() => {` — the memo CALL itself.
  - `+2  }, [footprint, roofEnabled, roofFormFromProfile, roofTrussLayoutContext, gableEaveHeightIn, stories, maxPanelHeightIn]);`
    — that memo's own dep array, which touches **two** already-flagged values
    (`roofFormFromProfile` and `gableEaveHeightIn`).
  - `-1  }, [footprint, roofEnabled, roofFormFromProfile, roofTrussLayoutContext, gableEaveHeightIn, unitSystem]);`
    — the OLD `roofBearingReviewEntries` array, which **stopped being flagged**
    once its derivation moved into the new memo and its deps became
    `[roofBearingModel, maxPanelHeightIn, unitSystem]`.

  So the net is 3 - 1. Both halves of the 2026-11-15 rule holding at once: a
  dep array costs one per already-flagged value it touches, and **it stops
  costing when those values leave it**. Moving a derivation up into one memo
  that several readers share is close to free: you pay for the new array and
  you get the old ones back.

  ⚠ **Five dep arrays in this change gained `roofBearingModel` and cost
  NOTHING** — `strawWeight`, `totalWoodWeightKg`, `secondStoryAllInstances`,
  `trussPlateWallLengthTotalIn` and `roofBearingFabricationGroups`. They show
  in the diff as a removed line and an added line with the SAME count, because
  the array's TEXT changed while its flag count did not. Read the multiset
  diff, not the raw line list, or five unchanged arrays look like ten events.

  ⚠ **And three things that are not memos measured zero**: a plain
  `const wallPanelInstances = [...]` rebuilt every render over two instance
  lists, a new prop threaded through two components, and a module-level helper
  function in `Building3DView`.

  ⚠ **THE GATE MISSED THREE REAL DEFECTS AGAIN, and all three were
  pre-existing.** `tsc`, `vitest` and lint passed on a build where (1) the
  Project Summary counted 62 wall panels for a building whose shop drawings
  are 99, because `panelCounts.wall` counted SLOTS and a banded column is two
  or three panels; (2) `FootprintCanvas` labelled the plan from an instance
  list **it built itself** out of four arguments, so its own counter named the
  centre wall C1-C11 where the building names it C1-C33 and the `0109` on
  screen was a different panel from the `0109` on the sheet; (3) a banded
  safety gap's fabrication sheet was headed with the first instance's height,
  because `groupKeyFor` returns early for `safety-gap` on the thickness alone.
  All three had been true since Mid-Wall Bond Beams and only became visible
  when a flagship template started banding its walls. The reusable lesson:
  **when a change makes an existing shape COMMON, re-read everything that
  shape passes through** — a defect nobody has met is still a defect.

- **2026-11-18, B34 stride 5 (the interior walls are drawn): ZERO delta.**
  **186 problems**, every rule byte-identical (`preserve-manual-memoization`
  81, `no-unused-vars` 35, `refs` 29, `no-unescaped-entities` 15,
  `set-state-in-effect` 12, `exhaustive-deps` 12, `immutability` 1,
  `purity` 1).

  ⚠ **A new renderer that runs on EVERY RENDER cost nothing, and that is the
  reusable half.** `allInteriorSlotRects` is called inline in two components'
  JSX, not from a memo — so there is no dep array to touch an already-flagged
  value, and the rule from the 2026-11-15 entries holds from the other side
  again: **the budget is spent by `useMemo`s and by what their dep arrays
  touch, not by how much work a render does.** A second loop in
  `panelSlotBoxes3D` (outside `apps/web` entirely) and a new test file likewise
  measured zero.

  ⚠ **The one thing to be careful of here was the opposite of a lint
  question.** Both plan renderers now map over a CONCATENATED list — the
  outline's rects plus the interior ones — which meant un-nesting an existing
  `.flatMap(...).map(...)` into one `.map(...)`. `tsc` catches a bracket
  mistake there instantly, but nothing would have caught the alternative
  design: a SECOND pass that draws interior walls with its own colours,
  labels and handlers. One list is what keeps a dividing wall's panels
  behaving like every other panel, and it is worth preferring even though it
  is the fiddlier edit.

- **2026-11-18, B36 strides 2 and 3 (one panel number, and the label IS the
  number): ZERO delta.** **186 problems**, every rule byte-identical
  (`preserve-manual-memoization` 81, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **TWO new `useMemo`s cost nothing, and one of them REPLACED a memo**, which
  is worth separating. `panelNumbers` took the place of `installNumberByKey`
  and grew two deps (`exportableAssemblies`, `panelNumberLedger`) — neither
  flagged, so the 2026-11-15 rule holds again: one per ALREADY-FLAGGED value a
  dep array touches, nothing otherwise. `wallPanelNumberByName` is brand new,
  over `[allInstances, panelNumbers]`, and is free for the same reason.

  ⚠ **And `panelNumberContext` is deliberately NOT a memo** — a three-field
  object literal read off values already in scope, rebuilt every render and
  passed to six fabrication sheets. Memoising it would have cost one per
  flagged dep for no benefit; the sheets are not memo-gated on it.

  ⚠ **The rest of a large change measured zero**: two new panel-catalog modules
  and a deleted formatter, a rewritten CSV column, a renamed `PanelInstance`
  field, an optional prop threaded through FOUR drawing components, a new
  Review Log memo and two new test files.

  ⚠ **AND THE GATE MISSED THE ONLY REAL DEFECT, for the fifth time this week.**
  The new Review Log entry was filed with `status: "confirmed"`, and
  `toReviewLog` (calc-engine) keeps **only** `pending-BI-confirmation` entries
  — so it rendered in **no build at all** while `tsc`, `vitest` and lint passed
  clean. Found by reading the Review Log in the browser after pressing the new
  button. The narrow lesson: **a Review Log entry that is not
  `pending-BI-confirmation` does not exist.** The wider one is the same as
  2026-11-17's: a thing with no test and no type is only visible where a person
  looks at it.

- **2026-11-18, hold-the-pitch + B36 stride 1: ZERO delta.** **186 problems**,
  every rule byte-identical (`preserve-manual-memoization` 81,
  `no-unused-vars` 35, `refs` 29, `no-unescaped-entities` 15,
  `set-state-in-effect` 12, `exhaustive-deps` 12, `immutability` 1,
  `purity` 1).

  ⚠ Worth recording for the size of it: a rewritten resize seam
  (`footprintForBox` now carries and scales interior walls), two rewritten slot
  paths, a changed series generator in geometry, a changed guard, two new test
  files and a deleted Review Log entry — and **not one flag moved, because the
  change added no memo at all.** The rule from the 2026-11-15 entries holding
  again from the other side: the budget is spent by `useMemo`s and by what
  their dep arrays touch, not by how much code there is.

  ⚠ **And the real defect was again invisible to all three gates.** A resize
  deleted a Multiplex's interior walls — 63 wall panels to 34, roof 72 to 36 —
  and `tsc`, `vitest` and lint all passed. **The browser found it, and only
  because the verification happened to look at a panel COUNT.** The narrower
  lesson is the one worth keeping: the footprint and the SLOTS are two separate
  paths, so fixing the first made the building report *"3 interior walls are
  built and priced"* while 33 of its panels were missing from the cut list.
  **A wall existing is not a wall having panels.**

- **2026-11-17, B34 stride 4 (the Multiplex tile at 8:12): ZERO delta, after a
  +3 that was diagnosed and fixed rather than recorded.** Final: **186
  problems**, every rule byte-identical to the stride-3c run
  (`preserve-manual-memoization` 81, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **THE FIND, AND IT IS A NEW RULE: reading a component value from a
  handler declared ABOVE it costs this budget.** The first run came back
  `preserve-manual-memoization` **81 -> 84, +3**, and the source-line diff
  printed three lines that are all the same cause:

  ```
  +1  roofFormFromProfile,
  +1  [footprint, thicknessIn, roofFormFromProfile, roofTrussLayoutContext, gableEaveHeightIn, gableEndsFullHeight],
  +1  }, [footprint, roofEnabled, roofFormFromProfile, roofTrussLayoutContext, gableEaveHeightIn, unitSystem]);
  ```

  Nothing was added to those arrays. **`roofFormFromProfile` itself BECAME a
  flagged value**, and then cost one in each of the three dep arrays that
  touch it — including one array that was already flagged for a different
  dep, which is why the multiset diff shows it as +1 rather than as unchanged.

  The cause: `refreshRoofForShapeChange` (declared around line 4,100) started
  reading `roofFormFromProfile` (declared around line 8,450). The value escapes
  into a function defined *before* it, so the compiler stops treating it as
  preservable and everything downstream of it flags.

  ⚠ **Fixed rather than recorded as an exception, and the fix was also more
  correct.** The derivation moved into `roofPitchFromRise.ts` as a pure
  `roofFormFromProfilePositions(walls, gableEndWallIds, positions)`. The
  handler now asks it about the **OLD footprint**, which is the honest question
  anyway — the stored rise was measured under the old building's form, not
  the new one's. Same family as the 2026-11-16 note about a plain helper
  function in the component body: **if a handler needs a derived value, give it
  a pure function, not a closure over the component's own const.**

  ⚠ **`no-unused-vars` then read 36**: `gableProfilePointIsShedEnd` in
  `page.tsx`, dead the moment the derivation moved out — the only remaining
  mention was in a comment. Removed, not silenced. **Third time this week that
  an extraction orphaned its import**, so it is worth making a habit: after
  moving a derivation into a module, grep the old file for the helpers it used.

- **2026-11-17, B34 stride 3c (a wall under each roof purlin), +1.**
  `preserve-manual-memoization` 80 -> 81, **186 problems**. Every other rule
  byte-identical and no correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, `no-unused-vars` 35,
  `no-unescaped-entities` 15).

  Attributed by the single-file bisect plus the flagged-SOURCE-LINE-TEXT diff,
  which printed **exactly one added line and nothing else**:

  `}, [footprint, roofEnabled, roofFormFromProfile, roofTrussLayoutContext, gableEaveHeightIn, unitSystem]);`

  It is `gableEaveHeightIn`, added to `roofBearingReviewEntries`' dep array
  because that memo now builds the roof planes to work out the panel bands.
  Same already-flagged value that cost +1 on 2026-11-16, and the rule holding
  again: **one per already-flagged value a dep array touches.**

  ⚠ **And it is forced.** Drop the dep and `exhaustive-deps` rises instead,
  which may never rise. One rationed error against one banned one, the same
  trade as the 2026-11-15 ridge-beam entry.

  ⚠ **A brand-new `useMemo` cost NOTHING again** — `roofBandCount`, over
  `[deckPanelTakeoff]`. One dep, and that dep is not itself flagged, however
  large a thing it is. So is everything else in a change of this size: a new
  geometry module and its tests, a rewritten roof loop in `deckPanelTakeoff.ts`
  (a run becomes N runs), two new interface fields, a new template option, a
  deduped facing list in `Building3DView.tsx`, and a new test file.

  ⚠ **AND THE GATE MISSED THE REAL DEFECT AGAIN, for the fourth time this
  week** — though this one was not found in the browser either. Stride 3
  stopped building the ridge beam and its posts when a wall runs under the
  ridge, and `deckPanelTakeoff` went on laying the extra structural girts that
  go **underneath those posts** into the floor panels: six girts of
  reinforcement for posts that are not built, on every Multiplex, in the shop
  sheets and in the weight. It changes no panel COUNT, so nothing on screen
  moves and no existing test could see it. **Found by reading the function
  while waiting for a lint run.** The lesson is narrower than "open the
  browser": **when you stop building a part, grep for what else was built
  FOR it.**

- **2026-11-17, B34 stride 3 (the centre wall carries the ridge): ZERO delta.**
  **185 problems**, every rule byte-identical to the stride-2 run
  (`preserve-manual-memoization` 80, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **A NEW `useMemo` WITH FIVE DEPS COST NOTHING**, and one of them is
  another memo. `roofBearingReviewEntries` is keyed on
  `[footprint, roofEnabled, roofFormFromProfile, roofTrussLayoutContext,
  unitSystem]`, and `roofTrussLayoutContext` is itself a `useMemo` — but it is
  not a FLAGGED one, and that is the whole rule. The 2026-11-15 note said "one
  per already-flagged value a dep array touches"; it is easy to misread as "one
  per memo a dep array touches", which is not the same thing and would have
  predicted +1 here. **Check whether the dep is flagged, not whether it is a
  memo.**

  ⚠ **A CORRECTION TO THE STRIDE-2 ENTRY BELOW: its error/warning split was
  mis-transcribed as 137 / 48.** The per-rule table in it is exactly right and
  is the same table as this run's, and that table forces **138 errors / 47
  warnings**: `no-unused-vars` (35) and `exhaustive-deps` (12) are the only
  severity-1 rules in this config, and 35 + 12 = 47. Nothing moved between
  runs. **When the per-rule table and the totals disagree, trust the table**
  — it is the thing the gate is actually about, and it is the half that gets
  read.

- **2026-11-17, B35's install sequence, +2 (`preserve-manual-memoization`
  78 -> 80).** No correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1,
  `no-unescaped-entities` 15), and `no-unused-vars` came back to its baseline
  35 after a fix, below.

  Attributed by the multiset diff of flagged SOURCE-LINE TEXT, which printed
  exactly two lines and no noise:

  - `const installSequence = useMemo(() => {` — **the memo call itself**.
  - `stories.length,` — an already-flagged value **in that memo's own dep
    array**.

  So this is the 2026-11-02 Derivation Sheet's pattern rather than the
  2026-11-15 one: the `useMemo` call CAN flag on its own, and then it costs one
  more per already-flagged dep it touches. Worth holding both notes together —
  *"a memo costs one per already-flagged value its dep array touches"* is the
  reliable half; whether the call line itself flags depends on what the memo
  closes over.

  ⚠ **Two OTHER new memos in the same change cost nothing** —
  `installNumberByKey` (deps `[installSequence]`) and
  `wallInstanceDirectionByName` (deps `[allInstances]`). One clean dep each.
  And so did everything else in a large change: three new modules outside
  `apps/web`, a new local module and its tests, a rendered chip with its CSS,
  a new CSV column, and **six fabrication-sheet call sites** rewired.

  ⚠ **`no-unused-vars` read 37 for one run, and that was a real fix rather
  than an exception.** The two were `InstallPhase` and `InstallSequenceItem`,
  type imports in `page.tsx` that went dead the moment the item-building logic
  was extracted into `installSequenceItems.ts`. Removing them took `page.tsx`
  from 16 to 14 in a single-file run, i.e. the whole-app count back to 35.
  **An unused import is sometimes a missing feature and sometimes a leftover;
  this one was a leftover, and the extraction is why.**

  ⚠ **AND THE GATE MISSED EVERY REAL DEFECT IN THIS CHANGE, for the third time
  in two days.** All four of B35's ordering faults — roof panels numbered with
  the floor deck, the gable row numbered backwards, the truss plates out of
  clockwise, the deck and tilted rows scrambled — passed `tsc`, `vitest` AND
  lint, and were found by reading 86 numbered chips off a shop packet **in the
  browser**. They were invisible because the logic lived inside a `useMemo`.
  It is now its own module with its own tests. **If a `useMemo` is deciding
  something a person could be wrong about, it is in the wrong place.**

- **2026-11-16, the corner mitre's girt row and nailer: ZERO delta.**
  183 / 136 / 47, every rule byte-identical again
  (`preserve-manual-memoization` 78, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **A new Review Log entry cost NOTHING, and the reason is reusable: it went
  INTO AN EXISTING MEMO rather than beside it.** The corner-panel
  no-girt-row entry was added to `gableMitreRefusedReviewEntries`, whose dep
  array grew three values — `isSquareBalePanelization`, `wallPlanMitreByWallId`
  and `heightIn` — and **none of the three is itself flagged**, so the rule
  from 2026-11-15 holds for a sixth time: one per already-flagged value a dep
  array touches, nothing otherwise. Compare the gable's own entry a few hours
  earlier, which cost +1 only because it needed `gableEaveHeightIn`. **Adding
  to a memo you already pay for is the cheapest shape there is**, and here it
  was also the right one: the two entries are the same finding one story apart
  and belong next to each other in the log.

  ⚠ **AND THE GATE AGAIN DID NOT CATCH THE REAL DEFECT**, for the second time
  in a day on this same feature. All three gates passed on a build where the
  app's own 15½in corner panel had **two girt bars 2.482in inside each other**
  — because every test built a 25½in panel (`COLUMN_TOTAL_WIDTH_IN`, the
  COLUMN's width and one a corner panel never has). **The browser's Review Log
  named it in one line.** Open the preview on anything that touches the
  catalogue's shared builders, and check it at the size the app EMITS, not the
  size the constant is named after.

- **2026-11-16, proposals (stride C): ZERO delta.** 183 / 136 / 47, every rule
  byte-identical to the corner-mitre run earlier the same day
  (`preserve-manual-memoization` 78, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ Worth recording for the size of it: three API routes, a server component,
  **two new client components**, a display module, three test files, and two
  props threaded through `HomePage` and `page.tsx` — and not one flag moved.

  ⚠ **Why, and it is reusable:** neither new client component has an EFFECT
  at all. `SendAsProposal` and `AdoptProposal` are `useState` plus event
  handlers, so `set-state-in-effect` cannot rise and there is no dep array to
  touch an already-flagged value. The server component has no hooks. That is
  the same rule from the 2026-11-15 entries read from the other side: the
  budget is spent by `useMemo`s and by what their dep arrays touch, and a
  component that memoises nothing is free however much it does.

- **2026-11-16, the gable row's 22½° corner mitre, +1.**
  `preserve-manual-memoization` 77 -> 78 (**183 / 136 / 47** against the
  dual-bevel run's 182 / 135 / 47). Every other rule byte-identical and no
  correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, `no-unused-vars` 35,
  `no-unescaped-entities` 15).

  One line, **`page.tsx:12567`** — `gableEaveHeightIn` in the dep array of the
  new `gableMitreRefusedReviewEntries` memo. The rule from 2026-11-15 holding a
  fifth time: one per already-flagged value a dep array touches, nothing for
  the memo itself. Its other five deps (`allInstances`, `thicknessIn`,
  `gablePlanMitreByTile`, `includeNailer`, `girtStyle`) cost nothing.

  ⚠ **A whole new `useMemo` cost ZERO again** — `gablePlanMitreByTile`, over
  `[footprint, gableTilesByWallId, thicknessIn]`. Same shape as
  `trueGableEndWallIds` on 2026-11-15: its deps are state and other memos that
  are not themselves flagged, so the memo is free no matter how much work it
  does. And the rest of the change — a new geometry export, a new catalogue
  module, a rewritten girt row, a prop threaded through two components, a plan
  shear on a 3D mesh and two new test files — measured zero.

  ⚠ **THE CHEAP BISECT WORKS AND IS WORTH THE TWO MINUTES.** Linting
  `app/page.tsx` ALONE reproduced this rule's count exactly (**77** at HEAD,
  78 with the change), and the whole-app run confirmed all 78 are in that one
  file. Method, which is the 2026-11-15 note's own and has now been used
  twice without a phantom:

  ```
  cp apps/web/app/page.tsx <scratchpad>/page_new.tsx
  git checkout HEAD -- apps/web/app/page.tsx
  (cd apps/web && node --max-old-space-size=6144 ../../node_modules/eslint/bin/eslint.js app/page.tsx -f json > base.json)
  cp <scratchpad>/page_new.tsx apps/web/app/page.tsx
  ```

  then resolve each run's flagged line numbers against ITS OWN file, sort the
  resulting source-line TEXT, and `diff`. Here that printed exactly one added
  line, `gableEaveHeightIn,` — and because that text occurs four times in the
  file, the last step is to go back to the JSON and find which of the four
  line numbers is new. Three were already flagged (8416, 8655, 12257); 12567
  is the new memo.

  ⚠ **The whole-app run took ~15 minutes twice and produced a ZERO-BYTE file
  both times when a dev server was running beside it.** ESLint only writes the
  JSON at the end, so 0 bytes mid-run is normal — but at 6144 with Next's dev
  server competing for memory it never finished. Stop the preview server
  first. A good run's stderr is still the one benign Babel note.

- **2026-11-15, the octagon's roof meeting its walls, +2.**
  `preserve-manual-memoization` 74 -> 76. Every other rule byte-identical, no
  correctness rule moved (`exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, `no-unused-vars` 35).

  Both are the one new `gableWallRoofTops` memo — the `useMemo` itself and its
  dep array `[footprint, roofProfilePointHeightsFt, gableStructuralPanelWallIds,
  gableEaveHeightIn]`. Nothing else in the change moved a single flag, which is
  worth knowing given how much of it there was: a new geometry module, a
  widened gable-wall set, a new seeder parameter and three rewritten call
  sites all cost **zero**. The budget is spent by memos, not by code.

  ⚠ **And not by every memo.** A SECOND memo added in the same change —
  `trueGableEndWallIds`, over `[footprint, gableEndWallIds]` — measured
  **76 again, free**. Both of its deps are plain `useState` values, where
  `gableWallRoofTops` depends on `gableStructuralPanelWallIds` and
  `roofProfilePointHeightsFt`. That is the rule from the ridge-beam note
  holding a third time: **the cost is one per ALREADY-FLAGGED value a dep
  array touches, and nothing for the memo itself** — so a memo over raw state
  is free no matter how much work it does.

  ⚠ **AND THE ATTRIBUTION METHOD ABOVE HAS A TRAP THAT CAUGHT ME.** "Diff the
  flagged SOURCE LINE TEXT" is right, but the OLD run's line numbers have to be
  resolved against the OLD FILE, which by then is no longer on disk. Resolving
  them against the edited file reported **60-odd phantom new entries** and
  buried the two real ones. Get the old text out of git first:

  ```
  git show <commit>:apps/web/app/page.tsx > old.tsx
  ```

  then read each old message's line from `old.tsx` and each new one from the
  working file. Done that way the delta here came out as exactly two lines,
  both in the new memo, and no noise at all.

  ⚠ **How to bisect this rule cheaply, which was the real find.** The
  whole-app run takes ~10 minutes, but linting **`app/page.tsx` alone**
  finishes in about a minute and reproduces this rule's count exactly
  (62 at `d3dfff8`). The warning further up about a single-file run taking
  over ten minutes was at 4GB; at 6144 it is fast. Copy `page.tsx` aside,
  `git checkout HEAD -- app/page.tsx` to confirm the baseline, then put
  changes back in groups.

- **2026-11-21, the roof bracing's 3D members: ZERO delta.** **188 problems**,
  141 errors / 47 warnings, every rule byte-identical
  (`preserve-manual-memoization` 83, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ The change adds **one file to `apps/web`** — a test — and it carries no
  flags of its own, so the rule from the 2026-11-18 entries holds again: the
  budget is spent by `useMemo`s and by what their dep arrays touch, and
  nothing here is a memo. The rest of the stride is in
  `packages/panel-catalog`, which this gate never lints.

  ⚠ **THE END-TO-END TEST IS IN `apps/web` BECAUSE NO PACKAGE CAN HOLD IT, and
  that is worth reaching for deliberately.** The roof bracing figure lives in
  `@building-integrity/geometry`; the panel and its members live in
  `@building-integrity/panel-catalog`; neither depends on the other and
  neither should. `apps/web` is the first place both are in scope. **Both
  defects this stride found were defects of the JOIN** — every brace board
  buried inside both top joist chords (200 overlap pairs on one roof), and 80
  more inside an end lid because the figure was held back by a constant
  instead of by the panel's own geometry. Each package's own tests passed
  throughout, because each was right about its own half. When two leaf
  packages have to agree about a shape, the test for that agreement belongs
  here, and `overlappingMemberPairs` is what makes it cheap to write.

  ⚠ **AND WHEN THAT TEST HELPER TURNS OUT TO BE THE RECIPE, PROMOTE IT RATHER
  THAN COPY IT.** The next stride wired this bracing into the building, and
  the production code it needed was exactly the helper the test had grown:
  clear band, figure, snap, slice, members, in that order. It moved to
  `app/roofBracePlan.ts` and the test now calls it, so the app and the
  assertions cannot brace a run differently. A second copy would have been
  two recipes that agree today.

- **A FEATURE CAN CHANGE WHAT COUNTS AS A UNIQUE PART, and two tests will
  tell you by failing in ways that sound unrelated** (2026-11-21, roof
  bracing). Adding plane-wide bracing put the brace geometry into the deck
  panel group key — it had to, or a whole run would be fabricated from
  whichever panel grouped first. Consequences, both found only by running the
  suite: the 24x48 fixture's *"a handful of parts"* assertion went from under
  10 to 24, and an OCTAGON test that compared the cut roof's group count
  against the box roof's INVERTED, because the box roof is braced and the
  mitred one is refused bracing. The second is the instructive one: that
  assertion had been a proxy for *"the mitre splits parts"*, and a proxy
  stops measuring what it was written for the moment something else moves the
  same number. It now asserts the thing directly, against the panels' own
  widths and spans. **When a test fails on a count rather than a value, ask
  what the count was standing in for before you re-pin it.**

- **2026-11-22, the roof zigzag replacing the carrot: ZERO delta.** **188
  problems**, 141 errors / 47 warnings, every rule byte-identical
  (`preserve-manual-memoization` 83, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1). Verified as a tuple-level diff against the
  previous run's JSON rather than a count comparison: 0 added, 0 removed.

  ⚠ **The run before it was 191, and all three were avoidable.** See the
  lint-diff note above. A new module in `packages/` is not linted by this
  gate at all — only `apps/web` is — so `roofZigzagBracing.ts` contributed
  nothing either way.

- **2026-11-22, the roof brace's face: ZERO delta.** **188 problems**,
  141 errors / 47 warnings, every rule byte-identical
  (`preserve-manual-memoization` 83, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1). The only `page.tsx` edit was prose inside an
  existing Review Log note and an existing sheet paragraph — no new memo, no
  new dep, no new JSX — so zero was the expected answer and it was still
  measured rather than assumed. JSON 2,275,140 bytes against the previous
  stride's 2,274,942; stderr the one benign Babel `page.tsx` note.

  ⚠ **Dropping a now-unused PARAMETER is a lint-driven call, not a style
  one.** `roofBraceTopFaceClearZIn` stopped needing `panelDepthIn` once the
  slice moved to y=0. Leaving it would have been +1 `no-unused-vars` against
  a baseline of 35, so it came out of the signature and all five call sites
  changed with it.

- **2026-11-21, the girts dodging the bracing: ZERO delta.** **188 problems**,
  141 errors / 47 warnings, every rule byte-identical
  (`preserve-manual-memoization` 83, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1).

  ⚠ **A NEW `useMemo` COST NOTHING AGAIN** — `girtBraceDodgeReviewEntries`,
  over `[deckPanelTakeoff, unitSystem]`. Neither dep is itself flagged
  (`deckPanelTakeoff` is a memo but not a flagged one; `unitSystem` is plain
  state), so the 2026-11-15 rule holds once more: **the cost is one per
  ALREADY-FLAGGED value a dep array touches, and nothing for the memo itself.**
  A new paragraph of JSX on the deck sheet, a new field on the takeoff group
  and a corrected sentence in an existing entry all measured zero too.

- **A TEST THAT BUILDS ITS OWN OPTIONS CANNOT SEE THE WIRING, and a mutation
  run is what says so** (2026-11-21, the girt dodge). Deleting the one line in
  `deckPanelTakeoff.ts` that hands a roof panel its brace bands left **every
  test green**: the end-to-end brace test constructs `FloorRoofPanelOptions`
  itself, and the catalog's tests call the planner directly, so nothing was
  looking at the seam between them. The whole feature could have shipped
  unwired. The fix is a test that reads `group.options` off the REAL takeoff
  and then checks the consequence in the MEMBERS — not one that rebuilds the
  options and re-derives the answer. **Whenever a feature's value is "X now
  reaches Y", assert it on the object Y actually receives.**

- **An equivalent mutant is a result, not a gap — prove it by measurement**
  (same stride). `blockerOf` sorts the blocking bands by start, descending, and
  flipping that to ascending survived every test. It is not a hole: walking
  down one band at a time and jumping straight to the earliest blocker reach
  the SAME station, because any intermediate position a band leaves clear is
  one the earlier band already covered. Rather than argue it, both orderings
  were run over **4,000 random band sets and produced byte-identical
  stations**. Two vitest runs and a `diff`. Do that before either chasing a
  survivor with a new test or waving it away.

- **A mutant can HANG the suite, and a killed mutation script leaves the mutant
  in your tree.** One mutant here removed the pull-back's lower bound, which let
  the walk run its 4,096-iteration guard building girts into a panel; the run
  blew past ten minutes with its output buffered behind `| tail`. `TaskStop`
  killed it **before its `finally` restored the file**, and `const lowerBoundIn
  = -1e9;` was sitting in `floorRoofPanelMembers.ts` afterwards. Two habits:
  give `subprocess.run` a `timeout=` so a hang counts as caught, and **`git
  status` the tree after killing any script that edits files.**

- **A CENTRELINE IS NOT A BOARD, and a geometric argument about LINES has to
  be re-checked against the SOLID** (2026-11-22, the roof zigzag). The whole
  design rested on "an odd number of traverses per bay leaves the chain on the
  opposite joist, so no diagonal ever lands on a girt". True of the
  centrelines. False of the boards: a piece is `PLATE_2X4_WIDTH_IN` across, so
  each end's corners run `(width/2)/cos(angle)` — 2.14in at 36deg — further
  along the span than its endpoint does, straight into the girt. **24
  brace-against-girt pairs per group on the Tank, invisible to every
  centreline test.** Whenever a claim is about where lines meet, ask what the
  material around them is doing.

- **AN UNCONVERGED FIXED POINT READS AS A COLLISION** (same stride). The inset
  that holds a board off a girt depends on the angle and the angle on the
  inset, so it was iterated four times. That leaves a residual around 1e-5in,
  which sounds like nothing — and is not, because `overlappingMemberPairs`
  forgives a shared face only within **1e-6**. Every bay boundary reported an
  overlap, all of them **0.0000in deep**. Fixing n first and iterating the
  inset alone makes the map a contraction; it then lands on the exact flush
  butt the joint is supposed to be. **If a solver feeds a tolerance-based
  check, converge it rather than iterating a fixed count.**

- **DIFF THE LINT JSON, DO NOT EYEBALL THE COUNTS** (same stride). The gate
  came back 191 against a baseline of 188, all `no-unused-vars`. Two were real
  (an import the rewrite orphaned, a map callback's unused index). The third
  was **a temp probe file left behind in `apps/web/app`** — which had also
  been quietly inflating the test count. Counting per rule would never have
  found it; a `Counter` diff of the two runs' JSON named all three in one
  step, including the file that should not have existed. **Keep the previous
  run's JSON and diff (file, rule, message) tuples.**

- **A COMMENT CAN STATE THE DEFECT AS ITS PREMISE, and then every test agrees
  with it** (2026-11-22, the roof brace's face). Every roof brace board in
  this app was nailed to the panel's **INTERIOR** face for its whole life.
  The cause was one line whose own comment asserted the false bit: *"a roof
  panel's exterior face is the far one in depth, so this is measured back
  from `panelDepthIn`"*. It is not. **`yIn` is measured FROM the exterior
  face on every panel here** — `PanelMembersGroup`'s frame doc says
  *"Z=depth from its exterior face"*, the wall chevron documented *"on the
  exterior wythe"* is `yIn: 0`, and the floor's toe-up pair puts the exterior
  board at 0–3.5in against the interior one at 12–15.5in. A roof panel's own
  silhouette settles it too: the **y=0 edge runs the full span** while the
  y=depth edge is cut back at both ends, which is Tommy's *"top face is the
  long point"*.

  ⚠ **NO GATE COULD SEE IT, because every derived number is face-invariant.**
  The figure, the bay choice, the snap, the slicing, the cut lengths, the
  angles, the overlap counts, the weight and the price are all identical on
  either face — only which side of the panel the board is nailed to changed.
  Found by Tommy looking at the 3D view: *"diagonal roof bracing is appearing
  on the bottom/underside of the roof panels instead of the exterior/top"*.
  **Eleventh time he or the browser found what the three gates could not.**

  ⚠ **THE REUSABLE LESSON: when a comment and an assertion disagree, the
  COMMENT is the spec.** Three places pinned the wrong face while their own
  prose stated the right intent — a describe block named *"a 2x4 lying flat
  on the exterior face"* asserting `y0 = PANEL_DEPTH_IN - 1.5`; a comment
  reading *"its exterior face, which on a roof panel is the top"* sitting
  directly above `expect(...yIn).toBeCloseTo(group.options.depthIn - 0.75)`;
  and a test comment explaining a SURVIVING MUTANT by reciting the defect as
  fact (*"on every real roof the eave end's clear band is 0 at every
  width"* — true of the interior face, false of the exterior one). Prose that
  contradicts the number next to it is a defect report, not decoration.

  ⚠ **AND THE BLAST RADIUS WAS IN THE CONSEQUENCES, not the boards.** The
  clear band on the real top face is `2.37 .. 144.28` where the interior read
  `0 .. 144.28`, because the eave lid's face studs reach z 2.37 and nothing
  caps the interior face at the eave at all. That moved every bay boundary,
  so: the 48ft plane's before-count went 99→98 pairs, the dodge's girt bill
  went 12→15 / 29→30 / 123→122, and **the stuck-girt case went from reaching
  NO Home template to reaching five of nine** (the Multiplex alone has 16).
  A one-line face change is not a cosmetic change when anything downstream
  reads the panel's members to decide where to put something.

- **A literal space next to a JSX expression does not survive** (same stride).
  `{count} of this panel&apos;s ...` rendered as **"1of this panel's"** on the
  shop sheet — the text node came back with no leading space. `tsc`, `vitest`
  and lint all passed; only reading the page showed it. This file's own house
  pattern is `{" "}`, and the sturdier answer for a sentence built from a
  number is **one template literal** rather than JSX text wrapped around an
  expression. Ninth time the gates missed what the browser found.

  ⚠ **And the SAME paragraph had a second defect the browser found a few
  minutes later, which is the more useful one.** Its condition was
  `shiftedCount > 0 || crossesBraceCount > 0`, but its first sentence assumed
  shifting had happened — so a panel with a girt that had NOWHERE to move
  and none that did printed *"0 of this panel's anti-twist girts are NOT on the
  plain 5ft stride ... moved back by up to 0in"*. Three such panels on a
  40 x 20 peaked roof. **When a block is shown on `A || B`, every sentence in it
  must be true under A alone and under B alone** — or it wants two blocks. No
  test can see this: both sentences are prose, and the numbers behind them were
  already correct.

  ⚠ **Worth knowing HOW the second one was found, because the first attempt
  failed.** None of the eight Home templates reaches the stuck case; the one
  that does is the 40 x 20 peaked fixture from `deckPanelTakeoff.test.ts`. It
  was reached in the browser by drawing The Tank and typing into the Width and
  Depth dimension HANDLES — which are canvas-drawn, so `querySelector('input')`
  finds nothing until the handle is clicked, and then the textbox exists and
  `form_input` works on it. **If a test fixture exercises a branch no template
  does, build that fixture's building in the browser rather than trusting the
  branch.**

- **Lint does not work from a git worktree that has no root `node_modules`,
  and it fails in TWO different ways depending on how you invoke it.**
  `npm run lint --workspace=apps/web` from the worktree dies immediately
  with `MODULE_NOT_FOUND` (no `eslint` under the worktree's root
  `node_modules`). Pointing at the MAIN checkout's eslint binary with cwd
  inside the worktree does not fail — it **hangs**; a reviewer burned 40+
  minutes that way on 2026-09-29 with no output. Both end the same place:
  the gate unverified. Either `npm install` in the worktree, or run lint
  in the MAIN checkout against the merged tree, where it finishes in
  minutes. **Never restate a lint number you did not observe yourself** —
  say the gate is unverified instead.
- **A worktree's `node_modules` may hold only a `.vite` cache**, in which
  case `@building-integrity/*` resolves UP to the main checkout and your
  tests, typecheck and dev server all measure the *other* copy of the
  package — not your diff. Create junctions at
  `<worktree>/node_modules/@building-integrity/{geometry,calc-engine,panel-catalog}`
  pointing at the worktree's own `packages/*`, and verify before trusting
  any number you measure there.
- **The baseline, measured on `main` @ `ac55a39` (2026-09-29): 167 problems,
  119 errors / 48 warnings.** Compare against a fresh run of the base
  commit rather than trusting this figure as it ages. Re-measured on
  2026-11-01 @ `0a713cb`: **166 problems, 120 errors / 46 warnings**, per
  rule `exhaustive-deps` 12, `immutability` 1,
  `preserve-manual-memoization` 62, `purity` 1, `refs` 29,
  `set-state-in-effect` 12. Re-measured again later the same day @ `fb9bc2e`:
  **168 problems, 120 errors / 48 warnings** — every rule above unmoved, the
  two extra warnings both `no-unused-vars` in `projectFile.test.ts`, which
  grew by 49 lines over the commits in between. Worth keeping as the shape of
  this gate: a total that drifts while every rule that matters sits still.
  Re-measured 2026-11-02 after B16/B17/B20: **164 problems, 116 errors / 48
  warnings**, with `preserve-manual-memoization` down to 58 (B16 deleted two
  memos). After B18 it is **167 / 119 / 48** — see the recorded exception
  for the Derivation Sheet further up this list.
- **⚠ Do NOT read a value from `@building-integrity/panel-catalog` at MODULE
  SCOPE in `page.tsx`.** Turbopack splits `data.ts` into parts, and a value
  declared late in that very long file is not evaluated before this module's
  top-level code runs: it throws `ReferenceError: <name> is not defined` **at
  module evaluation**, which takes the whole page down. Measured 2026-11-01
  on `beamPriceRatePerSqFt` (declared ~line 900 of `data.ts`). It is a LOAD
  ORDER problem, not a missing export — `priceRates`, declared ~line 855 of
  the same file, resolves at module scope perfectly well, and `npx tsc
  --noEmit`, `vitest` and the lint gate all pass while the dev server 500s.
  Deleting `.next` does not help. **Read catalog values inside a function or
  a component**, where every other catalog read in the file already happens
  — see `phase2Assumptions()`, which was a `const` array until it quoted one.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

- **2026-11-16, the floor deck cut to the building: ZERO delta.** 181 / 134 / 47,
  every rule byte-identical to the 2026-11-15 baseline —
  `preserve-manual-memoization` 76, `no-unused-vars` 35, `refs` 29,
  `no-unescaped-entities` 15, `set-state-in-effect` 12, `exhaustive-deps` 12,
  `immutability` 1, `purity` 1.

  ⚠ Worth recording for the size of it: a new geometry module, a new option on
  the floor/roof panel builder, three rewritten member builders, a sheared 3D
  prism, a new group field and a new paragraph of JSX on the fabrication sheet
  — and **not one flag moved**. That is the rule from the 2026-11-15 entries
  holding again from the other side: **the budget is spent by `useMemo`s and by
  what their dep arrays touch, not by how much code there is.** This change
  added no memo at all.

  ⚠ **The one delta there WAS got fixed rather than recorded.** An intermediate
  run read `no-unused-vars` **36**: `floorRoofPanelCutLengthIn` imported into
  `deckPanelTakeoff.ts` and never called. It was a real omission, not a style
  nit — the panel's long point is the number a shop cuts to, and nothing was
  carrying it. It became `DeckPanelTakeoffGroup.cutLengthIn` and then a line on
  the fabrication sheet. **An unused import is sometimes a missing feature;
  check which before silencing it.**
- **⚠ LINE ENDINGS: this repo is LF, in the repository AND in the working
  tree, and `.gitattributes` now enforces it.** `* text=auto eol=lf`, with a
  guard test (`apps/web/app/lineEndings.test.ts`) that fails on any tracked
  file that goes mixed. Before that rule existed, `core.autocrlf=true` gave a
  CRLF working tree while every tool here writes LF unconditionally — bash
  heredocs, the scratchpad patch scripts, the OBJ exporter — so appending to
  a file left it **HALF AND HALF, with no warning at all.**

  Three ways it bit, all measured rather than imagined:

  1. **Patch scripts matched ZERO anchors.** They sniff the convention
     (`nl = "\r\n" if "\r\n" in s else "\n"`); a mixed file answers CRLF
     while the lines being targeted are LF. Two scripts in one hour.
  2. **Files drifted.** A script that picked CRLF rewrote the LF lines too,
     flipping a file a few lines at a time.
  3. **An unreviewable commit.** `page.tsx` once staged as **21,789
     insertions / 21,205 deletions for a 172-line change** — 21,315 carriage
     returns its parent did not have. Normalising to LF before staging turned
     the same change into 635/49. A diff like that destroys review and
     `git blame`.

  ⚠ **`git add --renormalize` DOES NOT FIX A CRLF-COMMITTED FILE, and that
  is documented git behaviour, not a misconfiguration.** `text=auto`
  deliberately leaves alone any file that was *committed* with CRLF, to avoid
  churn. It staged **nothing** here. The one such file
  (`WallElevationDiagram.tsx`, 3,013 CRLF lines in its blob) had to have its
  bytes rewritten and committed as an ordinary change. If the guard ever
  fails on a file whose BLOB is CRLF, renormalize will not help.

  ⚠ **`git checkout-index -a -f` does not convert an existing working tree
  either** — it skips files whose stat info looks current. A *fresh* checkout
  of a deleted file does come out LF, which is how that was confirmed. To
  convert in place, rewrite the bytes directly; the blobs are already LF, so
  nothing changes in git.

  ⚠ **AND `git status` WILL DISAGREE WITH `git diff` WHILE YOU DO IT.** After
  rewriting 338 files to LF, `git status` listed every one as ` M` and
  `git update-index --refresh` said "needs update" and exited 1 — while
  `git diff --name-only` reported **0**. The size changed, so the cached stat
  is stale, and changing `.gitattributes` forces a re-filter. **Trust the
  index hash, not the status letter**: `git hash-object --path=<p> -- <p>`
  against `git ls-files -s` settles it in one command. Here all 929 entries
  hashed identically, and `git add -u` only refreshed the cache.

  ⚠ **A doubled CR hides inside a mixed file and survives every gate.** Line
  18 of `WallElevationDiagram.tsx` ended `\r\r\n` — a CRLF-aware script
  writing `\r\n` onto a line that already ended in `\r`. In TypeScript a
  `\r` is whitespace, so it compiled, linted and tested clean, and no editor
  shows it. Found by counting bytes. The guard checks for it separately from
  mixed-ness for that reason.

  ⚠ **Do not stash or check out while a 15-minute lint run is in flight.**
  Doing it once here swapped two files underneath ESLint and made the run
  worthless; it had to be killed and repeated. Measure the gate on a tree
  that is not moving.
