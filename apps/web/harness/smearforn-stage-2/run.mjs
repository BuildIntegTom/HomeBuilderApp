/**
 * Browser harness — Project Smearforn, Stage 2 (insert, replace, delete).
 *
 * **In the repo on purpose**, same as the Stage 0/1 harness next door, and
 * the plumbing below is that script's plumbing: a CDP session against a real
 * dev server in a real browser, screenshots and measurements checked in.
 *
 * What it drives:
 *   1. draw a footprint, open a wall elevation
 *   2. arm the Standard tool — insert markers appear, the drag strips go away
 *   3. insert at a boundary: one more panel, and the wall's own total is
 *      conserved to the eighth
 *   4. replace a panel with a Window by clicking its body (no cycling)
 *   5. delete a panel: one fewer, total still conserved
 *   6. a Big Header insert that does not fit is REFUSED, with the room stated
 *   7. corner panels refuse both replace and delete
 *   8. no uncaught exception anywhere in the run
 *
 * HOW TO RUN (from the repo root):
 *   1. `npm run dev --workspace=apps/web -- -p 3213`
 *   2. `chrome --headless=new --remote-debugging-port=9447 --user-data-dir=<temp> --window-size=1600,1000 about:blank`
 *      (**the window size is not optional** — see the README: a small
 *      headless window pushes the elevation off screen and every step here
 *      filters to what is on screen, so the run dies for no real reason)
 *   3. `node apps/web/harness/smearforn-stage-2/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`** — see the Stage 0/1 harness's own note
 * on why (the dynamic-import chunks never arrive over 127.0.0.1 and the
 * canvas silently never appears).
 *
 * `record()` REFUSES to run without an expectation, and the process exits
 * non-zero if any of them is false — the same rule the Stage 0/1 harness
 * adopted after a reviewer pointed out that a check which cannot fail is
 * not a check.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeViewStopControl } from "../viewStopControl.mjs";
import { makeElevationZoomControl } from "../elevationZoom.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.SMEARFORN_APP_URL ?? "http://localhost:3213/";
const CDP_PORT = process.env.SMEARFORN_CDP_PORT ?? "9447";

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, ranAt: new Date().toISOString(), steps: [] };
const failures = [];
const pageExceptions = [];

const observationOnly = (why) => ({ observationOnly: why });

const record = (name, detail, expected) => {
  const isObservation = expected !== null && typeof expected === "object" && typeof expected.observationOnly === "string";
  if (typeof expected !== "function" && !isObservation) {
    throw new Error(`record("${name}") was given no expectation.`);
  }
  let passed = null;
  let expectationError = null;
  if (typeof expected === "function") {
    try {
      passed = expected(detail) === true;
    } catch (err) {
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
  console.log(`  [${isObservation ? "observed" : passed ? "PASS" : "FAIL"}] ${name}: ${JSON.stringify(detail)}`);
};

let evidenceWritten = false;
const writeEvidence = () => {
  if (evidenceWritten) return;
  evidenceWritten = true;
  evidence.pageExceptions = pageExceptions;
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
    return;
  }
  // An uncaught exception in the page is a failure of this run, not a
  // curiosity — a tool that throws on click looks exactly like a tool that
  // refused, and only this catches the difference.
  if (m.method === "Runtime.exceptionThrown") {
    pageExceptions.push(m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text ?? "unknown");
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
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: 1, ...extra }, sid);

const click = async (x, y) => {
  await mouse("mousePressed", x, y);
  await sleep(60);
  await mouse("mouseReleased", x, y);
  await sleep(400);
};

// --- the wall, as the DOM shows it -----------------------------------------

/** Every panel width label on the elevation, in eighths, left to right. The
 * sum of them is the wall's own run width — the invariant every step checks. */
const panelWidths = async () =>
  await evaluate(`(() => {
    // Only the labels INSIDE a panel's own clickable group — the elevation
    // draws other inch figures (a story height, for one) that would
    // otherwise be counted as panels.
    const gs = [...document.querySelectorAll('svg g[data-panel-body]')];
    return gs
      .flatMap((g) => [...g.querySelectorAll('text')])
      .map((t) => t.textContent.trim())
      .filter((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t))
      .map((t) => Number(t.slice(0, -1)));
  })()`);

