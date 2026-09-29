/**
 * Browser harness — Project Smearforn, Stages 0 and 1.
 *
 * **This lives in the repo on purpose.** The 4B and 4C harnesses sat in a
 * scratch directory outside it, so a reviewer could not read them and their
 * results had to be taken on trust. Everything here — the script, the
 * screenshots it writes and the measurements it records — is checked in and
 * re-runnable.
 *
 * What it drives, against a real dev server in a real browser:
 *   1. a new project opens with the Wall tab only (Stage 0's default)
 *   2. typing a width on a standard panel (Stage 1)
 *   3. the refusal below the 24in fabrication minimum
 *   4. the panel-boundary drag landing on the 1/8in grid
 *   5. per-panel reset back to automatic
 *   6. every Rogers-Sehorn ADU width typed into the real field, in sequence
 *
 * HOW TO RUN (two terminals, from the repo root):
 *   1. `npm run dev --workspace=apps/web -- -p 3210`
 *   2. launch Chrome with a debugging port, e.g.
 *      `chrome --headless=new --remote-debugging-port=9444 --user-data-dir=<temp> about:blank`
 *   3. `node apps/web/harness/smearforn-stage-0-1/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`.** Next 16's dev server serves the HTML
 * either way, but over 127.0.0.1 the client chunks for a `next/dynamic`
 * component never arrive: the page renders its chrome and the Konva canvas
 * simply never appears (the suspense boundary is left in its errored state,
 * `<!--$!-->`, with no console exception at all). That cost an hour; it is
 * written down so it costs nobody else one.
 *
 * Screenshots land in ./screenshots, measurements in ./evidence.json.
 *
 * **THIS SCRIPT ASSERTS. It did not always.** The first version ended in an
 * unconditional `process.exit(0)` and every `record()` call merely wrote what
 * it saw into `evidence.json`, so a refused ADU width — or
 * `nothingBelowTheMinimum: false` — exited GREEN with the failure sitting in a
 * file for a human to notice. A reviewer named that as the same shape as the
 * `.value` bug: a check that cannot fail. So `record()` now takes an
 * expectation, and the process exits non-zero if any of them is false.
 *
 * `record()` REFUSES to run without one. A step that genuinely only observes
 * has to say so out loud, with a reason, via `observationOnly("why")` — which
 * is how "this one cannot fail" stays a deliberate, reviewable decision rather
 * than the default.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeViewStopControl } from "../viewStopControl.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.SMEARFORN_APP_URL ?? "http://localhost:3210/";
const CDP_PORT = process.env.SMEARFORN_CDP_PORT ?? "9444";

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, ranAt: new Date().toISOString(), steps: [] };
const failures = [];

/**
 * Marks a step as deliberately unasserted. The reason is REQUIRED and is
 * written into evidence.json, so "this one only watches" is a decision a
 * reviewer can read and argue with, not an omission they have to spot.
 */
const observationOnly = (why) => ({ observationOnly: why });

/**
 * Writes what the step saw, checks it against `expected`, and remembers the
 * failure. Every call must pass either a predicate over the detail object or
 * `observationOnly("reason")`; passing neither throws immediately, which is
 * what stops a future step from quietly joining the harness without an
 * expectation.
 */
const record = (name, detail, expected) => {
  const isObservation = expected !== null && typeof expected === "object" && typeof expected.observationOnly === "string";
  if (typeof expected !== "function" && !isObservation) {
    throw new Error(
      `record("${name}") was given no expectation. Pass a predicate over the detail, ` +
        `or observationOnly("why this step cannot fail").`,
    );
  }

  let passed = null;
  let expectationError = null;
  if (typeof expected === "function") {
    try {
      passed = expected(detail) === true;
    } catch (err) {
      // A predicate that throws (e.g. reading a field off a null the step did
      // not produce) is a FAILED check, never a passed one.
      passed = false;
      expectationError = String(err && err.message ? err.message : err);
    }
    if (!passed) failures.push(name);
  }

  evidence.steps.push({
    name,
    ...detail,
    ...(isObservation ? { asserted: false, observationOnly: expected.observationOnly } : { asserted: true, passed }),
    ...(expectationError ? { expectationError } : {}),
  });
  const verdict = isObservation ? "observed" : passed ? "PASS" : "FAIL";
  console.log(`  [${verdict}] ${name}: ${JSON.stringify(detail)}`);
};

/** Both halves of a number the app might render as `41½` or as `34.125`. */
const asInches = (text) => {
  const map = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
  const m = String(text).match(/^(-?\d+(?:\.\d+)?)\s*([½¼¾⅛⅜⅝⅞])?/);
  return m ? Number(m[1]) + (m[2] ? map[m[2]] : 0) : NaN;
};

const FABRICATION_MIN_IN = 24; // fabricationMinPanelWidthIn, confirmed (Tommy)

/**
 * evidence.json is written on the way out WHATEVER happened, including when a
 * step throws part-way: a run that died at step 6 is still evidence about
 * steps 1-5, and losing it was the old script's second-worst habit.
 */
let evidenceWritten = false;
const writeEvidence = () => {
  if (evidenceWritten) return;
  evidenceWritten = true;
  fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log("\nevidence -> evidence.json");
};
process.on("exit", writeEvidence);

// --- CDP plumbing -----------------------------------------------------------
const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = (await send("Target.createTarget", { url: "about:blank" })).result;
const { sessionId: sid } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;
await send("Page.enable", {}, sid);
await send("Runtime.enable", {}, sid);

/**
 * `SMEARFORN_CPU_THROTTLE=20` slows the page down by that factor.
 *
 * **This is how the wall-walk flake is reproduced on demand**, and it exists
 * because the flake could not be reproduced any other way: it failed about
 * one run in three on two reviewers' machines and zero runs in five here,
 * including with the whole vitest suite running alongside. A timing fix that
 * cannot be shown to fix anything is a guess, so the timing is made
 * controllable instead. Unset, this is a no-op and the run is unchanged.
 */
