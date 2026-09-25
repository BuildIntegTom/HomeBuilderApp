# Browser harness — Project Smearforn, Stage 2

Drives the **insert / replace / delete** tool against a real dev server in a
real browser over CDP, and asserts. Same shape and same plumbing as
`../smearforn-stage-0-1`, including its rule that **every step must carry an
expectation** — `record()` throws without one, and the process exits non-zero
if any expectation is false.

## Run it

Three things, from the repo root:

```
npm run dev --workspace=apps/web -- -p 3213
chrome --headless=new --remote-debugging-port=9447 --user-data-dir=<a temp dir> about:blank
node apps/web/harness/smearforn-stage-2/run.mjs
```

Override with `SMEARFORN_APP_URL` / `SMEARFORN_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`.** Over `127.0.0.1` the client chunks for
the `next/dynamic` canvas never arrive and the page renders its chrome with no
canvas at all, silently — the Stage 0/1 harness's README explains it at
length; it is the same trap here.

## What it checks

| step | what it asserts |
|---|---|
| `wall-as-tiled` | a wall really drew, with panels to count and eighths to sum |
| `tool-armed` | arming a type draws the insert targets AND stands the panel-boundary drag strips down |
| `insert` | one more panel, and the wall's own total is conserved to the eighth |
| `replace` | a type changed; the count and the wall's length did not |
| `delete` | one fewer panel, total still conserved |
| `rule-placed-panel-refuses` | clicking the safety gap with Delete armed is refused in those words and changes nothing |
| `refused-insert-states-the-room` | an 8ft Big Header into a full wall is refused **with the actual free width stated** |
| `no-uncaught-exceptions` | nothing threw in the page all run |

Screenshots land in `./screenshots`, measurements in `./evidence.json`.

## Two things that cost a run each, written down

- **`panelBodies` must not be "the first `<svg>` that contains a `<text>`."**
  The compass widget is an svg with text in it and it comes first in the DOM,
  so that selector found a compass and reported zero panels — which looks
  exactly like "delete did nothing."
- **Arming a tool has to be verified, not assumed.** The left bar scrolls; a
  button below the fold means a click that lands somewhere else, and every
  step afterwards silently exercises the *previous* tool. `armTool()` scrolls
  the button in, clicks, reads `aria-pressed` back — and then scrolls the
  elevation back into view, because scrolling the button in can take the
  drawing off screen.

## Which corner? None, on that wall

The rule-placed step clicks the **safety gap**, not a corner. On a plain
rectangle the corner panels are attributed to one pair of opposite walls, so
the wall this run happens to open may own no corner at all — the first version
of this step clicked the leftmost panel, deleted a perfectly ordinary standard
panel, and failed. Every wall over 12ft has a gap, and the gap refuses for the
same reason and in the same words.
