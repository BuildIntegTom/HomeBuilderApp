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
import { makeElevationZoomControl } from "../elevationZoom.mjs";
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

/**
 * GET THE WHOLE WALL ON SCREEN BEFORE READING ANYTHING OFF IT.
 *
 * ⚠ **This replaced three clicks of Zoom in, and the swap is a review fix
 * rather than a preference.** The old three clicks predate 2026-09-29, when
 * they were load-bearing: at 100% on a 48ft wall one pixel was about two
 * inches and every drag landed inside the ±2in snap window around the floor.
 * The fitted view is far finer than that, so the zoom bought nothing — and it
 * COST the run its sample. Zoomed to 195% on a 13-panel wall only THREE width
 * labels were still inside the window, so `panel-width-labels` quietly went
 * from 13 to 3 and `labels.slice(1, 8)` — which steps 4-8 select from — was
 * down to two candidates against an assertion of `count >= 2`. Two labels from
 * red, by a route that raises nothing: exactly the "fewer elements, not an
 * exception" failure `elevationZoom.mjs` was written for, in the one harness
 * that carried the 13-panel wall and never called it.
 *
 * Step 9c does its own zooming (Reset, then three clicks of Zoom in) and never
 * depended on this, so nothing here is lost.
 */
const elevationZoom = makeElevationZoomControl({ evaluate, sleep, click });
const fittedWholeWall = await elevationZoom.fitWholeWall();
record(
  "whole-wall-on-screen",
  fittedWholeWall,
  // Recorded AND asserted: every reader below this line filters to what is
  // inside the window, so if the whole wall is not in the window the run is
  // silently testing a fraction of it.
  (d) => d.wholeWallVisible === true,
);
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
 *
 * (Hoisted above step 4 on the 2026-09-29 review pass, because step 4 now
 * compares the two readers against each other: see `panel-width-labels`.)
 */