const CPU_THROTTLE = Number(process.env.SMEARFORN_CPU_THROTTLE ?? "1");
if (CPU_THROTTLE > 1) {
  await send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE }, sid);
  console.log(`  (CPU throttled ${CPU_THROTTLE}x — reproducing a loaded machine)`);
  evidence.cpuThrottle = CPU_THROTTLE;
}

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 120));
  return res.result.result?.value;
};

const shot = async (name) => {
  const png = await send("Page.captureScreenshot", { format: "png" }, sid);
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(png.result.data, "base64"));
  console.log(`  screenshot -> screenshots/${name}.png`);
};

const mouse = (type, x, y, extra = {}) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: type === "mouseMoved" ? 1 : 1, ...extra }, sid);

const click = async (x, y) => {
  await mouse("mousePressed", x, y);
  await sleep(60);
  await mouse("mouseReleased", x, y);
  await sleep(350);
};

const typeText = async (text) => {
  for (const ch of text) {
    await send("Input.dispatchKeyEvent", { type: "char", text: ch }, sid);
    await sleep(15);
  }
};

const pressKey = async (key, code, windowsVirtualKeyCode) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode }, sid);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode }, sid);
  await sleep(400);
};

// --- the run ----------------------------------------------------------------
console.log("1. loading the app");
await send("Page.navigate", { url: APP_URL }, sid);
// Scaled by the throttle: a fixed 9s is plenty unthrottled and nowhere near
// enough at 12x, where the app had not finished its first render before step
// 1 read the nav and the run died before recording anything at all. That
// looked like "12x is simply too slow to test at"; it was this one sleep.
await sleep(9000 * Math.max(1, Math.round(CPU_THROTTLE / 2)));

/**
 * The view control, and — since the two axes merged — the scope control too.
 *
 * ⚠ IT HAS MOVED TWICE IN ONE DAY, AND THIS HARNESS NEVER KNEW THE WIDTH. U1
 * (2026-09-28) made the sidebar dial the below-breakpoint form and put Design
 * and View menus on the top bar above it; later the same day Tommy removed the
 * dial outright and folded the four editor tabs into the Design menu. This
 * harness does not set a viewport width — it takes whatever Chrome was launched
 * with — so locators written against either control directly would have
 * returned null SILENTLY. The shared driver next door reads what is on screen
 * and throws with what it saw when it cannot get somewhere.
 */
const view = makeViewStopControl({ evaluate, sleep });

/* Stage 0: a brand-new project has Floor, Roof and Foundation OFF.
   ⚠ THIS USED TO COUNT THE BAR'S NAV TABS. They were removed on 2026-09-28
   when Tommy merged the two axes, so the subjects are groups inside the Design
   menu — and the old reader, which fell back to `document.body` when it found
   no `<nav>`, would have returned an empty list and failed while looking like
   Stage 0 having broken. It reads the merged menu now, through the shared
   driver, which throws if that menu is empty rather than reporting a scope of
   nothing. Same claim, same default, read where the user now reads it. */
const scopeSubjects = await view.subjectsOffered();
record("stage0-new-project-tabs", { scopeSubjects }, (d) => d.scopeSubjects.length === 1 && d.scopeSubjects[0] === "wall");
await shot("00-stage0-new-project-wall-only");

