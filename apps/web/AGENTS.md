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