const allVisibleAndOffscreenWidths = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg text')]
      .filter((t) => (t.getAttribute('style') || '').includes('pointer'))
      .map((t) => t.textContent.trim());
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
const everyLabelOnThisWall = await allVisibleAndOffscreenWidths();
record(
  "panel-width-labels",
  {
    count: labels.length,
    onTheWall: everyLabelOnThisWall.length,
    first: labels.slice(0, 4).map((l) => l.label),
  },
  // Two separate promises, and the second is the one that was missing.
  //
  // 1. There is something to click at all: the rest of the run selects from
  //    labels 1..7, so fewer than a couple means the gesture Stage 1 added is
  //    not on the drawing and every step after this is testing nothing.
  // 2. **The CLICKABLE sample is the whole wall, not a window onto it.**
  //    `count >= 2` alone let the sample fall from 13 labels to 3 without a
  //    murmur when the elevation started scrolling; comparing the two readers
  //    is what makes that visible, because `onTheWall` counts labels whether
  //    they are on screen or not.
  //
  // ⚠ **`>= 8` is the real requirement, `onTheWall - 2` is the slack, and both
  // numbers replace guesses.** The requirement first: steps 4-8 select from
  // `labels.slice(1, 8)`, so EIGHT clickable labels is what this run actually
  // consumes. `>= 2` was not that number — it was two labels from red when the
  // sample collapsed from 13 to 3, and it did not say out loud what the run
  // needs. The slack second: ONE label of slack is TIGHTER than the on-screen
  // filter's own worst case, not looser. That filter trims at `x > 250` AND at
  // `x < innerWidth - 200`, i.e. at BOTH ends, so a narrower window can
  // legitimately lose one label at each — `11 >= 12` — and the step would go
  // red on an app that is behaving. Two is the filter's own arithmetic. Either
  // way the failure is a false alarm rather than a silent shrink, which errs in
  // the right direction; but a canary that cries on a smaller window is a
  // canary people learn to ignore.
  (d) => d.count >= 8 && d.count >= d.onTheWall - 2,
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

const widthsBeforeDrag = await allVisibleAndOffscreenWidths();

// (a) A SMALL drag of a few pixels, landing at an arbitrary inch rather than
// a round one — the committed widths still have to be whole eighths, and the
// pair still has to add up to exactly what it did before.
//
// ⚠ The fractional `+2.37` / `+4.31` used to be described as "a deliberately
// ugly fractional pixel offset", which was never true of what the APP saw:
// `MouseEvent.clientX` is an integer and the fraction is dropped on the way
// in (see step 9c, where that truncation was mistaken for snap noise). The
// arbitrariness that matters here comes from the scale, not the fraction —
// one screen pixel is some non-round number of inches — so the check is
// unaffected and the pixels are left as they are.
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
//
// ⚠ ONE SET OF NUMBERS HERE MOVED AND THEN MOVED BACK, AND IT IS WORTH
// SAYING SO SO THAT NOBODY READS IT AS A TILER CHANGE. Between `main` and
// the first cut of the fitted elevation, wall AB's recorded widths went from
// `…34.125, 34.125, 40` (run total 508.25) to `…37.125, 37, 40` (514.125).
// Nothing in the tiler moved: step 4 was down to three reachable width
// labels instead of thirteen, so `labels.slice(1, 8)` selected a DIFFERENT
// panel, and steps 5-8 hand-set and released a different one — which lands
// the tiler's residual eighths on different slots. Restoring the label count
// (see `whole-wall-on-screen` above) put the SELECTED PANEL back: this step
// drags the pair at index 1/2 — `40 / 40` — exactly as `main` does, and
// smearforn-stage-2's wall AB was never affected at all
// (`totalEighths: 4392` on both sides throughout).
//
// ⚠ **BUT DO NOT DIFF THESE LISTS AGAINST `main` LINE BY LINE, BECAUSE THEY
// ARE NOT STABLE BETWEEN RUNS OF THE SAME CODE.** Measured on 2026-09-29:
// three consecutive runs of this file with no code change affecting anything
// above this step produced AB as `…34.125, 34.125, 40` (508.25) once and
// `…37.125, 37, 40` (514.125) twice. The footprint is drawn with synthetic
// mouse moves and the rectangle does not always land on the same quantized
// corner, so wall AB's own LENGTH — and with it the tiler's residual eighths —
// moves from run to run. An earlier version of this note said the committed
// numbers were "byte-identical to `main`" and that "only AB is comparable
// between runs": that was one pair of runs' worth of luck. **No wall's literal
// width list is comparable across runs, AB included.** What IS stable, and
// what this step actually asserts, is `runTotalConserved` — the same wall's
// total before and after the drag, WITHIN one run.
//
// ⚠ **And the dragged pair in `after` is SUPPOSED to differ from `main`.**
// This branch records `42.5 / 37.5` (both runs above) where `main` records
// `44.5 / 35.5`, both conserving the same 80in across the pair. The drag is a
// fixed number of SCREEN pixels (`+4.31`), and one screen pixel is a different
// number of inches once the drawing is fitted to the viewport instead of
// capped at 720, so the same gesture legitimately moves a different amount of
// width. Someone diffing evidence against `main` should expect that line to
// move, and should compare `runTotalConserved` rather than the lists.
//
// ⚠ Step 10's other walls are the same story, and were the first place it was
// noticed: BC and DA vary between runs on the same code (`[40, 40, 40, 40]`
// one run, `[40, 37.125, 37, 40]` the next) for exactly this reason — the
// timing sensitivity this file documents at length under
// `SMEARFORN_CPU_THROTTLE`. None of it touches an assertion: every check here
// compares a run against itself.
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
  // ⚠ **INTEGER COORDINATES, AND THIS IS THE WHOLE REASON THE RESIDUAL BELOW
  // IS 1/16in RATHER THAN A QUARTER INCH.** `MouseEvent.clientX` is an
  // integer: CDP will happily dispatch `x: 763.59`, and the app is then
  // handed 763. The harness would be measuring its own missing 0.59px as if
  // the app had lost it — worth `0.59 x inchesPerScreenPx`, which at the
  // fitted view is 0.145in and at a zoomed-OUT view would be more. Rounding
  // here makes the harness and the browser agree where the cursor is, so the
  // only error left in `missIn` is the app's own 1/8in snap.
  const pressX = Math.round(h.x);
  const releasedAtX = Math.round(h.x + dxPx);
  await mouse("mousePressed", pressX, h.y);
  await sleep(80);
  await mouse("mouseMoved", Math.round(h.x + dxPx / 2), h.y);
  await sleep(120);
  await mouse("mouseMoved", releasedAtX, h.y);
  await sleep(150);
  await mouse("mouseReleased", releasedAtX, h.y);
  await sleep(700);
  const landedX = (await allStripXs())[stripIndex] ?? null;
  return {
    zoom: zoomLabel,
    reached: true,
    askedForIn: travelIn,
    inchesPerScreenPx: Number(inPerPx.toFixed(5)),
    cursorTravelPx: Number(dxPx.toFixed(2)),
    stripIndex,
    handleXBefore: Number(h.x.toFixed(2)),
    // An integer, because that is what was dispatched and what the app saw.
    cursorReleasedAtX: releasedAtX,
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
    // 1/16in: HALF THE 1/8in GRID, which is the whole of the error a correct
    // drag can have. `resolvePanelBoundaryDrag` rounds to eighths through
    // `roundToEighthIn` -> `Math.round` (packages/geometry/src/eighths.ts),
    // and round-to-NEAREST cannot be off by a whole eighth.
    //
    // ⚠ THIS USED TO BE 0.125, WITH A WRONG EXPLANATION, AND IT WAS FLAKY BY
    // CONSTRUCTION. The comment said "the boundary snaps to the 1/8in grid" —
    // but that same comment also said "off by at most 1/16in", which is the
    // contradiction that gave the game away: round-to-nearest cannot produce
    // the 0.125 both runs were recording.
    //
    // The real mechanism was the harness's own, and it is now fixed at
    // source: the release coordinate was dispatched fractionally
    // (`h.x + dxPx` = 763.59), `MouseEvent.clientX` is an integer, the app
    // saw 763, and the harness then measured the 0.59px IT had thrown away as
    // if the drag had lost it. Reconstructed exactly from the old numbers:
    // 0.59px x 0.24638 in/px = 0.145in down, the eighth-snap gave 0.020in
    // back, and the residual was 0.125in — at BOTH zooms, biased the same
    // way, which is what says "not snap noise".
    //
    // It was also latently red rather than merely mis-explained. The old
    // worst case was `frac(releaseX) x inchesPerScreenPx + 1/16`, i.e. up to
    // 0.31in at the fitted view — more than double the 0.125 tolerance. Both
    // recorded runs happened to land mid-range (frac 0.59 and 0.86); a
    // different window size or wall length moves that fraction and the step
    // would have gone red at ~0.25in, reading as a PANEL-DRAG REGRESSION on
    // the one gesture Tommy uses to set real panel widths.
    //
    // **And the good news, which the old evidence hid: the app's real drag
    // accuracy is better than it looked.** A human cursor is already at an
    // integer `clientX`, so no user ever suffers the truncation the harness
    // was inflicting on itself. The only error a person sees when they let go
    // of a panel boundary is the <=1/16in snap to the shop's own grid.
    toleranceIn: 0.0625,
  },
  // Each landing within half an eighth of where the cursor let go, each
  // having really moved about the three inches asked for, and the two zoom
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

/* --- 9d. THE WHEEL --------------------------------------------------------
 *
 * ⚠ **This step exists because the wheel handler is the most fragile thing
 * the 2026-09-29 elevation change added and it shipped with nothing standing
 * over it.** The drag got a permanent harness step; the wheel got a throwaway
 * probe in a scratch directory, which is the arrangement this repo has
 * already been burned by twice.
 *
 * What is fragile about it: the listener is attached natively with
 * `{ passive: false }` instead of through React's `onWheel`, and the ONLY
 * reason is that React registers wheel listeners on the root as PASSIVE, so a
 * `preventDefault()` from an `onWheel` handler is ignored — and Ctrl+wheel
 * then zooms the whole BROWSER PAGE instead of the drawing. It looks like
 * unidiomatic React, so the first person to tidy it breaks it. Now they break
 * this instead.
 *
 * ⚠ **`devicePixelRatio` is not the proof, and was wrongly offered as one.**
 * A CDP-synthesised wheel is injected into the renderer; browser page zoom is
 * browser-UI behaviour a synthetic event may never reach, so `pageZoom: 1`
 * would be recorded whether or not `preventDefault()` landed. The real proof
 * is `event.defaultPrevented`, read from a listener on `window` in the BUBBLE
 * phase — i.e. after the viewport's own handler has had the event. If the
 * registration goes passive, `preventDefault()` is dropped and this reads
 * false.
 */
console.log("9d. the wheel gestures");

/** A wheel event at a point, with `modifiers: 2` meaning Ctrl held. */
const wheel = (x, y, deltaY, modifiers = 0) =>
  send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY, modifiers, pointerType: "mouse" }, sid);