const sumEighths = (widths) => widths.reduce((sum, w) => sum + Math.round(w * 8), 0);

/** The placement tool's own buttons, by label. */
const toolButton = async (label) =>
  await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Panel placement tool"]');
    if (!group) return null;
    const b = [...group.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pressed: b.getAttribute('aria-pressed') === 'true' };
  })()`);

/**
 * Arms a tool and CHECKS IT ARMED.
 *
 * The first version of this harness just clicked where the button was, and
 * the left bar scrolls: a button below the fold means a click that lands on
 * something else entirely, and every step afterwards silently tests the
 * previous tool. Scroll it into view, click, then read `aria-pressed` back.
 */
const armTool = async (label) => {
  await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Panel placement tool"]');
    const b = group && [...group.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (b) b.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(250);
  const btn = await toolButton(label);
  if (!btn) throw new Error(`no "${label}" button in the placement group`);
  await click(btn.x, btn.y);
  await sleep(400);
  const after = await toolButton(label);
  if (!after || !after.pressed) throw new Error(`"${label}" did not arm — the click missed (button at ${btn.x},${btn.y})`);
  // Scrolling the button into view can take the elevation itself off screen,
  // and a click at an off-screen coordinate hits nothing and fails silently
  // — which looked exactly like "delete did nothing" the first time.
  await evaluate(`(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('g[style*="pointer"]'));
    if (svg) svg.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(350);
  return after;
};

/** The dashed insert targets drawn while a type is armed. */
const insertMarkers = async () =>
  await evaluate(`(() => {
    const gs = [...document.querySelectorAll('g')].filter((g) => (g.getAttribute('style') || '').includes('copy'));
    return gs
      .map((g) => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
      .filter((m) => m.x > 250 && m.x < window.innerWidth - 40 && m.y > 60 && m.y < window.innerHeight - 40);
  })()`);

const dragStripCount = async () => await evaluate(`document.querySelectorAll('rect[style*="ew-resize"]').length`);

/** The tool's own notice line, whatever it currently says. */
const placementNotice = async () =>
  await evaluate(`(() => {
    const ps = [...document.querySelectorAll('p')].map((p) => p.textContent.trim());
    return ps.find((t) => /^(Inserted|Replaced|Deleted|Refused|Corner and safety-gap|That panel is already)/.test(t)) ?? null;
  })()`);

/** Panel bodies (the coloured rects), left to right, with their own boxes. */
const panelBodies = async () =>
  await evaluate(`(() => {
    // Every clickable panel group in the document, NOT "the first svg that
    // has a text in it" — the compass widget is an svg with text in it and
    // it comes first, which cost this harness a run.
    return [...document.querySelectorAll('svg g')]
      .filter((g) => (g.getAttribute('style') || '').includes('pointer'))
      .filter((g) => [...g.querySelectorAll('text')].some((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t.textContent.trim())))
      .map((g) => {
        // ⚠ The click point is the PANEL RECT's centre, not the group's box.
        // A group's box also contains its width label, which is drawn wider
        // than a narrow panel is — so on the 0.75" safety-gap board the
        // group's centre sits somewhere over the NEIGHBOURING panel, or over
        // the seam between them. It was always the wrong point to click;
        // whether it landed on anything at all depended on the drawing's
        // scale, which is why the 2026-09-29 fit-height view moved it. What it
        // actually cost, measured rather than asserted:
        //   git show main:apps/web/harness/smearforn-stage-2/evidence.json
        //   records the DELETE step with
        //     refusalsOnTheWay: ["Replaced on wall AB: 16 panels → 16, ..."]
        //   — a STALE notice left over from the previous step, i.e. the first
        //   group-centre click hit nothing whatsoever and the loop moved on to
        //   the next body. After this fix that list is empty and the first
        //   click deletes.
        //
        // ⚠ **NOT "a green test was deleting a panel", which an earlier
        // version of this note claimed.** That escalation does not survive the
        // evidence: on main, step 8 recorded the correct rule-placed refusal
        // with panelsBefore 15 / panelsAfter 15 while Delete was STILL ARMED
        // from step 7, so a click on an ordinary panel there would have given
        // 14 panels and a "Deleted…" notice and FAILED the predicate.
        // Wall AB owns no corner panels, so that refusal can only have come
        // from the gap itself. The bug was a wasted click, not a false pass —
        // and the fix is worth having either way, because a click point that
        // sometimes lands on nothing will eventually land on the wrong thing.
        const box = g.getBoundingClientRect();
        const rect = g.querySelector('rect');
        const r = rect ? rect.getBoundingClientRect() : box;
        const label = [...g.querySelectorAll('text')].map((t) => t.textContent.trim()).find((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t));
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: box.width, label };
      })
      // ⚠ "w" IS THE GROUP BOX'S WIDTH, NOT THE RECT'S, AND THAT IS ON
      // PURPOSE even though the click point above is the rect. It reads like
      // an oversight, so: the "w > 4" filter is here to drop groups that are
      // not really panels, and at the zoomed-out whole-wall fit the safety
      // gap's own RECT is about 1.4px wide — filtering on the rect would throw
      // away the 0.75" board that step 8 exists to click. The group box
      // (panel + its width label) is a stable "is this a panel group" measure
      // at any scale; the rect is the right place to CLICK. Two different
      // questions, two different boxes.
      .filter((p) => p.w > 4 && p.x > 250 && p.x < window.innerWidth - 40 && p.y > 60 && p.y < window.innerHeight - 40);
  })()`);