// Panelizer: the four scope checkboxes, Foundation among them and unchecked.
const panelizerScope = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Project'));
  return btn ? 'project-menu-found' : 'no-project-menu';
})()`);
record("panelizer-probe", { panelizerScope }, (d) => d.panelizerScope === "project-menu-found");

console.log("2. drawing a footprint");
const canvasBox = await evaluate(`(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
if (!canvasBox) throw new Error("no canvas — are you on localhost rather than 127.0.0.1?");
const [cx, cy, cw, ch] = canvasBox;
/**
 * `SMEARFORN_FOOTPRINT_PX=70` or `=70x400` draws a footprint of that pixel
 * size instead of filling the canvas.
 *
 * **This is the fixture that produces a STRIP-LESS WALL**, and it is in the
 * harness rather than in a reviewer's notes because it is the only way to
 * meet the bug that took three locators down. At 70px wide, the short wall
 * tiles as `corner / one standard / corner` — no two ADJACENT standard
 * panels, therefore no drag strip, therefore invisible to every reader that
 * rooted on one. Measured on this app at 70x70: wall AB reads
 * `dragStrips: 0`, old reader **0** labels, new reader **1** (a 45in panel),
 * while every other wall reads 2 and 2.
 *
 * **`70x300` is the whole-run fixture; `70` alone is a probe.** A 70x70
 * square makes every wall about 8ft, and step 7 types the Rogers-Sehorn
 * schedule (up to 48in) into a 55in run — it would be refused for a real
 * reason that has nothing to do with what is being tested. At 70x300,
 * measured on this app: **AB and CD are strip-less** (`dragStrips: 0`, old
 * reader **0**, new reader **1**) while **BC and DA carry 5 panels and 2
 * strips**. So the run settles on a wall it can drag, steps 4-9 have room,
 * and step 10's walk has to read two walls that the old reader could not see
 * at all — which is the whole fix, end to end, in one run.
 *
 * ⚠ The height is bounded by the CANVAS, not by the window: at 1600x1000 the
 * canvas is 720x480 and the draw starts 80px down, so `70x400` ends exactly
 * on its bottom edge and **no footprint is drawn at all** — the run then
 * reports no elevations and looks like a dial failure. Keep it under ~380.
 *
 * ⚠ **Step 9 is expected to fail on this fixture, and that is the fixture's
 * limit rather than a regression.** The drag moves the cursor a fixed 4.31px
 * because at the default footprint's zoom that is "a couple of inches"; on a
 * 16ft wall the same pixels are a fraction of an inch, the boundary snaps
 * back to the eighth it started on, and `somethingActuallyMoved` is false.
 * Expected result here: **steps 1-8 and 10 pass, step 9's two checks fail.**
 * The drag is proven on the default footprint, which is what the checked-in
 * evidence is from.
 *
 * Unset, the run draws the same canvas-filling rectangle it always did.
 */
const FOOTPRINT_SPEC = process.env.SMEARFORN_FOOTPRINT_PX ?? "";
const [specW, specH] = FOOTPRINT_SPEC.split("x").map((n) => Number(n));
const footprintW = Number.isFinite(specW) && specW > 0 ? specW : 0;
const footprintH = Number.isFinite(specH) && specH > 0 ? specH : footprintW;
const x0 = cx + 60;
const y0 = cy + 80;
const x1 = footprintW > 0 ? x0 + footprintW : cx + cw - 80;
const y1 = footprintH > 0 ? y0 + footprintH : cy + ch - 120;
if (footprintW > 0) {
  console.log(`  (drawing a ${footprintW}x${footprintH}px footprint — the strip-less-wall fixture)`);
  evidence.footprintPx = `${footprintW}x${footprintH}`;
}
await mouse("mousePressed", x0, y0);
await sleep(80);
await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
await sleep(80);
await mouse("mouseMoved", x1, y1);
await sleep(80);
await mouse("mouseReleased", x1, y1);
await sleep(1200);
await shot("01-footprint-drawn");

/**
 * The current stop, e.g. "Elevation: North (AB)".
 *
 * **Read off the control, rather than inferred from what is on screen.** An
 * early version of the wall walk identified a wall by the set of width labels
 * it could see — and `panelWidthLabels` filters to labels actually ON SCREEN,
 * so panning between stops changed the set without changing the wall, and four
 * views of ONE wall were counted as four walls. It reported `wallsWalked: 4`
 * and proved nothing. Ask the control what it is showing.
 */
const currentViewLabel = async () => await view.currentLabel();

console.log("3. opening a wall elevation");
// The cycle is plan -> each wall's elevation -> the three 3D stops, in that
// order, on the dial and in the Design/View menus alike.

/**
 * Steps the dial until it reaches a wall elevation THIS RUN CAN USE, which is
 * two separate questions that used to be one.
 *
 * **⚠ "Is this an elevation?" and "can I drag on this wall?" are not the same
 * question, and conflating them is the same defect as the wall walk's.** This
 * used to be `rect[style*="ew-resize"].length > 0` — one drag strip anywhere
 * — which silently means "a wall with two ADJACENT standard/braced panels". A
 * wall whose middle is a single panel between two corners has none, so it
 * read as "not an elevation" and the walk stepped straight past it; the run
 * then did steps 4-9 on a different wall than the one it had reached, and
 * reported nothing about it. It is also part of what looked like a
 * window-size problem in review ("could not reach a wall elevation").
 *
 * Now the dial's own label answers the first question, and the strip count
 * answers the second **as an explicit requirement of step 9, which drags** —
 * not as a definition of "elevation". When no wall satisfies it, the error
 * says which half failed instead of blaming the viewport.
 */
let reached = null;
for (let i = 0; i < 8 && reached === null; i++) {
  const stop = await view.step();
  await sleep(700);
  if (typeof stop !== "string" || !stop.startsWith("Elevation:")) continue;
  const dragStrips = await evaluate(`document.querySelectorAll('rect[style*="ew-resize"]').length`);
  // Steps 4-8 need a panel to select; step 9 needs two adjacent ones to drag
  // between. A wall with a strip always has both.
  if (dragStrips > 0) reached = { view: stop, dragStrips };
}
if (reached === null) {
  throw new Error(
    "no wall elevation this run can use: the dial either never reported an 'Elevation:' stop, or every wall it " +
      "offered has no two ADJACENT standard/braced panels for step 9's drag. Not a viewport problem — check the " +
      "footprint the run drew.",
  );
}
console.log(`  working on ${reached.view} (${reached.dragStrips} drag strips)`);

/**
 * How many real inches one screen pixel is worth on the elevation right now.
 *
 * ⚠ **THIS USED TO BE A CONSTANT IN A COMMENT, AND THAT IS WHY IT IS A
 * FUNCTION NOW.** The drags below moved the cursor by hard-coded pixel
 * distances (4.31px "a couple of inches", 90.9px "past the 24in floor")
 * chosen against the drawing's size on 2026-09-24, when a wall elevation
 * rendered a few hundred pixels wide whatever the window. On 2026-09-29 the
 * elevation started fitting the editor's height and scrolling its length, so
 * the same pixel distance is now worth a small fraction of the inches it
 * used to be — a floor drag calibrated in pixels would simply stop reaching
 * the floor, and would have failed looking like a drag bug.
 *
 * So the harness measures the scale instead of assuming it: the SVG's own
 * viewBox width against its real rendered width gives internal-px per
 * screen-px, and the elevation's internal scale is 1.6px per inch (uniform
 * on both axes since 2026-09-29 — it is that uniformity the drag maths
 * depends on, and step 9c is what proves it).
 */
const ELEVATION_PX_PER_IN = 1.6;
const inchesPerScreenPx = async () =>
  await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label^="Elevation view of wall"]');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const vbWidth = Number((svg.getAttribute('viewBox') || '').split(' ')[2]);
    if (!(r.width > 0) || !(vbWidth > 0)) return null;
    return (vbWidth / r.width) / ${ELEVATION_PX_PER_IN};
  })()`);

/**
 * A view button's centre, by the START of its `title`, **re-read every time
 * and required to be on screen**.
 *
 * ⚠ Three separate things this got wrong in one run, all of the same family:
 *  - Matching the WHOLE title: Reset's title gained a description of what it
 *    resets to, so a whole-string match went null and the click silently did
 *    not happen.
 *  - Caching the coordinates: the pan/zoom row's position moves down the
 *    sidebar once a panel is selected and the Selected Panel note appears, so
 *    coordinates captured at step 3 press empty space at step 9 — and a
 *    press on empty space fails by doing nothing.
 *  - Taking the first match: since 2026-09-29 these controls exist TWICE
 *    (the sidebar copy and the copy docked over the drawing). The sidebar
 *    copy can be scrolled out of its own scrolling panel; the docked one
 *    cannot. So the on-screen one is preferred, and if neither is reachable
 *    this THROWS rather than returning a coordinate that hits nothing.
 */
const viewButton = async (titlePrefix) => {
  const found = await evaluate(`(() => {
    const bs = [...document.querySelectorAll('button')].filter((x) => (x.title || '').startsWith(${JSON.stringify(titlePrefix)}));
    if (!bs.length) return null;
    const boxes = bs.map((b) => b.getBoundingClientRect());
    const i = boxes.findIndex((r) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth);
    if (i < 0) return { count: bs.length, onScreen: false };
    return { count: bs.length, onScreen: true, xy: [boxes[i].left + boxes[i].width / 2, boxes[i].top + boxes[i].height / 2] };
  })()`);
  if (!found) throw new Error(`no button whose title starts with "${titlePrefix}"`);
  if (!found.onScreen) throw new Error(`${found.count} button(s) titled "${titlePrefix}" but none on screen`);
  return found.xy;
};
/** Click a view button, re-reading where it is at the moment of the click. */
const clickViewButton = async (titlePrefix) => {
  const xy = await viewButton(titlePrefix);
  await click(xy[0], xy[1]);
};

// Zoom the elevation in, so the drag below has enough pixels per inch to land
// somewhere interesting. (Before 2026-09-29 this was load-bearing: at 100% on
// a 48ft wall one pixel was about two inches and every drag landed inside the
// ±2in snap window around the floor. The fitted view is already far finer than
// that, but the zoom is kept — it exercises the zoom path, and step 9c below
// deliberately compares a drag at this zoom against one at the fitted 100%.)
for (let i = 0; i < 3; i++) await clickViewButton("Zoom in");
await sleep(500);
await shot("02-wall-elevation");

/**
 * Every clickable panel WIDTH LABEL on the elevation, with its own box.
 *
 * The label is the selection gesture (Tommy: "click the numerical value of
 * width of one panel") — clicking the panel's body runs the type cycle
 * instead, which from a standard panel produces a window.
 *
 * **⚠ The third locator in this file with the same root cause, fixed with
 * the other two rather than after them.** It used to start from
 * `svg rect[style*="ew-resize"]` — the panel-boundary drag strips — exactly
 * as `allElevationWidths` and the elevation-readiness check did, so on a wall
 * with no two ADJACENT standard/braced panels it returned `[]` and steps 4-8
 * (select a panel, type a width, the refusal, the eleven ADU widths, the
 * per-panel reset) had nothing to click.
 *
 * **These three masked each other, which is why they could not be fixed one
 * at a time.** The readiness check never let the run settle on a strip-less
 * wall, so this reader never met one; repair readiness alone and steps 4-8
 * would have started failing on a wall the run had only just become able to
 * reach. The general lesson is the one in Open Items: a reader keyed to an
 * INCIDENTAL element fails on legitimate data, and it fails by returning
 * nothing rather than by raising anything.
 *
 * The label is what this function is about, so it reads the labels: any
 * `svg text` whose style carries the pointer cursor. That style is on the
 * label itself and is NOT gated on the placement tool (only its `onClick`
 * is — see WallElevationDiagram), so this is stable across tool state in a
 * way the drag strips, gated since Stage 2, are not.
 */
const panelWidthLabels = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg text')]
      .filter((t) => (t.getAttribute('style') || '').includes('pointer'))
      .map((t) => { const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, label: t.textContent.trim(), bold: (t.getAttribute('style') || '').includes('bold') }; })
      // Only the ones actually on screen: a click at an off-screen
      // coordinate hits nothing and fails silently.
      .filter((l) => l.x > 250 && l.x < window.innerWidth - 200 && l.y > 60 && l.y < window.innerHeight - 60);
  })()`);