/**
 * Arms the `defaultPrevented` probe and clears anything it saw before.
 *
 * Bubble phase on `window`, and `{ passive: true }` so the probe itself
 * cannot influence the outcome it is measuring.
 */
const armWheelProbe = async () =>
  await evaluate(`(() => {
    window.__wheelProbe = [];
    if (!window.__wheelProbeInstalled) {
      window.__wheelProbeInstalled = true;
      window.addEventListener('wheel', (e) => {
        window.__wheelProbe.push({ ctrl: e.ctrlKey || e.metaKey, deltaY: e.deltaY, defaultPrevented: e.defaultPrevented });
      }, { passive: true });
    }
    return true;
  })()`);
const wheelProbe = async () => (await evaluate(`window.__wheelProbe`)) ?? [];

/** The scrolling viewport's own state, plus what inch is under a screen x. */
const viewportState = async (clientX) =>
  await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label^="Elevation view of wall"]');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    let el = svg.parentElement;
    while (el && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflow !== 'auto') el = el.parentElement;
    const vb = Number((svg.getAttribute('viewBox') || '').split(' ')[2]);
    const local = (${clientX} - r.left) * (vb / r.width);
    return {
      renderedWidth: Math.round(r.width),
      renderedHeight: Math.round(r.height),
      scrollLeft: el ? Math.round(el.scrollLeft) : null,
      scrollTop: el ? Math.round(el.scrollTop) : null,
      canScrollVertically: el ? el.scrollHeight - el.clientHeight > 1 : null,
      canScrollHorizontally: el ? el.scrollWidth - el.clientWidth > 1 : null,
      zoom: [...document.querySelectorAll('span')].map((s) => s.textContent).find((t) => /^\\d+%$/.test(t)) ?? null,
      // The drawing inch under the cursor, which is what a zoom about the
      // pointer has to preserve.
      inchUnderPointer: Math.round(((local - 48) / 1.6) * 1000) / 1000,
    };
  })()`);

// Back to the fitted default, which is the view the redirect below is about.
await clickViewButton("Reset the view");
await sleep(600);
const wheelPointer = await evaluate(`(() => {
  const svg = document.querySelector('svg[aria-label^="Elevation view of wall"]');
  let el = svg.parentElement;
  while (el && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflow !== 'auto') el = el.parentElement;
  const r = (el ?? svg).getBoundingClientRect();
  return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
})()`);

// (a) A PLAIN wheel at the fitted view reaches along the wall. Tommy's
// complaint was that the elevation had no scroll at all, and the wall is long
// and short — so a vertical wheel is redirected to horizontal while there is
// nothing to scroll vertically.
const beforePlain = await viewportState(wheelPointer[0]);
await armWheelProbe();
await wheel(wheelPointer[0], wheelPointer[1], 300, 0);
await sleep(400);
await wheel(wheelPointer[0], wheelPointer[1], 300, 0);
await sleep(600);
const afterPlainDown = await viewportState(wheelPointer[0]);
const plainProbe = await wheelProbe();
await wheel(wheelPointer[0], wheelPointer[1], -300, 0);
await sleep(400);
await wheel(wheelPointer[0], wheelPointer[1], -300, 0);
await sleep(600);
const afterPlainBack = await viewportState(wheelPointer[0]);
record(
  "plain-wheel-reaches-along-the-wall",
  {
    fitsVertically: beforePlain.canScrollVertically === false,
    scrollLeft: [beforePlain.scrollLeft, afterPlainDown.scrollLeft, afterPlainBack.scrollLeft],
    scrollTopStayedPut: beforePlain.scrollTop === afterPlainDown.scrollTop,
    zoomUnchanged: beforePlain.zoom === afterPlainDown.zoom,
    defaultPrevented: plainProbe.map((p) => p.defaultPrevented),
  },
  // It scrolls ALONG the wall (not down), does not zoom, comes back exactly,
  // and the app really did take the event — `preventDefault` landed, which is
  // what stops the browser also scrolling the page behind it.
  (d) =>
    d.fitsVertically === true &&
    d.scrollLeft[1] > d.scrollLeft[0] &&
    d.scrollLeft[2] === d.scrollLeft[0] &&
    d.scrollTopStayedPut === true &&
    d.zoomUnchanged === true &&
    d.defaultPrevented.length === 2 &&
    d.defaultPrevented.every((v) => v === true),
);

// (b) CTRL + wheel zooms the DRAWING, about the pointer — and, the point of
// the whole native-listener detour, the browser page does not zoom because
// `preventDefault()` really landed.
const beforeCtrl = await viewportState(wheelPointer[0]);
await armWheelProbe();
await wheel(wheelPointer[0], wheelPointer[1], -240, 2);
await sleep(900);
const afterCtrl = await viewportState(wheelPointer[0]);
const ctrlProbe = await wheelProbe();
record(
  "ctrl-wheel-zooms-the-drawing-not-the-page",
  {
    zoom: [beforeCtrl.zoom, afterCtrl.zoom],
    renderedWidth: [beforeCtrl.renderedWidth, afterCtrl.renderedWidth],
    // exp(240/400) = 1.8221, so one 240-delta notch is 182%.
    expectedZoomPercent: Math.round(Math.exp(240 / 400) * 100),
    inchUnderPointer: [beforeCtrl.inchUnderPointer, afterCtrl.inchUnderPointer],
    pointerDriftIn: Math.round(Math.abs(afterCtrl.inchUnderPointer - beforeCtrl.inchUnderPointer) * 1000) / 1000,
    // ⚠ THE PROOF. Not `devicePixelRatio`: see this step's note.
    ctrlSeen: ctrlProbe.map((p) => p.ctrl),
    defaultPrevented: ctrlProbe.map((p) => p.defaultPrevented),
  },
  // The drawing got bigger by the amount the exponential says, the drawing
  // point under the cursor is still under the cursor (within a quarter inch —
  // it is re-pinned by a scroll offset in integer pixels), and the event was
  // consumed so the page itself cannot have zoomed.
  (d) =>
    d.zoom[1] === `${d.expectedZoomPercent}%` &&
    d.renderedWidth[1] > d.renderedWidth[0] * 1.5 &&
    d.pointerDriftIn <= 0.25 &&
    d.ctrlSeen.length === 1 &&
    d.ctrlSeen[0] === true &&
    d.defaultPrevented.length === 1 &&
    d.defaultPrevented[0] === true,
);
await shot("09d-ctrl-wheel-zoomed");

// (c) ⚠ AND THE LIMIT OF THE GESTURE, asserted so that the comment in
// WallElevationDiagram cannot drift away from the behaviour again. An earlier
// version of that comment claimed "the gesture is never dead". It is not:
// once zoomed in there IS vertical overflow, so the redirect is skipped and a
// plain wheel scrolls DOWN like any other scroll container. Reaching along the
// wall then needs Shift+wheel, the scrollbar or Pan. Recorded here as real
// behaviour rather than as a claim — if Tommy wants the redirect to win at
// every zoom, this is the step that changes.
const beforeZoomedPlain = await viewportState(wheelPointer[0]);
await armWheelProbe();
await wheel(wheelPointer[0], wheelPointer[1], 100, 0);
await sleep(700);
const afterZoomedPlain = await viewportState(wheelPointer[0]);
record(
  "zoomed-in-a-plain-wheel-scrolls-vertically-instead",
  {
    canScrollVertically: beforeZoomedPlain.canScrollVertically,
    scrollTop: [beforeZoomedPlain.scrollTop, afterZoomedPlain.scrollTop],
    scrollLeft: [beforeZoomedPlain.scrollLeft, afterZoomedPlain.scrollLeft],
    appTookTheEvent: (await wheelProbe()).map((p) => p.defaultPrevented),
  },
  // Vertical overflow exists, the wheel moved the view DOWN and not along,
  // and the app deliberately did NOT consume the event — the browser's own
  // scrolling is doing the work.
  //
  // ⚠ `length === 1` FIRST, because `[].every()` is `true`: without it, a
  // probe that saw no wheel event at all — a wheel dispatched at a coordinate
  // outside the viewport, a probe that failed to arm — would read as "the app
  // declined the event" and PASS. The sibling `scrollTop[1] > scrollTop[0]`
  // does close the hole in practice today, which is exactly why the length
  // check belongs here too: the day someone edits that sibling, this must not
  // be the assertion that had quietly stopped asking anything. Both other
  // wheel steps already check their probe's length; this one was the odd one
  // out, and an inconsistency is what survives a later edit.
  (d) =>
    d.canScrollVertically === true &&
    d.scrollTop[1] > d.scrollTop[0] &&
    d.scrollLeft[1] === d.scrollLeft[0] &&
    d.appTookTheEvent.length === 1 &&
    d.appTookTheEvent.every((v) => v === false),
);
await clickViewButton("Reset the view");
await sleep(500);

/**
 * ⚠ **AND NOW LEAVE THIS WALL LOOKING NOTHING LIKE THE DEFAULT, DELIBERATELY.**
 *
 * This is the fixture for `each-wall-arrives-fitted-and-unscrolled` in step 10,
 * and without it that step cannot fail. Every other step here ends by clicking
 * Reset the view, so the wall the walk starts from was already at 100% and
 * scroll 0 — meaning a wall change that reset NOTHING would still have been
 * recorded as "arrived at 100%, scrolled to 0" and passed. A check whose
 * fixture is the answer is not a check.
 *
 * So: scroll along the wall (a plain wheel, which at the fitted view reaches
 * horizontally — proven two steps up), then zoom in twice. Both halves matter,
 * because the reset has two halves: the zoom is React state DERIVED from a
 * stored wall id, and the scroll is DOM state WRITTEN by a layout effect. A
 * regression in either one now shows up on the very next wall.
 */
await wheel(wheelPointer[0], wheelPointer[1], 300, 0);
await sleep(300);
await wheel(wheelPointer[0], wheelPointer[1], 300, 0);
await sleep(300);
await clickViewButton("Zoom in");
await sleep(400);
await clickViewButton("Zoom in");
await sleep(600);
const leftTheFirstWallAt = await viewportState(wheelPointer[0]);

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
    // ⚠ HOW THE WALL ARRIVED, read once the wall has rendered. This is the
    // only committed check on "a different wall opens FITTED" — see the
    // `each-wall-arrives-fitted-and-unscrolled` step below for why it lives
    // inside a walk that already exists rather than in a probe of its own.
    const arrival = widths.length > 0 ? await viewportState(0) : null;
    if (widths.length > 0) wallsSeen.push({ view: stop, widths, narrowest: Math.min(...widths), attemptsUsed, arrival });
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

/**
 * ⚠ **A DIFFERENT WALL OPENS FITTED AND AT THE START OF THE WALL — the only
 * committed check on it.**
 *
 * WallElevationDiagram remembers the user's zoom per wall and resets the
 * viewport's scroll on a wall change, and it does the zoom half by DERIVING
 * from a stored wall id during render rather than by writing state in an
 * effect. That is not a style preference: `setState` in an effect body is a
 * severity-2 `react-hooks/set-state-in-effect` ERROR in this app, so the
 * derived form is the only correct one — and it is also the form that looks
 * "untidy" to the next person, who is therefore MOTIVATED to move it into an
 * effect. Without this step that tidy-up gets a green harness run: the new
 * wall would paint once at the previous wall's zoom before correcting itself,
 * which no other assertion in this file can see.
 *
 * It rides the walk above because the walk already visits every elevation stop.
 * An in-browser probe in a scratch directory is the arrangement this repo has
 * been burned by twice, and the two refactors this change rests on should not
 * be held to different standards — the wheel gestures got three permanent
 * steps, so the wall-switch reset gets one.
 *
 * **`wallsSeen[0]` IS NOT AN ARRIVAL and is excluded on purpose.** It is the
 * wall the run was already editing, left zoomed and scrolled a few lines above
 * precisely so that the walls after it have something to inherit; asserting
 * against it would assert that the fixture failed. So the fixture is checked
 * first, then every genuine wall switch.
 */
record(
  "each-wall-arrives-fitted-and-unscrolled",
  {
    views: wallsSeen.map((w) => w.view),
    // The fixture: the wall we STEPPED OFF was not at the default view.
    leftTheFirstWallAt: leftTheFirstWallAt && {
      zoom: leftTheFirstWallAt.zoom,
      scrollLeft: leftTheFirstWallAt.scrollLeft,
    },
    // ... and every wall stepped ON TO was.
    arrivals: wallsSeen.slice(1).map((w) => ({
      view: w.view,
      zoom: w.arrival?.zoom ?? null,
      scrollLeft: w.arrival?.scrollLeft ?? null,
      scrollTop: w.arrival?.scrollTop ?? null,
      // Recorded so this reads as evidence rather than as a bare pass: a
      // fitted wall is one with nothing to scroll vertically.
      canScrollVertically: w.arrival?.canScrollVertically ?? null,
    })),
  },
  // `length >= 3` before any `every()`, for the same reason the wheel step now
  // counts its probe: `[].every()` is `true`, and a walk that read no walls
  // must not pass the step that checks how they arrived. Four elevation stops
  // less the one we stepped off leaves three. A `null` from `viewportState`
  // (no SVG, or no scrolling ancestor above it) fails here too.
  (d) =>
    d.leftTheFirstWallAt !== null &&
    // A STRING that is not "100%", not merely "not 100%": an unread zoom comes
    // back `null`, and `null !== "100%"` would have let a fixture that
    // measured nothing stand in for a fixture that worked.
    typeof d.leftTheFirstWallAt.zoom === "string" &&
    d.leftTheFirstWallAt.zoom !== "100%" &&
    d.leftTheFirstWallAt.scrollLeft > 0 &&
    d.arrivals.length >= 3 &&
    d.arrivals.every((a) => a.zoom === "100%" && a.scrollLeft === 0 && a.scrollTop === 0),
);

console.log("12. a hand-set width this wall cannot pay for is REFUSED, and nothing changes");
/**
 * **The locked-width refusal, 2026-09-30.** A pinned width is re-forced after
 * every re-tile, and until this change the difference was shed onto one
 * neighbour with no bounds at all: the neighbour could go under the 24in
 * fabrication minimum, past the 48in catalog maximum, or to 0in, and on a run
 * with nothing unlocked left the shed was a no-op and the WALL CAME OUT A
 * DIFFERENT LENGTH THAN ITSELF. Tommy's decision was to refuse outright —
 * nothing changes, and the message names what is in the way and the widest
 * legal value.
 *
 * **How this reaches the refusal without depending on the wall's length.**
 * Pin successive panels at 48in, the catalog maximum. Each pin takes width OUT
 * of the automatic run and removes one panel from it, so the run's slack is
 * strictly decreasing and the loop is self-terminating: on any wall with a few
 * panels, one of these pins eventually cannot be paid for. The step asserts
 * both halves — that the earlier ones ARE honoured (the feature still works,
 * which is the thing a refusal must not cost) and that the one that cannot be
 * is refused whole.
 *
 * ⚠ **This step IS red on `main` @ f100bd3 — but the mechanism first written
 * here did not reproduce, and the real one is worse.** The claim was that the old
 * shed drove neighbours to 16in, then 6in, then clamped one at 0in, "with the
 * wall's own total moving every time", and that `totalNeverMoved` catches it.
 * `main` actually records `totals: [160,160,160,160,160]` and
 * **`totalNeverMoved: true`**; the check that fails is
 * **`narrowestAfter >= FABRICATION_MIN_IN`**.
 *
 * `shedWidthToNearestUnlocked` hands the whole delta to ONE neighbour with
 * `Math.max(0, widthIn + deltaIn)` — no lower bound but zero — so the wall still
 * sums and `retileWallAroundPins`' "the wall must still sum" guard waves it
 * through. Measured against `main`'s own `bracedPlacement.ts` on a 160in
 * four-panel wall at the 40in standard width: the first pin commits a **20¼in**
 * panel, the second a **12¼in** one, both silently; the third is the only one
 * that moves the total (160in -> 195¾in) and is therefore the only one `main`
 * already refuses. **The 0in clamp is unreachable on this wall** — it needs a
 * free panel narrower than the delta — and the no-free-slot case the refusal was
 * really built for makes the shed a no-op instead.
 *
 * So `totalNeverMoved` is true on `main` too and is NOT the discriminator here:
 * `narrowestAfter`, `widestAfter`, and the third pin being refused *with a
 * sentence*, are. It is kept as an assertion because it is the property Tommy
 * asked for and the no-free-slot walls DO violate it.
 */
const widthsNow = async () => (await allElevationWidths()).map(parseImperial).filter((n) => Number.isFinite(n));
// Get back onto an elevation — the wall walk above left the dial wherever it
// finished, and a 3D stop has no panel labels to click — and specifically onto
// a SHORT wall.
//
// ⚠ **The wall matters, and the first version of this step picked the wrong
// one.** `panelWidthLabels` only returns labels inside the window, because a
// click at an off-screen coordinate hits nothing; on the 13-panel wall this run
// has been editing, the loop below pinned every label it could reach and then
// ran out of CANDIDATES rather than out of slack, so it never reached the
// refusal at all and the step failed for a reason that had nothing to do with
// the app. A 4-panel wall's labels are all on screen at once, and 4 panels is
// also where the run's slack genuinely runs out after two pins.
let wallForStep12 = null;
for (let i = 0; i < 16 && wallForStep12 === null; i++) {
  const stop12 = await currentViewLabel();
  if (typeof stop12 === "string" && stop12.startsWith("Elevation:")) {
    const count12 = (await allElevationWidths()).length;
    if (count12 >= 3 && count12 <= 8) {
      wallForStep12 = { view: stop12, labelCount: count12 };
      break;
    }
  }
  await stepViewerDial();
  await sleep(500);
}
if (!wallForStep12) throw new Error("no elevation with 3-8 panel labels to run the locked-width refusal on");
await sleep(600);
const beforeWidths = await widthsNow();
const beforeTotal = beforeWidths.reduce((a, b) => a + b, 0);
const PIN_IN = 48; // panelWidthInRange.maxIn — the widest pin the field accepts
const attempts = [];
const totals = [beforeTotal];
let refusal12 = null;
for (let n = 0; n < 12 && !refusal12; n++) {
  // Re-read the labels every time: a commit re-tiles the wall and moves them.
  const labels12 = await panelWidthLabels();
  let picked = null;
  for (const l of labels12) {
    if (parseImperial(l.label) === PIN_IN) continue; // already pinned at 48 by this loop
    await click(l.x, l.y);
    await sleep(400);
    const f = await widthField();
    if (f) {
  picked = { label: l.label, field: f.value };
      break;
    }
  }
  if (!picked) {
    // Recorded rather than swallowed: running out of selectable labels is a
    // FIXTURE failure, not a refusal, and the assertion below has to be able to
    // tell them apart.
    attempts.push({ selectedAt: null, committed: false, note: null, notice: null, alert: null, ranOutOfCandidates: true });
    break;
  }
  await typeWidth(String(PIN_IN));
  const after12 = await evaluate(`(() => {
    const input = document.querySelector('input[aria-label="Panel width in inches"]');
    const ps = [...document.querySelectorAll('p')].map((x) => x.textContent.trim());
    return {
      draft: input ? input.value : null,
      note: ps.find((t) => t.startsWith('Hand-set') || t.startsWith('Automatic')) ?? null,
      notice: ps.find((t) => t.startsWith('Refused:') || t.startsWith('That width')) ?? null,
      alert: (() => { const a = document.querySelector('[role="alert"]'); return a ? a.textContent.trim() : null; })(),
    };
  })()`);
  const committed = typeof after12.note === "string" && /^Hand-set at 48/.test(after12.note);
  attempts.push({ selectedAt: picked.label, committed, note: after12.note, notice: after12.notice, alert: after12.alert });
  totals.push((await widthsNow()).reduce((a, b) => a + b, 0));
  if (!committed) {
    refusal12 = { ...after12, selectedAt: picked.label, widthBefore: picked.field };
    await shot("12-locked-width-refused");
    // Put the field back: the refused draft is still in the box, exactly as the
    // sub-minimum refusal leaves it.
    await pressKey("Escape", "Escape", 27);
    await sleep(300);
  }
}
const widthsAfter12 = await widthsNow();
record(
  "locked-width-refused-whole",
  {
    wall: wallForStep12,
    attempts: attempts.length,
    honoured: attempts.filter((a) => a.committed).length,
    ranOutOfCandidates: attempts.some((a) => a.ranOutOfCandidates === true),
    attemptDetail: attempts,
    refusedAt: refusal12 ? refusal12.selectedAt : null,
    noticeOnRefusal: refusal12 ? refusal12.notice : null,
    noteOnRefusal: refusal12 ? refusal12.note : null,
    // ⚠ Two refusals, two different things in the box, and both are right.
    // The sub-minimum refusal (step 6) is a `validate` refusal: the commit never
    // happens and the user's own text stays there to be corrected. THIS one is
    // refused inside the commit, so LengthInput redisplays the stored width —
    // which is itself the proof that the stored width did not change.
    fieldAfterRefusal: refusal12 ? refusal12.draft : null,
    widthBeforeRefusal: refusal12 ? refusal12.widthBefore : null,
    // The invariant, read off the drawing after every single attempt.
    totals,
    totalNeverMoved: totals.every((t) => Math.abs(t - beforeTotal) < 1e-6),
    widestAfter: widthsAfter12.length > 0 ? Math.max(...widthsAfter12) : null,
    narrowestAfter: widthsAfter12.length > 0 ? Math.min(...widthsAfter12) : null,
  },
  // Five things, and the fixture check is one of them:
  //  1. the feature still WORKS — at least two pins at the catalog maximum were
  //     honoured before anything was refused. A refusal that refuses everything
  //     is not what Tommy asked for.
  //  2. one pin was refused, and the refusal SAYS something: it starts with
  //     "Refused:" and quotes a width ("right now is ..."), which is the half of
  //     his decision about the message.
  //  3. nothing was committed on the refusal — the note still describes the
  //     panel as it was, and the typed draft is still in the box to correct.
  //  4. THE WALL'S OWN LENGTH NEVER MOVED, across every attempt including the
  //     refused one. 362 walls of an 8,004-case fixture used to come out off
  //     their own length here. ⚠ But on a FOUR-panel wall `main` holds this too
  //     (see the note above): the old shed’s unbounded neighbour keeps the sum
  //     while going unbuildable, and the one attempt that WOULD move the total
  //     is the one `retileWallAroundPins` already refuses. Asserted because it is
  //     the property Tommy asked for and the no-free-slot walls DO break it, not
  //     because it is what makes this step red on `main`.
  //  5. no panel on the wall ended up outside the shop's range, which the old
  //     unbounded shed could not promise either.
  (d) =>
    d.honoured >= 2 &&
    d.ranOutOfCandidates === false &&
    d.refusedAt !== null &&
    typeof d.noticeOnRefusal === "string" &&
    d.noticeOnRefusal.startsWith("Refused:") &&
    d.noticeOnRefusal.includes("right now is") &&
    typeof d.noteOnRefusal === "string" &&
    !/^Hand-set at 48/.test(d.noteOnRefusal) &&
    asInches(d.fieldAfterRefusal) === asInches(d.widthBeforeRefusal) &&
    d.totalNeverMoved === true &&
    d.narrowestAfter >= FABRICATION_MIN_IN &&
    d.widestAfter <= 48,
);

console.log("12b. a residual-CANCELLING pin pair survives one unrelated retile");
/**
 * **MUST-FIX 1, end to end in a browser, 2026-09-30.** The first version of the
 * locked-width refusal planned each pin against the FREE run only, so every
 * other pin was an immovable obstacle and a wall whose standard-family slots
 * were all pinned lost every one of its hand-set widths on the next retile —
 * widths `main` kept correctly. `planLockedWidthReforce` now plans the pinned
 * set JOINTLY, so pins whose residuals cancel cost nothing.
 *
 * This step is the gesture that produces that shape, which is not an edge case:
 *
 *   1. **The elevation boundary drag writes `lockedWidthIn` on BOTH halves of
 *      the pair it moves** (`handleDragResizePanels`), each half to a different
 *      width, and the pair's total is unchanged — i.e. every single drag leaves
 *      a residual-cancelling pair. Dragging every boundary on a run pins every
 *      panel on it and leaves no automatic panel at all.
 *   2. **Then ONE unrelated retile, from a different wall.** A run-stop change
 *      calls `retileAllForRunStops`, which re-reconciles EVERY wall in the
 *      building against its own stored slots — so this wall's pins are all
 *      re-forced although nothing about this wall changed. That is exactly how
 *      the regression was reachable: `retile.ts`'s preserving path means an edit
 *      anywhere wipes a pinned run that cannot be re-forced.
 *
 * ⚠ **On the per-pin planner every hand-set width on this wall is lost here**,
 * silently, and the wall is left perfectly legal — which is why nothing else in
 * this harness would have caught it. The fixture check `automaticPanelsLeft === 0`
 * is load bearing: with one automatic panel left the pair can lean on it and the
 * per-pin planner passes too.
 */

/** The Stop Wall field for one end — lifted from `smearforn-stage-3/run.mjs`,
 * which is where this control's selector and its native-setter commit were
 * worked out. Used here only as a cheap BUILDING-WIDE RETILE that leaves this
 * wall's own length alone, not as a test of run stops. */
const stopFieldState = async (end) =>
  await evaluate(`(() => {
    const el = document.querySelector('[id^="wall-run-stop-${end}-"]');
    if (!el) return null;
    const wrap = el.closest('label') || el.parentElement;
    const msg = wrap ? [...wrap.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.length > 0) ?? null : null;
    return { id: el.id, value: el.value, invalid: el.getAttribute('aria-invalid') === 'true', message: msg };
  })()`);
const commitStop = async (end, text) => {
  await evaluate(`(() => {
    const el = document.querySelector('[id^="wall-run-stop-${end}-"]');
    if (!el) throw new Error('no stop field');
    el.scrollIntoView({ block: 'center' });
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(String(text))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);
  await sleep(900);
};
/** Walks the dial to the first elevation stop that satisfies `ok`, or null. */
const walkToElevation = async (ok) => {
  for (let i = 0; i < 16; i++) {
    const stop = await currentViewLabel();
    if (typeof stop === "string" && stop.startsWith("Elevation:") && (await ok(stop))) return stop;
    await stepViewerDial();
    await sleep(500);
  }
  return null;
};

