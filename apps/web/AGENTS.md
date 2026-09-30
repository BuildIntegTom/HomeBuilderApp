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
  commit rather than trusting this figure as it ages.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
