# Prompt to paste into the Tip4urTime repo session

---

The Building Integrity panel app changed the shape of the panel CSV it exports
to you (2026-11-18). Two columns changed. Please update the importer, and add
tests.

**1. `Panel code` lost its `P-` prefix.** It used to be `P-0042`; it is now
`0042` — four digits, zero-padded, growing to five past 9999. It is still
unique within a project, still stable across exports, still ≤40 chars. The
reason is that this is no longer a private join key: it is now the one number
the app shows on every drawing and the shop paints on the panel, and the shop
has no hyphen stencil.

⚠ **This needs a normalisation rather than a straight swap.** A project
exported before today is stored on your side as `P-0042`, and the app will
re-export that same panel as `0042`. Joined naively, every existing panel would
look like a brand-new panel and its crew claims would be orphaned. **On import,
strip a leading `P-` from the code before matching, and migrate any codes
already stored with the prefix.** (Likely zero real rows today, but the fix is
cheap and the failure is somebody's pay.)

**2. The last column is renamed `Install no` → `Install step`, and its value is
now a plain integer.** It used to be `"0042"`, zero-padded like a code; it is
now `42`, or blank for an item the sequence does not place. It means "step 42
of N" in the install order — from the point of least accessibility, clockwise,
out to in, bottom to top.

⚠ **The padding was removed deliberately and it matters to you.** Two
zero-padded four-digit numbers sat on the same row meaning opposite things, and
there was nothing on the row to tell them apart. **Join on `Panel code`. Sort
by `Install step`.** Swapping those two roles is the mistake that would cost
somebody money — `Install step` renumbers whenever the design changes, the code
never does.

**Unchanged:** every other column, the column order (the step is still last),
the two preamble rows (`Project,<name>` then `Project ID,<id>`), one row per
physical panel, no BOM, and `Label` (`N3`, `F12`) — which is a human locator
that is *allowed* to move, not an identity.

Full header row now:

```
Panel code,Panel type,Label,Width (in),Height (in),Sq ft,Counts as panel,Install step
```

Please also check whether anything on your side parses or displays the code as
`P-…` (a label, a search, a regex, a sort) and fix those too.