/** The Selected Panel note's own width field, if one is open. */
const widthField = async () =>
  await evaluate(`(() => {
    const input = document.querySelector('input[aria-label="Panel width in inches"]');
    if (!input) return null;
    const b = input.getBoundingClientRect();
    return { value: input.value, x: b.left + b.width / 2, y: b.top + b.height / 2, invalid: input.getAttribute('aria-invalid') === 'true' };
  })()`);

console.log("4. selecting a standard panel by clicking its width label");
const labels = await panelWidthLabels();
record(
  "panel-width-labels",
  { count: labels.length, first: labels.slice(0, 4).map((l) => l.label) },
  // The rest of the run clicks labels 1..7, so fewer than a couple means the
  // gesture Stage 1 added is not on the drawing and every step after this is
  // testing nothing.
  (d) => d.count >= 2,
);
let selected = null;
for (const l of labels.slice(1, 8)) {
  await click(l.x, l.y);
  await sleep(500);
  selected = await widthField();
  if (selected) break;
}
if (!selected) throw new Error("no panel width field appeared — is a standard/braced panel selected?");
record(
  "selected-panel",
  { startingWidth: selected.value },
  // A standard panel really is selected and its width field really is showing
  // a buildable width, so "type 20 and get refused" means something below.
  (d) => Number.isFinite(asInches(d.startingWidth)) && asInches(d.startingWidth) >= FABRICATION_MIN_IN,
);
await shot("03-panel-selected");

/** Types `text` into the width field and commits with Enter. */
const typeWidth = async (text) => {
  const field = await widthField();
  if (!field) throw new Error("width field gone");
  await click(field.x, field.y);
  await evaluate(`(() => { const i = document.querySelector('input[aria-label="Panel width in inches"]'); i.focus(); i.setSelectionRange(0, i.value.length); })()`);
  await pressKey("Backspace", "Backspace", 8);
  await typeText(text);
  await pressKey("Enter", "Enter", 13);
  await sleep(600);
};

console.log("5. typing a width");
await typeWidth("41 1/2");
const afterTyped = await widthField();
const noteAfterTyped = await evaluate(`(() => {
  const note = [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.startsWith('Hand-set'));
  return note ?? null;
})()`);
record(
  "typed-width",
  { field: afterTyped?.value, note: noteAfterTyped },
  // `41 1/2` commits as exactly 41.5 and REDISPLAYS as the fraction, and the
  // note says the width is now hand-set (pinned, not merely drawn).
  (d) => asInches(d.field) === 41.5 && typeof d.note === "string" && d.note.startsWith("Hand-set"),
);
await shot("04-typed-width-41-1-2");

