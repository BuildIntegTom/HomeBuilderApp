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