// A wall this run has NOT already pinned at 48in — step 12 left its own wall in
// a refused state, and reusing it would conflate two things.
const wall12b = await walkToElevation(async (stop) => {
  if (stop === wallForStep12.view) return false;
  const n = (await allElevationWidths()).length;
  return n >= 3 && n <= 8;
});
if (!wall12b) throw new Error("no second elevation with 3-8 panel labels for the cancelling-pair check");
await sleep(600);
const total12bStart = (await widthsNow()).reduce((a, b) => a + b, 0);

// ⚠ GET EVERY BOUNDARY ON SCREEN FIRST, and verify it rather than assume it.
// `dragHandles` filters to strips inside the window because a mousedown at an
// off-screen coordinate hits nothing — the same lesson step 12 and
// `panelWidthLabels` already learned. The first version of this step did not
// zoom, reached 1 of 3 boundaries on a 4-panel wall, and so left two automatic
// panels on the run: the fixture check below caught it, but the loop had already
// failed for a reason that has nothing to do with the app. Zoom out until the
// count of REACHABLE strips equals the count of strips that exist.
for (let z = 0; z < 8; z++) {
  const reachable = (await dragHandles()).length;
  const existing = (await allStripXs()).length;
  if (existing > 0 && reachable === existing) break;
  await clickViewButton("Zoom out");
  await sleep(350);
}
const boundariesReachable = (await dragHandles()).length;
const boundariesOnTheWall = (await allStripXs()).length;