console.log("6. refusing below the 24in minimum");
await typeWidth("20");
const refusal = await evaluate(`(() => {
  const alert = document.querySelector('[role="alert"]');
  const input = document.querySelector('input[aria-label="Panel width in inches"]');
  return { message: alert ? alert.textContent.trim() : null, draft: input.value, invalid: input.getAttribute('aria-invalid') === 'true' };
})()`);
record(
  "refusal-below-minimum",
  refusal,
  // A REFUSAL, not a clamp: a message naming the limit, the field marked
  // invalid, and the user's own text still in the box so it can be corrected.
  // If `draft` ever came back "24" this would be a clamp wearing a refusal's
  // clothes — which is the failure this assertion exists for.
  (d) =>
    typeof d.message === "string" &&
    d.message.includes(String(FABRICATION_MIN_IN)) &&
    d.invalid === true &&
    d.draft === "20",
);
await shot("05-refusal-below-24in");

// Escape reverts the draft, leaving the committed 41.5in untouched.
await pressKey("Escape", "Escape", 27);
await sleep(400);
record(
  "after-escape",
  { field: (await widthField())?.value },
  // Escape discards the refused draft and the previously committed 41.5in is
  // still there — a refusal must not destroy the value it refused to replace.
  (d) => asInches(d.field) === 41.5,
);

console.log("7. every ADU width, typed in sequence");
const ADU_WIDTHS = ["43", "41 1/2", "37 1/2", "35", "31 1/2", "30", "29 1/2", "28 1/2", "25 1/2", "24", "48"];
const aduResults = [];
for (const width of ADU_WIDTHS) {
  await typeWidth(width);
  const after = await widthField();
  const refused = await evaluate(`document.querySelector('[role="alert"]') !== null`);
  aduResults.push({ typed: width, committed: after?.value ?? null, refused });
  if (refused) await pressKey("Escape", "Escape", 27);
}
record(
  "adu-widths",
  { results: aduResults, anyRefused: aduResults.some((r) => r.refused) },
  // THE ACCEPTANCE CHECK FOR THE JOB TOMMY IS ABOUT TO DRAW. Every width on
  // the Rogers-Sehorn cut list has to be typeable: none refused, and each one
  // committed to exactly the number that was typed. This is the check that
  // used to sit in evidence.json for a human to read.
  (d) =>
    d.results.length === ADU_WIDTHS.length &&
    d.anyRefused === false &&
    d.results.every((r) => r.refused === false && asInches(r.committed) === asInches(r.typed.replace(" 1/2", ".5"))),
);
await shot("06-adu-widths-last-48");

console.log("8. per-panel reset");
const resetButton = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Reset to automatic');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
})()`);
if (!resetButton) throw new Error("no reset control on a hand-set panel");
await shot("07-before-reset");
await click(resetButton[0], resetButton[1]);
await sleep(800);
const afterReset = await evaluate(`(() => {
  const input = document.querySelector('input[aria-label="Panel width in inches"]');
  const note = [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.startsWith('Automatic') || t.startsWith('Hand-set'));
  return { width: input ? input.value : null, note: note ?? null, stillHasReset: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Reset to automatic') };
})()`);
record(
  "per-panel-reset",
  afterReset,
  // The pin is gone: the note says the width is automatic again, and the
  // control that clears a pin has disappeared because there is none left.
  // Whatever width the tiler hands back must still be buildable.
  (d) =>
    d.stillHasReset === false &&
    typeof d.note === "string" &&
    d.note.startsWith("Automatic") &&
    asInches(d.width) >= FABRICATION_MIN_IN,
);
await shot("08-after-reset-automatic");

console.log("9. dragging a panel boundary");
/**
 * The drag handle between the pair of panels at `index`, counting only the
 * handles that are actually ON SCREEN.
 *
 * ⚠ **The on-screen filter is new, and it is the same lesson this file
 * already learned twice.** Since the elevation fits the editor's height and
 * scrolls its length (2026-09-29), a long wall's drawing is wider than the
 * window and some of its drag strips sit outside it. A mousedown at an
 * off-screen coordinate hits nothing and the drag reports no movement — i.e.
 * it fails by doing nothing, the exact shape of failure `panelWidthLabels`
 * has its own filter for. Counting only reachable handles keeps "index 1"
 * meaning "a handle this run can actually press".
 */
const dragHandles = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('rect[style*="ew-resize"]')]
      .map((h, i) => { const b = h.getBoundingClientRect(); return { i, x: b.left + b.width / 2, y: b.top + b.height / 2 }; })
      .filter((h) => h.x > 250 && h.x < window.innerWidth - 200 && h.y > 60 && h.y < window.innerHeight - 60);
  })()`);
/** Every strip's centre X, ON SCREEN OR NOT — for measuring where one landed. */
const allStripXs = async () =>
  await evaluate(`[...document.querySelectorAll('rect[style*="ew-resize"]')].map((h) => { const b = h.getBoundingClientRect(); return b.left + b.width / 2; })`);
const dragHandle = async (index) => {
  const h = (await dragHandles())[index];
  return h ? [h.x, h.y] : null;
};

/**
 * EVERY panel width label on this elevation, on screen or not.
 *
 * ⚠ **The conservation checks below must not use the click-reachability
 * filter, and used to.** `panelWidthLabels` only returns labels inside the
 * window because a click at an off-screen coordinate hits nothing — correct
 * for choosing what to click, wrong for a sum. Once the elevation started
 * scrolling a long wall (2026-09-29), only two of a 13-panel wall's labels
 * were on screen, so "the run total is conserved" was summing two panels and
 * failed the moment a drag moved width across the edge of the window. The
 * numbers were right; the question was wrong.
 */
