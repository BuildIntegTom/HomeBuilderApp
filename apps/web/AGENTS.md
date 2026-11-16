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