// ⚠ **A drag cannot reach every panel, and the order matters because of it.**
// A drag strip only exists between two ADJACENT resizable panels, so a panel
// isolated by the Safety/Gap spacer (or sitting against a corner with an opening
// beside it) has no boundary to be dragged by and no drag will ever pin it. On
// this run the first version of this step reached 2 of 3 panels that way and left
// one automatic — and once the others are pinned that panel can NEVER be pinned
// by typing either: it would be the only free slot, so the only width the wall
// would accept there is the one it already has, and `LengthInput` does not commit
// a no-op. **So the unreachable panels are typed FIRST, while there is still a
// free run to pay for them, and the drags come second.**
const stripsSorted = (await allStripXs()).slice().sort((a, b) => a - b);
const labelsSorted = (await panelWidthLabels()).slice().sort((a, b) => a.x - b.x);
const aStripLiesBetween = (a, b) => stripsSorted.some((sx) => sx > a && sx < b);
const typedFirst12b = [];
for (let i = 0; i < labelsSorted.length; i++) {
  const l = labelsSorted[i];
  const before = labelsSorted[i - 1];
  const after = labelsSorted[i + 1];
  const draggable = (before && aStripLiesBetween(before.x, l.x)) || (after && aStripLiesBetween(l.x, after.x));
  if (draggable) continue;
  await click(l.x, l.y);
  await sleep(350);
  const f = await widthField();
  if (!f) continue; // a corner, an opening or the gap itself: no width to set
  const nowIn = parseImperial(l.label);
  if (!Number.isFinite(nowIn)) continue;
  // A small real change, so the field actually commits, in whichever direction
  // the wall can pay for.
  let committedAt = null;
  for (const wantIn of [nowIn + 2, nowIn - 2]) {
    if (wantIn < FABRICATION_MIN_IN || wantIn > 48) continue;
    await typeWidth(String(wantIn));
    const note = await evaluate(`(() => {
      const ps = [...document.querySelectorAll('p')].map((x) => x.textContent.trim());
      return ps.find((t) => t.startsWith('Hand-set') || t.startsWith('Automatic')) ?? null;
    })()`);
    if (typeof note === "string" && note.startsWith("Hand-set")) {
      committedAt = wantIn;
      break;
    }
  }
  typedFirst12b.push({ label: l.label, committedAt });
}