const allVisibleAndOffscreenWidths = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg text')]
      .filter((t) => (t.getAttribute('style') || '').includes('pointer'))
      .map((t) => t.textContent.trim());
  })()`);

const widthsBeforeDrag = await allVisibleAndOffscreenWidths();

// (a) A SMALL drag, at a deliberately ugly fractional pixel offset. At this
// zoom one pixel is a couple of inches, so the cursor lands nowhere near a
// round number — the committed widths still have to be whole eighths, and
// the pair still has to add up to exactly what it did before.
const handle = await dragHandle(1);
if (!handle) throw new Error("no panel drag handle");
await mouse("mousePressed", handle[0], handle[1]);
await sleep(80);
await mouse("mouseMoved", handle[0] + 2.37, handle[1]);
await sleep(150);
await mouse("mouseMoved", handle[0] + 4.31, handle[1]);
await sleep(150);
await mouse("mouseReleased", handle[0] + 4.31, handle[1]);
await sleep(700);
await shot("09-after-drag-snapped-to-eighths");

const widthsAfterFineDrag = await allVisibleAndOffscreenWidths();
// The run total, not just the dragged pair: a drag moves width between two
// panels, so the sum of every panel on the wall must come out unchanged to
// the inch.
const pairBefore = widthsBeforeDrag.map(parseImperial).reduce((a, b) => a + b, 0);
const pairAfter = widthsAfterFineDrag.map(parseImperial).reduce((a, b) => a + b, 0);
record(
  "drag-fine",
  {
    before: widthsBeforeDrag,
    after: widthsAfterFineDrag,
    everyWidthIsAWholeEighth: widthsAfterFineDrag.every((w) => isWholeEighth(parseImperial(w))),
    runTotalBefore: pairBefore,
    runTotalAfter: pairAfter,
    runTotalConserved: Math.abs(pairBefore - pairAfter) < 1e-9,
    somethingActuallyMoved: widthsAfterFineDrag.join("|") !== widthsBeforeDrag.join("|"),
  },
  // Three things at once, and the third is the one that keeps the other two
  // honest: a drag that did nothing at all would trivially satisfy "whole
  // eighths" and "total conserved".
  (d) => d.everyWidthIsAWholeEighth && d.runTotalConserved && d.somethingActuallyMoved,
);

/**
 * (a2) ⚠ **THE MULTI-ZOOM LANDING CHECK — does the boundary end up where the
 * cursor let go of it, at more than one zoom level?**
 *
 * This is the check the 2026-09-29 elevation change owed. Every drag in
 * `WallElevationDiagram` turns a cursor position into inches with its own
 * per-event ratio, `svgWidthPx / svgRect.width` — which is exact at any
 * rendered size ONLY while the drawing is scaled uniformly on both axes. It
 * was not before that change (a 720px cap made the horizontal scale fall to
 * 56% of the vertical on a 60ft wall) and it is now. `elevationViewport.ts`
 * pins the arithmetic in unit tests; this pins the real thing in a browser,
 * because the failure being guarded against is a drag that silently lands on
 * the wrong panel boundary, and that is how Tommy sets his real panel widths.
 *
 * It is deliberately a MEASUREMENT of where the handle ended up, not an
 * inference from the widths: a width that changed by roughly the right amount
 * would also be produced by a scale that is wrong by a few percent.
 */
const boundaryLandingAtThisZoom = async (zoomLabel, travelIn) => {
  const inPerPx = await inchesPerScreenPx();
  const reachable = await dragHandles();
  const h = reachable[1];
  if (!h || !inPerPx) return { zoom: zoomLabel, reached: false };
  // `h.i` is the strip's index in the FULL list, so the same boundary can be
  // re-measured afterwards even if the drag pushed it off screen or changed
  // which strips are reachable. Measuring `reachable[1]` again afterwards
  // would silently be a different boundary.
  const stripIndex = h.i;
  // Move the boundary a real THREE INCHES, expressed in however many screen
  // pixels three inches happens to be at this zoom — which is the point: the
  // two runs of this function push the mouse different distances and must
  // produce the same answer in inches. Three inches is clear of the ±2in
  // floor snap (these panels are 40in nominal) and 24x the 1/8in grid, and
  // the two calls go opposite ways so the wall ends where it started.
  const dxPx = travelIn / inPerPx;
  await mouse("mousePressed", h.x, h.y);
  await sleep(80);
  await mouse("mouseMoved", h.x + dxPx / 2, h.y);
  await sleep(120);
  await mouse("mouseMoved", h.x + dxPx, h.y);
  await sleep(150);
  await mouse("mouseReleased", h.x + dxPx, h.y);
  await sleep(700);
  const landedX = (await allStripXs())[stripIndex] ?? null;
  const releasedAtX = h.x + dxPx;
  return {
    zoom: zoomLabel,
    reached: true,
    askedForIn: travelIn,
    inchesPerScreenPx: Number(inPerPx.toFixed(5)),
    cursorTravelPx: Number(dxPx.toFixed(2)),
    stripIndex,
    handleXBefore: Number(h.x.toFixed(2)),
    cursorReleasedAtX: Number(releasedAtX.toFixed(2)),
    handleXAfter: landedX === null ? null : Number(landedX.toFixed(2)),
    // The two numbers the check is about: how far the boundary really moved,
    // and how far it is from where the cursor let go. Both in INCHES, so the
    // two zoom levels are directly comparable.
    movedIn: landedX === null ? null : Number(((landedX - h.x) * inPerPx).toFixed(4)),
    missIn: landedX === null ? null : Number((Math.abs(landedX - releasedAtX) * inPerPx).toFixed(4)),
  };
};

// At the FITTED 100% first — the new default view, which nothing had ever
// dragged on before this change.
await clickViewButton("Reset the view");
await sleep(500);
const landingAtFit = await boundaryLandingAtThisZoom("fitted 100%", 3);
await shot("09b-landing-at-fitted-100");

// Then zoomed in three clicks (1.25^3 = 195%), where one screen pixel is
// worth about half the inches it was — and back the other way, so the wall
// ends this step exactly where it started it.
for (let i = 0; i < 3; i++) await clickViewButton("Zoom in");
await sleep(500);
const landingAtZoom = await boundaryLandingAtThisZoom("zoomed 195%", -3);
await shot("09c-landing-at-zoomed-195");

record(
  "drag-lands-where-the-cursor-let-go-at-two-zooms",
  {
    landings: [landingAtFit, landingAtZoom],
    // Stated out loud, because "the same answer at two zooms" means nothing
    // if the two zooms were the same zoom.
    theZoomsReallyDiffered:
      landingAtFit.reached &&
      landingAtZoom.reached &&
      Math.abs(landingAtFit.inchesPerScreenPx - landingAtZoom.inchesPerScreenPx) / landingAtFit.inchesPerScreenPx > 0.2,
    toleranceIn: 0.125,
  },
  // Each landing within one eighth of the release point (the boundary snaps
  // to the 1/8in grid, so a perfect drag is off by at most 1/16in), each
  // having really moved about the six inches asked for, and the two zoom
  // levels genuinely different.
  (d) =>
    d.theZoomsReallyDiffered === true &&
    d.landings.every(
      (l) =>
        l.reached === true && l.missIn !== null && l.missIn <= d.toleranceIn && Math.abs(l.movedIn - l.askedForIn) <= 0.25,
    ),
);

// (b) A LONG drag past the floor: the shrinking panel stops at the catalog
// minimum (24in) rather than going below what the shop can build.
//
// ⚠ The distance is now derived from the measured scale rather than being a
// hard-coded 90.9px — see `inchesPerScreenPx` above. 90.9px was ~41in on the
// 2026-09-24 drawing and is a small fraction of that on the fitted one, so
// the drag would have stopped short of the floor and failed as though the
// floor had gone.
// Back to the fitted 100% for it: 60 inches at the zoomed-in scale is over
// 500 screen pixels, which would release the mouse outside the window.
await clickViewButton("Reset the view");
await sleep(500);
const floorDragIn = 60;
const inPerPxForFloorDrag = await inchesPerScreenPx();
const floorDragPx = floorDragIn / (inPerPxForFloorDrag ?? 1);
const handle2 = await dragHandle(1);
if (!handle2) throw new Error("no panel drag handle on screen for the floor drag");
await mouse("mousePressed", handle2[0], handle2[1]);
await sleep(80);
await mouse("mouseMoved", handle2[0] + floorDragPx, handle2[1]);
await sleep(200);
await mouse("mouseReleased", handle2[0] + floorDragPx, handle2[1]);
await sleep(700);
const widthsAfterFloorDrag = await allVisibleAndOffscreenWidths();
record(
  "drag-to-the-floor",
  {
    after: widthsAfterFloorDrag,
    hitsTheCatalogMinimum: widthsAfterFloorDrag.some((w) => parseImperial(w) === FABRICATION_MIN_IN),
    nothingBelowTheMinimum: widthsAfterFloorDrag.every((w) => parseImperial(w) >= FABRICATION_MIN_IN),
  },
  // The drag stops AT the floor rather than below it. `nothingBelowTheMinimum`
  // returning false used to be a line in a JSON file and a green exit code.
  (d) => d.hitsTheCatalogMinimum === true && d.nothingBelowTheMinimum === true,
);
await shot("10-drag-floors-at-24in");

// ⚠ A FINDING, RECORDED RATHER THAN ASSERTED. The drag floors the SHRINKING
// panel at 24in but puts no ceiling on the GROWING one, so a long drag can
// take a panel past panelWidthInRange.maxIn (48in) — the typed field clamps
// there, the drag does not. Pre-existing: the drag is Stage 1's, already
// shipped, and this asymmetry is neither caused nor touched by Stage 1r.
// Reported rather than fixed, and left unasserted deliberately so the harness
// does not fail on a known gap somebody else has to decide about.
record(
  "drag-has-no-ceiling",
  {
    widestAfterFloorDrag: Math.max(...widthsAfterFloorDrag.map(parseImperial)),
    catalogMaxIn: 48,
    anythingOverTheMaximum: widthsAfterFloorDrag.some((w) => parseImperial(w) > 48),
  },
  observationOnly(
    "The panel-boundary drag has a floor (24in) but no ceiling; a long drag grows its neighbour past the 48in " +
      "catalog maximum, which the typed width field clamps. Pre-existing Stage 1 behaviour, out of Stage 1r's " +
      "scope, reported for a decision rather than fixed here.",
  ),
);

// --- 10. every wall, not just the one being edited --------------------------
// THE STAGE 1r ACCEPTANCE CHECK: no wall of a real drawn footprint carries a
// panel the shop cannot build. Before the absorb rule the tiler produced
// sub-24in panels routinely — a 40in standard width splits a small leftover
// into two ~20in panels — so this is the step that would have been red
// yesterday, on walls nobody touched.
console.log("10. walking every wall elevation");

/**
 * EVERY panel width label on the elevation, on screen or not — this step
 * only reads them, so the click-reachability filter must not apply.
 *
 * **⚠ It must NOT find the elevation via the drag strips, and that was the
 * whole of the "flaky" wall walk.** This read used to start from
 * `svg rect[style*="ew-resize"]`, but a drag strip only exists between two
 * ADJACENT standard/braced slots — so a wall that has no such pair (a short
 * wall whose middle is one panel between two corners) has no strips at all,
 * this returned `[]` however long it was given, and the walk recorded three
 * walls out of four. It looked like a timing flake because footprint drawing
 * is itself timing-sensitive: on a slow machine the drag that draws the
 * rectangle lands differently, so WHICH wall comes out short varies from run
 * to run, and on a fast machine often none does.
 *
 * Reproduced deterministically with `SMEARFORN_CPU_THROTTLE=12`: the old
 * reader missed a wall with a 4-attempt budget AND with a 20-attempt one,
 * using exactly 1 attempt on every wall it did read — which is what says
 * "this is not a retry problem" out loud.
 *
 * The labels themselves are what this step is about, so it reads those
 * directly, from any svg, exactly as the Stage 2 harness does.
 */
const allElevationWidths = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg text')]
      .filter((t) => (t.getAttribute('style') || '').includes('pointer'))
      .map((t) => t.textContent.trim());
  })()`);