// --- the run ----------------------------------------------------------------
console.log("1. loading the app");
await send("Page.navigate", { url: APP_URL }, sid);
await sleep(12000);

console.log("2. drawing a footprint");
const canvasBox = await evaluate(`(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
if (!canvasBox) throw new Error("no canvas — are you on localhost rather than 127.0.0.1?");
const [cx, cy, cw, ch] = canvasBox;
const x0 = cx + 60;
const y0 = cy + 80;
const x1 = cx + cw - 80;
const y1 = cy + ch - 120;
await mouse("mousePressed", x0, y0);
await sleep(80);
await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
await sleep(80);
await mouse("mouseMoved", x1, y1);
await sleep(80);
await mouse("mouseReleased", x1, y1);
await sleep(1500);

console.log("3. opening a wall elevation");
/**
 * ⚠ THIS HARNESS LAUNCHES CHROME AT 1600px, WHICH IS WHY THIS CHANGED.
 * U1 (2026-09-28) made the sidebar dial the below-1200px form of the view
 * control and put Design and View menus on the top bar at 1200 and up. At
 * 1600 there is no dial at all, so the old locator — "the button whose text
 * is ▼" — would have matched nothing and `dialDown` would have been null:
 * the run would have died on a null dereference, or worse, stepped nowhere
 * six times and reported "could not reach a wall elevation" as if the
 * elevation were the problem. The shared driver asks the page which form is
 * live.
 *
 * The two questions are still kept apart, as the Stage 0/1 harness's note
 * explains: the CONTROL says whether this is an elevation, and the drag-strip
 * count says whether it is a wall THIS run can drag on.
 */
const view = makeViewStopControl({ evaluate, sleep });
let elevationReady = false;
const stopsTried = [];
for (let i = 0; i < 6 && !elevationReady; i++) {
  stopsTried.push(await view.step());
  await sleep(800);
  elevationReady = (await dragStripCount()) > 0;
}
if (!elevationReady) {
  throw new Error(
    `could not reach a wall elevation with two adjacent draggable panels; the view control offered ${JSON.stringify(stopsTried)}`,
  );
}
/**
 * ⚠ AND NOW THE WHOLE WALL HAS TO BE BROUGHT ON SCREEN, WHICH USED TO BE FREE.
 * Before 2026-09-29 an elevation rendered a few hundred pixels wide whatever
 * the window, so every panel was always visible; since Tommy's fit-height /
 * scroll-width change a 48ft wall is wider than the window and `panelBodies`
 * — which filters to the viewport, correctly, because it returns things to
 * CLICK — would simply not find the safety-gap board in step 8. That fails by
 * finding fewer elements rather than by raising, so the step says out loud
 * that it needs the whole wall, and records whether it got it.
 */
const wholeWall = await makeElevationZoomControl({ evaluate, sleep, click }).fitWholeWall();
record(
  "whole-wall-on-screen",
  wholeWall,
  // Everything below locates panels by reading the DOM and filtering to the
  // viewport; if the wall does not fit, those readers see a subset and the
  // steps go quietly vacuous.
  (d) => d.wholeWallVisible === true,
);
await shot("00-wall-elevation");

const before = await panelWidths();
const dragStripsBefore = await dragStripCount();
record(
  "wall-as-tiled",
  { panelCount: before.length, totalEighths: sumEighths(before), widths: before },
  // Everything below counts panels and sums eighths, so a wall that did not
  // draw would make every later step vacuous.
  (d) => d.panelCount >= 4 && d.totalEighths > 0,
);

console.log("4. arming the Standard tool");
await armTool("Standard");
const markers = await insertMarkers();
const dragStripsArmed = await dragStripCount();
record(
  "tool-armed",
  { insertMarkers: markers.length, dragStripsBefore, dragStripsArmed },
  // The boundaries a panel can go at become visible, and the drag strips
  // stand down so one strip never means two things.
  (d) => d.insertMarkers > 0 && d.dragStripsBefore > 0 && d.dragStripsArmed === 0,
);
await shot("01-tool-armed-insert-targets");

console.log("5. inserting at a boundary");
const target = markers[Math.floor(markers.length / 2)];
await click(target.x, target.y);
await sleep(700);
const afterInsert = await panelWidths();
const insertNotice = await placementNotice();
record(
  "insert",
  {
    notice: insertNotice,
    panelsBefore: before.length,
    panelsAfter: afterInsert.length,
    totalEighthsBefore: sumEighths(before),
    totalEighthsAfter: sumEighths(afterInsert),
  },
  // One more panel, and the wall's own total length has not moved by an
  // eighth. (An insert the automatic run had to pay for by absorbing a panel
  // is a legal outcome too — but not on this wall, which has slack.)
  (d) => d.panelsAfter === d.panelsBefore + 1 && d.totalEighthsAfter === d.totalEighthsBefore,
);
await shot("02-after-insert");

console.log("6. replacing a panel with a window");
await armTool("Window");
const bodiesForReplace = await panelBodies();
let replaceNotice = null;
let afterReplace = afterInsert;
// Walk inward from the middle: the ends are the corner panels, which
// correctly refuse, and this step is about the replace itself.
for (const b of bodiesForReplace.slice(1, bodiesForReplace.length - 1)) {
  await click(b.x, b.y);
  await sleep(600);
  const notice = await placementNotice();
  if (notice && notice.startsWith("Replaced")) {
    replaceNotice = notice;
    afterReplace = await panelWidths();
    break;
  }
}
record(
  "replace",
  {
    notice: replaceNotice,
    panels: afterReplace.length,
    panelsBefore: afterInsert.length,
    totalEighths: sumEighths(afterReplace),
    totalEighthsBefore: sumEighths(afterInsert),
  },
  // A replace changes a type, never a count and never the wall's length.
  (d) => typeof d.notice === "string" && d.panels === d.panelsBefore && d.totalEighths === d.totalEighthsBefore,
);
await shot("03-after-replace");

console.log("7. deleting a panel");
const panelsBeforeDelete = await panelWidths();
await armTool("Delete");
// The drag strips must stand down for DELETE too, not just for a placement
// type: they sit on top of the panel bodies, so a click near a panel edge
// started a resize drag instead of deleting the panel under the cursor.
const dragStripsWithDeleteArmed = await dragStripCount();
record(
  "delete-mode-suspends-the-drag",
  { dragStripsWithDeleteArmed },
  (d) => d.dragStripsWithDeleteArmed === 0,
);
const bodiesForDelete = await panelBodies();
let deleteNotice = null;
let afterDelete = panelsBeforeDelete;
const deleteRefusals = [];
for (const b of bodiesForDelete.slice(1, bodiesForDelete.length - 1)) {
  await click(b.x, b.y);
  await sleep(600);
  const notice = await placementNotice();
  if (notice && notice.startsWith("Deleted")) {
    deleteNotice = notice;
    afterDelete = await panelWidths();
    break;
  }
  if (notice) deleteRefusals.push(notice);
}
record(
  "delete",
  {
    notice: deleteNotice,
    refusalsOnTheWay: deleteRefusals.slice(0, 3),
    panelsBefore: panelsBeforeDelete.length,
    panelsAfter: afterDelete.length,
    totalEighthsBefore: sumEighths(panelsBeforeDelete),
    totalEighthsAfter: sumEighths(afterDelete),
  },
  // One fewer panel, and the wall's length still has not moved.
  (d) => d.panelsAfter === d.panelsBefore - 1 && d.totalEighthsAfter === d.totalEighthsBefore,
);
await shot("04-after-delete");

// The safety-gap board, not a corner: on a plain rectangle the corner panels
// are attributed to ONE pair of opposite walls, so the wall this run happens
// to open may own none at all — but every wall over 12ft has a gap. It is
// rule-placed for the same reason and refuses in the same words.
console.log("8. a rule-placed panel (the safety gap) refuses");
const bodiesForGap = await panelBodies();
if (bodiesForGap.length === 0) throw new Error("no panel bodies on screen — did the elevation scroll out of view?");
const gapBody = bodiesForGap.find((b) => b.label === '0.75"');
if (!gapBody) throw new Error(`no safety-gap panel on this wall (labels: ${bodiesForGap.map((b) => b.label).join(",")})`);
const panelsBeforeGapClick = await panelWidths();
await click(gapBody.x, gapBody.y);
await sleep(600);
const gapNotice = await placementNotice();
const panelsAfterGapClick = await panelWidths();
record(
  "rule-placed-panel-refuses",
  {
    // ⚠ WHICH rule-placed panel was clicked, asserted alongside the notice.
    // The refusal is worded identically for a corner and for the safety gap
    // ("Corner and safety-gap panels are placed by rule…"), so the notice
    // alone cannot tell them apart: on a wall that DOES own corner panels
    // this step could pass having clicked a corner while the gap — the narrow
    // one, the one whose click point was wrong — went untested. This wall
    // (AB on a plain rectangle) owns no corners, but that is a property of the
    // fixture, not of the check.
    clickedLabel: gapBody.label,
    notice: gapNotice,
    panelsBefore: panelsBeforeGapClick.length,
    panelsAfter: panelsAfterGapClick.length,
  },
  // The 0.75" board specifically, refused in those words, and the wall does
  // not lose a panel.
  (d) =>
    d.clickedLabel === '0.75"' &&
    typeof d.notice === "string" &&
    d.notice.startsWith("Corner and safety-gap") &&
    d.panelsAfter === d.panelsBefore,
);
await shot("05-rule-placed-refusal");

// LAST, because it deliberately fills the wall up: every Big Header takes
// 8ft out of the automatic run, so the wall runs out of room and the refusal
// is what this step is here to read.
console.log("9. a Big Header insert that does not fit is refused");
await armTool("Big Header");
let refusal = null;
let panelsAtRefusal = null;
let bigHeadersPlaced = 0;
for (let attempt = 0; attempt < 8 && refusal === null; attempt++) {
  const markersNow = await insertMarkers();
  if (markersNow.length === 0) break;
  const m = markersNow[Math.floor(markersNow.length / 2)];
  await click(m.x, m.y);
  await sleep(600);
  const notice = await placementNotice();
  if (notice && notice.startsWith("Refused")) {
    refusal = notice;
    panelsAtRefusal = (await panelWidths()).length;
  } else if (notice && notice.startsWith("Inserted")) {
    bigHeadersPlaced++;
  }
}
record(
  "refused-insert-states-the-room",
  { refusal, bigHeadersPlaced, panelsAtRefusal },
  // When the wall runs out of room the refusal has to say how much automatic
  // width there actually is — not just that it said no.
  (d) => typeof d.refusal === "string" && /automatic panel width/.test(d.refusal),
);
await shot("06-refused-insert");

record(
  "no-uncaught-exceptions",
  { count: pageExceptions.length, first: pageExceptions[0] ?? null },
  // A tool that throws on click looks exactly like a tool that refused.
  (d) => d.count === 0,
);

writeEvidence();
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall checks passed");
process.exit(0);