// (a) Drag every boundary on the run. Each drag pins the two panels it touches.
const drags12b = [];
const handleCount12b = (await dragHandles()).length;
for (let i = 0; i < handleCount12b; i++) {
  const h = (await dragHandles())[i];
  if (!h) break;
  const inPerPx = (await inchesPerScreenPx()) ?? 1;
  // Alternating, and small: the point is to PIN both halves, not to re-test the
  // drag's own arithmetic (step 9 does that). Alternating keeps a long run from
  // walking one panel down onto the 24in floor drag after drag.
  const dxPx = Math.round((i % 2 === 0 ? 3 : -3) / inPerPx) || (i % 2 === 0 ? 3 : -3);
  await mouse("mousePressed", h.x, h.y);
  await sleep(60);
  await mouse("mouseMoved", h.x + dxPx, h.y);
  await sleep(120);
  await mouse("mouseReleased", h.x + dxPx, h.y);
  await sleep(500);
  drags12b.push({ handle: i, dxPx });
}

// Which panels are hand-set now, read off the Selected Panel note one at a time.
// The automatic count is the fixture check.
const pinned12b = [];
let automaticPanelsLeft = 0;
for (const l of await panelWidthLabels()) {
  await click(l.x, l.y);
  await sleep(300);
  const st = await evaluate(`(() => {
    const ps = [...document.querySelectorAll('p')].map((x) => x.textContent.trim());
    const note = ps.find((t) => t.startsWith('Hand-set') || t.startsWith('Automatic')) ?? null;
    const input = document.querySelector('input[aria-label="Panel width in inches"]');
    return { note, field: input ? input.value : null };
  })()`);
  if (!st.note) continue; // a corner, an opening or the safety gap: no width field
  if (st.note.startsWith("Hand-set")) pinned12b.push({ label: l.label, field: st.field });
  else automaticPanelsLeft++;
}
const widthsBeforeRetile12b = await widthsNow();
await shot("12b-pinned-pairs-before-retile");