/**
 * Advances the view control one stop.
 *
 * **Dispatched on the element rather than as a mouse event at a remembered
 * coordinate, and that is the fix for the second thing this step got wrong.**
 * The chevron's position was measured before any Selected Panel note existed;
 * once one is open it sits over the dial, so every synthetic click at those
 * coordinates hit the note instead and the dial never moved. The run still
 * looked plausible, because panning changed which labels were on screen. That
 * rule now lives in the shared driver, which dispatches on the element for
 * exactly this reason — and it applies to the bar menus too, where an open
 * note can sit over a menu item just as happily. This step is about reading
 * four walls, not about hit areas.
 */
const stepViewerDial = async () => {
  await view.step();
  return true;
};

/** How hard the walk tries to read each wall before giving up on it — see
 * the retry loop below for why this is 20 and not 4. */
const WALL_READ_ATTEMPT_BUDGET = Number(process.env.SMEARFORN_WALL_READ_BUDGET ?? "20");
const WALL_READ_ATTEMPT_PAUSE_MS = Number(process.env.SMEARFORN_WALL_READ_PAUSE_MS ?? "400");

const wallsSeen = [];
const viewsVisited = [];
// One full turn of the dial plus slack: the cycle is plan, one stop per wall,
// then the three 3D stops.
for (let i = 0; i < 16; i++) {
  // Named `stop`, not `view`: `view` is now the shared view-stop driver at the
  // top of this file, and a loop variable that shadowed it would work by luck
  // and read as a bug forever after.
  const stop = await currentViewLabel();
  viewsVisited.push(stop);
  if (typeof stop === "string" && stop.startsWith("Elevation:") && !wallsSeen.some((w) => w.view === stop)) {
    // The dial's label updates before the canvas has finished re-rendering,
    // so a first read can legitimately come back empty. Retried rather than
    // skipped: a wall silently missing from this walk is a wall this step did
    // not actually check, which is the failure mode it exists to prevent.
    //
    // ⚠ THE BUDGET WAS 4 x 500ms AND IT WAS NOT ENOUGH. On a loaded machine
    // this step failed about one run in three — reading 3 of 4 walls, then 2
    // of 4 — while every other step passed. **A flaky check is worse than no
    // check**, because it teaches whoever reads it to discount a real
    // failure, and this one had already cost two reviewers their time. The
    // budget is now 20 x 400ms (8s per wall, against a step that normally
    // needs one read) and `readAttemptsPerWall` goes into the evidence, so
    // the margin is a number a future reader can see shrinking instead of a
    // silence they have to trust.
    let widths = [];
    let attemptsUsed = 0;
    for (let attempt = 0; attempt < WALL_READ_ATTEMPT_BUDGET && widths.length === 0; attempt++) {
      if (attempt > 0) await sleep(WALL_READ_ATTEMPT_PAUSE_MS);
      widths = (await allElevationWidths()).map(parseImperial).filter((w) => Number.isFinite(w));
      attemptsUsed = attempt + 1;
    }
    if (widths.length > 0) wallsSeen.push({ view: stop, widths, narrowest: Math.min(...widths), attemptsUsed });
  }
  if (!(await stepViewerDial())) break;
  await sleep(600);
}
await shot("11-every-wall-walked");
record(
  "every-wall-at-or-above-the-minimum",
  {
    wallsWalked: wallsSeen.length,
    // Named, so it is checkable that these really are four different walls.
    views: wallsSeen.map((w) => w.view),
    // The whole turn of the dial, so a run that never moved is visible rather
    // than inferable — which is exactly how this step was wrong the first time.
    viewsVisited,
    // Every wall's whole tiling, not just its narrowest panel: a summary
    // statistic is not evidence. (These are the STANDARD/BRACED panels only —
    // corner and safety-gap slots carry no clickable width label — so they do
    // not add up to the wall's own length.)
    widthsPerWall: wallsSeen.map((w) => w.widths),
    narrowestPerWall: wallsSeen.map((w) => w.narrowest),
    // How many reads each wall actually needed, against the budget. A run
    // where these creep toward the budget is a run that is about to start
    // failing again, and that is worth seeing BEFORE it does.
    readAttemptsPerWall: wallsSeen.map((w) => w.attemptsUsed),
    readAttemptBudget: WALL_READ_ATTEMPT_BUDGET,
    // The safety-gap board (0.75in) is a plywood spacer, not a panel, and is
    // exempt for the same reason the Review Log exempts it. It is also not
    // drawn with a width label, so it never reaches this list — stated rather
    // than assumed, because an exemption nobody can see is a hole.
    narrowestAnywhere: wallsSeen.length ? Math.min(...wallsSeen.map((w) => w.narrowest)) : null,
    // How many elevation stops the dial actually offered. The check below
    // compares this against how many were READ, so a wall the walk skipped
    // fails the step instead of quietly shrinking the sample.
    elevationStopsOffered: new Set(viewsVisited.filter((v) => typeof v === "string" && v.startsWith("Elevation:"))).size,
  },
  (d) =>
    d.elevationStopsOffered >= 4 &&
    d.wallsWalked === d.elevationStopsOffered &&
    d.narrowestAnywhere !== null &&
    d.narrowestAnywhere >= FABRICATION_MIN_IN,
);

// --- the verdict ------------------------------------------------------------
writeEvidence();
const asserted = evidence.steps.filter((s) => s.asserted).length;
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} of ${asserted} checks — ${failures.join(", ")}`);
  console.error("See evidence.json for what each one actually saw.");
  process.exit(1);
}
console.log(`\nPASSED: ${asserted} of ${asserted} checks (plus ${evidence.steps.length - asserted} observation-only step(s)).`);
process.exit(0);

// --- tiny helpers -----------------------------------------------------------
/** Reads both forms the app shows: the note's `41½` and the elevation
 * label's raw `34.125`. */
function parseImperial(text) {
  const map = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
  const m = String(text).match(/^(-?\d+(?:\.\d+)?)\s*([½¼¾⅛⅜⅝⅞])?/);
  if (!m) return NaN;
  return Number(m[1]) + (m[2] ? map[m[2]] : 0);
}
function isWholeEighth(value) {
  return Number.isFinite(value) && Math.abs(value * 8 - Math.round(value * 8)) < 1e-9;
}
