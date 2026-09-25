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
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.SMEARFORN_APP_URL ?? "http://localhost:3210/";
const CDP_PORT = process.env.SMEARFORN_CDP_PORT ?? "9444";

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, ranAt: new Date().toISOString(), steps: [] };
const record = (name, detail) => {
  evidence.steps.push({ name, ...detail });
  console.log(`  ${name}: ${JSON.stringify(detail)}`);
};

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
await sleep(9000);

// Stage 0: a brand-new project has Foundation OFF, so the nav offers Wall only.
const navTabs = await evaluate(`(() => {
  const nav = document.querySelector('nav') || document.body;
  return [...nav.querySelectorAll('button, a')].map((e) => e.textContent.trim()).filter((t) => ['Wall','Foundation','Floor','Roof'].includes(t));
})()`);
record("stage0-new-project-tabs", { navTabs });
await shot("00-stage0-new-project-wall-only");

// Panelizer: the four scope checkboxes, Foundation among them and unchecked.
const panelizerScope = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Project'));
  return btn ? 'project-menu-found' : 'no-project-menu';
})()`);
record("panelizer-probe", { panelizerScope });

console.log("2. drawing a footprint");
const canvasBox = await evaluate(`(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
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
await sleep(1200);
await shot("01-footprint-drawn");

console.log("3. opening a wall elevation");
// The viewer dial's down arrow steps: plan -> each wall's elevation -> 3D.
const dialDown = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '▼');
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
})()`);
let elevationReady = false;
for (let i = 0; i < 6 && !elevationReady; i++) {
  await click(dialDown[0], dialDown[1]);
  await sleep(700);
  elevationReady = await evaluate(`document.querySelectorAll('rect[style*="ew-resize"]').length > 0`);
}
if (!elevationReady) throw new Error("could not reach a wall elevation with panel drag handles");

// Zoom the elevation in, so the drag below has enough pixels per inch to land
// somewhere interesting (at 100% on a 48ft wall, one pixel is about two
// inches, and every drag lands inside the ±2in snap window around the floor).
const zoomIn = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.title === 'Zoom in');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
})()`);
for (let i = 0; i < 3 && zoomIn; i++) await click(zoomIn[0], zoomIn[1]);
await sleep(500);
await shot("02-wall-elevation");

/**
 * Every clickable panel WIDTH LABEL on the elevation, with its own box.
 *
 * The label is the selection gesture (Tommy: "click the numerical value of
 * width of one panel") — clicking the panel's body runs the type cycle
 * instead, which from a standard panel produces a window.
 */
const panelWidthLabels = async () =>
  await evaluate(`(() => {
    const svg = document.querySelector('svg rect[style*="ew-resize"]')?.ownerSVGElement;
    if (!svg) return [];
    return [...svg.querySelectorAll('text')]
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
record("panel-width-labels", { count: labels.length, first: labels.slice(0, 4).map((l) => l.label) });
let selected = null;
for (const l of labels.slice(1, 8)) {
  await click(l.x, l.y);
  await sleep(500);
  selected = await widthField();
  if (selected) break;
}
if (!selected) throw new Error("no panel width field appeared — is a standard/braced panel selected?");
record("selected-panel", { startingWidth: selected.value });
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
record("typed-width", { field: afterTyped?.value, note: noteAfterTyped });
await shot("04-typed-width-41-1-2");

console.log("6. refusing below the 24in minimum");
await typeWidth("20");
const refusal = await evaluate(`(() => {
  const alert = document.querySelector('[role="alert"]');
  const input = document.querySelector('input[aria-label="Panel width in inches"]');
  return { message: alert ? alert.textContent.trim() : null, draft: input.value, invalid: input.getAttribute('aria-invalid') === 'true' };
})()`);
record("refusal-below-minimum", refusal);
await shot("05-refusal-below-24in");

// Escape reverts the draft, leaving the committed 41.5in untouched.
await pressKey("Escape", "Escape", 27);
await sleep(400);
record("after-escape", { field: (await widthField())?.value });

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
record("adu-widths", { results: aduResults, anyRefused: aduResults.some((r) => r.refused) });
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
record("per-panel-reset", afterReset);
await shot("08-after-reset-automatic");

console.log("9. dragging a panel boundary");
/** The drag handle between the pair of panels at `index`. */
const dragHandle = async (index) =>
  await evaluate(`(() => {
    const h = [...document.querySelectorAll('rect[style*="ew-resize"]')][${index}];
    if (!h) return null;
    const b = h.getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  })()`);

const widthsBeforeDrag = (await panelWidthLabels()).map((l) => l.label);

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

const widthsAfterFineDrag = (await panelWidthLabels()).map((l) => l.label);
// The run total, not just the dragged pair: a drag moves width between two
// panels, so the sum of every visible panel on the wall must come out
// unchanged to the inch.
const pairBefore = widthsBeforeDrag.map(parseImperial).reduce((a, b) => a + b, 0);
const pairAfter = widthsAfterFineDrag.map(parseImperial).reduce((a, b) => a + b, 0);
record("drag-fine", {
  before: widthsBeforeDrag,
  after: widthsAfterFineDrag,
  everyWidthIsAWholeEighth: widthsAfterFineDrag.every((w) => isWholeEighth(parseImperial(w))),
  runTotalBefore: pairBefore,
  runTotalAfter: pairAfter,
  runTotalConserved: Math.abs(pairBefore - pairAfter) < 1e-9,
});

// (b) A LONG drag past the floor: the shrinking panel stops at the catalog
// minimum (24in) rather than going below what the shop can build.
const handle2 = await dragHandle(1);
await mouse("mousePressed", handle2[0], handle2[1]);
await sleep(80);
await mouse("mouseMoved", handle2[0] + 90.9, handle2[1]);
await sleep(200);
await mouse("mouseReleased", handle2[0] + 90.9, handle2[1]);
await sleep(700);
const widthsAfterFloorDrag = (await panelWidthLabels()).map((l) => l.label);
record("drag-to-the-floor", {
  after: widthsAfterFloorDrag,
  hitsTheCatalogMinimum: widthsAfterFloorDrag.some((w) => parseImperial(w) === 24),
  nothingBelowTheMinimum: widthsAfterFloorDrag.every((w) => parseImperial(w) >= 24),
});
await shot("10-drag-floors-at-24in");

fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
console.log("\nevidence -> evidence.json");
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