// (b) One unrelated retile, from a THIRD wall.
const stopWall12b = await walkToElevation(async (stop) => stop !== wall12b && stop !== wallForStep12.view);
if (!stopWall12b) throw new Error("no third elevation to take the unrelated retile on");
await sleep(500);
await commitStop("start", 12);
const stopState12b = await stopFieldState("start");

// Back to our wall, which nobody touched.
const returned12b = await walkToElevation(async (stop) => stop === wall12b);
await sleep(700);
const widthsAfterRetile12b = await widthsNow();

// And a SECOND retile, undoing the stop: the planner is a fixpoint, so the pins
// have to survive this one too, and the wall must not depend on edit history.
const stopWallAgain = await walkToElevation(async (stop) => stop === stopWall12b);
await sleep(500);
if (stopWallAgain) await commitStop("start", 0);
await walkToElevation(async (stop) => stop === wall12b);
await sleep(700);
const widthsAfterUnstop12b = await widthsNow();
await shot("12c-pinned-pairs-after-unrelated-retile");

const sameWidths = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
const totalOf = (w) => w.reduce((a, b) => a + b, 0);
record(
  "locked-width-cancelling-pair-survives-a-retile",
  {
    wall: wall12b,
    retiledFrom: stopWall12b,
    returnedTo: returned12b,
    stopCommitted: stopState12b,
    typedFirst: typedFirst12b,
    drags: drags12b,
    pinnedPanels: pinned12b.length,
    pinnedDetail: pinned12b,
    // THE FIXTURE CHECK. The regression only bites when the pinned set has no
    // automatic panel to lean on; with one left, the per-pin planner passes too
    // and this step would be green for the wrong reason.
    automaticPanelsLeft,
    boundariesReachable,
    boundariesOnTheWall,
    widthsBeforeRetile: widthsBeforeRetile12b,
    widthsAfterRetile: widthsAfterRetile12b,
    widthsAfterUnstop: widthsAfterUnstop12b,
    // ⚠ THE WHOLE POINT: identical, panel for panel. On the per-pin planner
    // every one of these reverts to the width the tiler computes.
    survivedTheRetile: sameWidths(widthsBeforeRetile12b, widthsAfterRetile12b),
    survivedASecondRetile: sameWidths(widthsBeforeRetile12b, widthsAfterUnstop12b),
    totals: [total12bStart, totalOf(widthsBeforeRetile12b), totalOf(widthsAfterRetile12b), totalOf(widthsAfterUnstop12b)],
    totalNeverMoved: [widthsBeforeRetile12b, widthsAfterRetile12b, widthsAfterUnstop12b].every(
      (w) => Math.abs(totalOf(w) - total12bStart) < 1e-6,
    ),
    narrowestAfter: widthsAfterUnstop12b.length > 0 ? Math.min(...widthsAfterUnstop12b) : null,
    widestAfter: widthsAfterUnstop12b.length > 0 ? Math.max(...widthsAfterUnstop12b) : null,
  },
  // 1. the drag really pinned a pair (at least two panels hand-set), and
  // 2. it pinned ALL of them, which is the shape per-pin planning refused, and
  // 3. every hand-set width is still there after an unrelated retile, and
  // 4. after a second one, because the planner has to be a fixpoint, and
  // 5. the wall's own length never moved at any point, and
  // 6. the unrelated retile really was applied rather than refused, and
  // 7. nothing on the wall ended outside the shop's range.
  (d) =>
    d.pinnedPanels >= 2 &&
    d.automaticPanelsLeft === 0 &&
    d.boundariesReachable === d.boundariesOnTheWall &&
    d.stopCommitted !== null &&
    d.stopCommitted.invalid === false &&
    d.survivedTheRetile === true &&
    d.survivedASecondRetile === true &&
    d.totalNeverMoved === true &&
    // ⚠ `widestAfter` is RECORDED, not asserted: the boundary drag floors the
    // shrinking panel at 24in but puts no ceiling on the growing one, which
    // step 10 already records as `drag-has-no-ceiling`. Asserting it here would
    // make this step red for a pre-existing finding of the DRAG’s rather than
    // for anything about pin planning.
    d.narrowestAfter >= FABRICATION_MIN_IN,
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
