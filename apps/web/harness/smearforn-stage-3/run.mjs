/**
 * Browser harness — Project Smearforn, Stage 3 (a wall that simply ends).
 *
 * **In the repo on purpose**, same as the Stage 0/1 and Stage 2 harnesses
 * next door, and the plumbing below is theirs: a CDP session against a real
 * dev server in a real browser, screenshots and measurements checked in.
 *
 * Stage 3 is almost entirely a DRAWING change, and nothing that changed
 * visually had ever been looked at before this script existed. It also
 * carries the regression pin for the defect the code review found: a memo in
 * `Building3DView` read `wallRunStopsByWallId` without listing it as a
 * dependency, so the 3D truss plate stayed drawn at full length across an
 * unbuilt span. No unit test could see that; this can.
 *
 * ### The trick that makes the 3D assertions exact
 *
 * The 3D view is WebGL, so there is no DOM to query and a pixel diff cannot
 * tell "the plate is stale" from "the panels moved". But `Export as OBJ`
 * builds its geometry from **the same memos the scene renders**, so
 * intercepting that blob gives a precise, textual model of what is actually
 * in the 3D scene — every member as world-space vertices, grouped by
 * `wall_*` / `roofbearing_*` labels. Every 3D claim below is measured off
 * that, not off a screenshot.
 *
 * What it drives:
 *   1. draw a footprint, turn Roof on (so a truss plate exists at all)
 *   2. baseline: the wall's panels and its truss plate both span the wall
 *   3. set a 60in start stop — the elevation loses exactly 60in of panel run
 *      and the wall's own total is conserved to the eighth
 *   4. the unbuilt span draws as a dashed NO PANELS boundary in elevation
 *   5. the panel-boundary drag still hit-tests on a stopped wall (the
 *      elevation's `yPx` moved by a conditional bottom margin)
 *   6. the live plan canvas draws the boundary too
 *   7. the printable Plan View sheet carries a NO PANELS dimension
 *   8. in 3D: NO geometry at all across the unbuilt span, and the truss
 *      plate starts 60in along and is 60in shorter
 *   9. THE MEMO PIN: forcing the roof-bearing memo to recompute (Roof off,
 *      Roof on) must not change the scene. If it does, the scene was stale.
 *  10. clearing the stop restores the wall, the plate and the 3D scene
 *  11. a stop that leaves a run too short to tile is REFUSED, and the wall
 *      is left exactly as it was
 *  12. no uncaught exception anywhere in the run
 *
 * HOW TO RUN (from the repo root):
 *   1. `npm run dev --workspace=apps/web -- -p 3214`
 *   2. `chrome --headless=new --remote-debugging-port=9448 --user-data-dir=<temp> about:blank`
 *   3. `node apps/web/harness/smearforn-stage-3/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`** — see the Stage 0/1 harness's own note
 * (the dynamic-import chunks never arrive over 127.0.0.1 and the canvas
 * silently never appears).
 *
 * `record()` REFUSES to run without an expectation, and the process exits
 * non-zero if any of them is false — the same rule the Stage 0/1 harness
 * adopted after a reviewer pointed out that a check which cannot fail is not
 * a check. There is no unconditional `process.exit(0)` in this file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.SMEARFORN_APP_URL ?? "http://localhost:3214/";
const CDP_PORT = process.env.SMEARFORN_CDP_PORT ?? "9448";

/** The stop this run sets. A whole number of eighths, comfortably over the
 * 24in fabrication minimum so the remaining run stays legal. */
const STOP_IN = 60;

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, ranAt: new Date().toISOString(), stopIn: STOP_IN, steps: [] };
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
  evidence.failures = failures;
  fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log("\nevidence -> evidence.json");
};
process.on("exit", writeEvidence);
// A throw partway through must still be a FAILURE, not a silent stop with a
// zero exit code. `process.on("exit")` above writes what we have; this makes
// sure the code is non-zero and the reason is visible.
process.on("uncaughtException", (err) => {
  console.error("\nUNCAUGHT:", err && err.stack ? err.stack : err);
  failures.push(`uncaught: ${err && err.message ? err.message : err}`);
  writeEvidence();
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("\nUNHANDLED REJECTION:", err && err.stack ? err.stack : err);
  failures.push(`unhandledRejection: ${err && err.message ? err.message : err}`);
  writeEvidence();
  process.exit(1);
});

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
  // curiosity — a field that throws on commit looks exactly like a field
  // that refused, and only this catches the difference.
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
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 160));
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
  await sleep(450);
};

/** Click the first visible element whose trimmed text is exactly `label`. */
const clickByText = async (selector, label, what) => {
  const box = await evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.textContent.trim() === ${JSON.stringify(label)});
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0) {
        e.scrollIntoView({ block: 'center' });
        const r2 = e.getBoundingClientRect();
        return { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
      }
    }
    return null;
  })()`);
  if (!box) throw new Error(`no visible ${what ?? label} (${selector} with text "${label}")`);
  await sleep(200);
  await click(box.x, box.y);
  return box;
};

// --- the wall, as the DOM shows it -----------------------------------------

/** Every panel width label on the elevation, in inches, left to right. */
const panelWidths = async () =>
  await evaluate(`(() => {
    const gs = [...document.querySelectorAll('svg g')].filter((g) => (g.getAttribute('style') || '').includes('pointer'));
    return gs
      .flatMap((g) => [...g.querySelectorAll('text')])
      .map((t) => t.textContent.trim())
      .filter((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t))
      .map((t) => Number(t.slice(0, -1)));
  })()`);

const sumEighths = (widths) => widths.reduce((sum, w) => sum + Math.round(w * 8), 0);

/** Every "NO PANELS…" label anywhere in the document, with its own SVG kind. */
const noPanelsLabels = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg text')]
      .map((t) => t.textContent.trim())
      .filter((t) => t.startsWith('NO PANELS'));
  })()`);

/** Dashed, unfilled rects — the elevation's own unbuilt-span boundary. The
 * filled/hatched panel rects are excluded by `fill="none"`, which is the
 * whole visual point: a boundary, not a wall of unknown type. */
const dashedBoundaryRects = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg rect')]
      .filter((r) => r.getAttribute('fill') === 'none' && (r.getAttribute('stroke-dasharray') || '').length > 0)
      .map((r) => { const b = r.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })
      .filter((b) => b.w > 2 && b.h > 2);
  })()`);

const dragStrips = async () =>
  await evaluate(`(() => [...document.querySelectorAll('rect[style*="ew-resize"]')].map((r) => {
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, h: Math.round(b.height) };
  }))()`);

/** The Stop Wall field for one end, plus whatever refusal it is showing. */
const stopField = async (end) =>
  await evaluate(`(() => {
    const el = document.querySelector('[id^="wall-run-stop-${end}-"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // The refusal renders as a sibling <p> under the field's own wrapper.
    const wrap = el.closest('label') || el.parentElement;
    const msg = wrap ? [...wrap.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.length > 0) ?? null : null;
    return { id: el.id, value: el.value, invalid: el.getAttribute('aria-invalid') === 'true', message: msg,
             x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

/** Types into a LengthInput and commits with Enter, the way a user does.
 * Uses the native value setter so React sees a real change. */
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

// --- the 3D scene, as the OBJ export describes it ---------------------------

/**
 * Captures the OBJ the 3D view would export, WITHOUT letting the browser
 * download anything: `URL.createObjectURL` is swapped for a capture and the
 * anchor's own `click` is stubbed for the duration.
 *
 * This reads the same memos the scene renders, which is the entire reason it
 * can see a stale one.
 */
const captureObj = async () => {
  await evaluate(`(() => {
    window.__objText = null;
    window.__objRestore = (() => {
      const realCreate = URL.createObjectURL;
      const realRevoke = URL.revokeObjectURL;
      const realClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = (blob) => { window.__objBlob = blob; return 'blob:harness-capture'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () {};
      return () => {
        URL.createObjectURL = realCreate;
        URL.revokeObjectURL = realRevoke;
        HTMLAnchorElement.prototype.click = realClick;
      };
    })();
  })()`);
  await clickByText("button", "Export as OBJ", "Export as OBJ button");
  await sleep(500);
  const text = await evaluate(`(async () => {
    const t = window.__objBlob ? await window.__objBlob.text() : null;
    if (window.__objRestore) window.__objRestore();
    window.__objBlob = null;
    return t;
  })()`);
  if (!text) throw new Error("the OBJ export produced nothing — is the 3D view mounted?");
  return text;
};

/**
 * Parses an OBJ into per-group world-space vertex lists, then reduces each
 * group-name PREFIX (`wall_AB`, `roofbearing_AB_0`, …) to its extent along a
 * given axis. Everything the 3D assertions below need.
 */
const parseObjGroups = (objText) => {
  const groups = new Map();
  let current = null;
  for (const line of objText.split(/\r?\n/)) {
    if (line.startsWith("g ")) {
      current = line.slice(2).trim();
      if (!groups.has(current)) groups.set(current, []);
    } else if (line.startsWith("v ") && current) {
      const [, x, y, z] = line.split(/\s+/);
      groups.get(current).push([Number(x), Number(y), Number(z)]);
    }
  }
  return groups;
};

/** Min/max of every vertex in groups whose name starts with `prefix`, along
 * axis 0 (x) or 2 (z). Null when no such group exists — which is itself a
 * meaningful answer (nothing is drawn there). */
const extentAlong = (groups, prefix, axis) => {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const [name, verts] of groups) {
    if (!name.startsWith(prefix)) continue;
    for (const v of verts) {
      min = Math.min(min, v[axis]);
      max = Math.max(max, v[axis]);
      count++;
    }
  }
  return count === 0 ? null : { minIn: min, maxIn: max, lengthIn: max - min, vertices: count };
};

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
await sleep(1600);

console.log("3. turning Roof on (a truss plate only exists when roof is in scope)");
await clickByText("button", "Panelizer", "Panelizer menu button");
await sleep(700);
const roofToggled = await evaluate(`(() => {
  const group = document.querySelector('[aria-label="Scope of work"]');
  if (!group) return null;
  const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
  if (!label) return null;
  const box = label.querySelector('input[type="checkbox"]');
  if (!box) return null;
  if (!box.checked) box.click();
  return { checked: box.checked };
})()`);
record(
  "roof-in-scope",
  { roofToggled },
  // Every 3D truss-plate claim below is vacuous if the roof is out of scope.
  (d) => !!d.roofToggled && d.roofToggled.checked === true,
);
await clickByText("button", "Panelizer", "Panelizer menu button (to close)");
await sleep(600);

console.log("4. baseline 3D scene");
// Reach a 3D stop on the viewer dial by stepping and reading the label back.
const dialLabel = async () => await evaluate(`(() => { const g = document.querySelector('[aria-label="View mode"]'); return g ? g.querySelector('div').textContent.trim() : null; })()`);
const dialStep = async (glyph) => {
  const b = await evaluate(`(() => {
    const g = document.querySelector('[aria-label="View mode"]');
    const btn = g && [...g.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(glyph)});
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  })()`);
  if (!b) throw new Error("no viewer dial");
  await click(b[0], b[1]);
  await sleep(900);
};
const reachView = async (predicate, what) => {
  for (let i = 0; i < 12; i++) {
    const label = await dialLabel();
    if (label && predicate(label)) return label;
    await dialStep("▼");
  }
  throw new Error(`could not reach ${what} on the viewer dial`);
};

await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objBaseline = parseObjGroups(await captureObj());
await shot("00-3d-baseline");

// Which wall runs along which axis is a property of the drawn rectangle, so
// pick the wall with the LONGEST extent and work on that one throughout.
const wallIdsInObj = [...new Set([...objBaseline.keys()].filter((k) => k.startsWith("wall_")).map((k) => k.split("_")[1]))];
const wallAxisFor = (groups, wallId) => {
  const ex = extentAlong(groups, `wall_${wallId}_`, 0);
  const ez = extentAlong(groups, `wall_${wallId}_`, 2);
  if (!ex || !ez) return null;
  return ex.lengthIn >= ez.lengthIn ? 0 : 2;
};
let targetWallId = null;
let targetAxis = 0;
let baselineWallExtent = null;
for (const id of wallIdsInObj) {
  const axis = wallAxisFor(objBaseline, id);
  if (axis === null) continue;
  const ext = extentAlong(objBaseline, `wall_${id}_`, axis);
  if (!baselineWallExtent || ext.lengthIn > baselineWallExtent.lengthIn) {
    baselineWallExtent = ext;
    targetWallId = id;
    targetAxis = axis;
  }
}
const baselinePlateExtent = targetWallId ? extentAlong(objBaseline, `roofbearing_${targetWallId}_`, targetAxis) : null;
record(
  "baseline-3d-has-panels-and-a-truss-plate",
  {
    wallIds: wallIdsInObj,
    targetWallId,
    targetAxis,
    wallExtent: baselineWallExtent,
    plateExtent: baselinePlateExtent,
  },
  // Both must exist, and the plate must span roughly the same run as the
  // panels — otherwise there is nothing for the stop to shorten.
  (d) =>
    !!d.targetWallId &&
    !!d.wallExtent &&
    !!d.plateExtent &&
    d.wallExtent.lengthIn > 100 &&
    Math.abs(d.plateExtent.lengthIn - d.wallExtent.lengthIn) < 2,
);

console.log("5. opening that wall's elevation");
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
await shot("01-elevation-before-stop");
const widthsBefore = await panelWidths();
const startFieldBefore = await stopField("start");
record(
  "elevation-before-stop",
  { panelCount: widthsBefore.length, totalEighths: sumEighths(widthsBefore), stopFieldValue: startFieldBefore?.value ?? null },
  // A wall that did not draw would make every later measurement vacuous, and
  // the Stop Wall field has to be reachable at all.
  (d) => d.panelCount >= 3 && d.totalEighths > 0 && d.stopFieldValue !== null,
);

console.log(`6. stopping ${STOP_IN}in off the start end`);
await commitStop("start", STOP_IN);
const widthsAfter = await panelWidths();
const noPanelsAfter = await noPanelsLabels();
const dashedAfter = await dashedBoundaryRects();
await shot("02-elevation-stopped");
record(
  "stop-shortens-the-run-and-conserves-the-wall",
  {
    panelCountBefore: widthsBefore.length,
    panelCountAfter: widthsAfter.length,
    totalEighthsBefore: sumEighths(widthsBefore),
    totalEighthsAfter: sumEighths(widthsAfter),
    stopEighths: STOP_IN * 8,
  },
  // THE Stage 3 invariant, read off the drawing rather than off a unit test:
  // sum(panels) + stop === the wall's own total, exactly, in eighths.
  (d) => d.totalEighthsAfter + d.stopEighths === d.totalEighthsBefore,
);
record(
  "unbuilt-span-draws-as-a-dashed-NO-PANELS-boundary",
  { noPanelsLabels: noPanelsAfter, dashedUnfilledRects: dashedAfter.length },
  // A dashed, UNFILLED outline (not a hatched wall) plus its own dimension.
  (d) => d.noPanelsLabels.length >= 2 && d.dashedUnfilledRects >= 1,
);

console.log("7. the panel-boundary drag still hit-tests on a stopped wall");
// The elevation's `yPx` moved by a conditional bottom margin when the stop
// appeared. If the drag strips no longer line up with the row, this drag
// grabs nothing and the widths do not move.
const strips = await dragStrips();
const widthsBeforeDrag = await panelWidths();
let widthsAfterDrag = widthsBeforeDrag;
if (strips.length > 0) {
  const s = strips[Math.floor(strips.length / 2)];
  await mouse("mousePressed", s.x, s.y);
  await sleep(120);
  await mouse("mouseMoved", s.x + 26, s.y);
  await sleep(120);
  await mouse("mouseMoved", s.x + 26, s.y);
  await sleep(120);
  await mouse("mouseReleased", s.x + 26, s.y);
  await sleep(900);
  widthsAfterDrag = await panelWidths();
}
await shot("03-elevation-drag-on-stopped-wall");
record(
  "drag-still-lands-and-conserves-the-run",
  {
    strips: strips.length,
    totalEighthsBeforeDrag: sumEighths(widthsBeforeDrag),
    totalEighthsAfterDrag: sumEighths(widthsAfterDrag),
    changed: JSON.stringify(widthsBeforeDrag) !== JSON.stringify(widthsAfterDrag),
  },
  // The drag must actually grab something (widths move) AND the run total
  // must be conserved exactly — a drag that grabs nothing is the symptom of
  // the y-offset having gone wrong.
  (d) => d.strips > 0 && d.changed === true && d.totalEighthsAfterDrag === d.totalEighthsBeforeDrag,
);

console.log("8. the live plan canvas and the printable plan sheet");
await reachView((l) => l === "2D Floor Plan", "2D Floor Plan");
await sleep(1200);
// The live plan is Konva (a bitmap), so this counts the boundary's own grey
// rather than querying the DOM — a real measurement, compared against the
// same count with no stop set later in the run.
const boundaryGreyPixels = async () =>
  await evaluate(`(() => {
    const c = document.querySelector('canvas');
    if (!c) return -1;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40 && Math.abs(d[i] - 138) < 10 && Math.abs(d[i + 1] - 138) < 10 && Math.abs(d[i + 2] - 138) < 10) n++;
    }
    return n;
  })()`);
const greyWithStop = await boundaryGreyPixels();
await shot("04-live-plan-stopped");

let planSheetLabels = null;
try {
  await clickByText("button", "Plan View", "Plan View document page");
  await sleep(1400);
  planSheetLabels = await noPanelsLabels();
  await shot("05-plan-sheet-stopped");
} catch (err) {
  planSheetLabels = { error: String(err.message ?? err) };
}
record(
  "plan-sheet-carries-a-NO-PANELS-dimension",
  { planSheetLabels },
  // The printable plan has to print the span's dimension, labelled NO PANELS
  // — this is the thing a shop actually reads.
  (d) => Array.isArray(d.planSheetLabels) && d.planSheetLabels.some((t) => t.startsWith("NO PANELS")),
);

console.log("9. 3D with the stop set");
await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objStopped = parseObjGroups(await captureObj());
await shot("06-3d-stopped");
const wallStopped = extentAlong(objStopped, `wall_${targetWallId}_`, targetAxis);
const plateStopped = extentAlong(objStopped, `roofbearing_${targetWallId}_`, targetAxis);
// Which end the stop is at depends on the wall's direction in world space,
// so measure the SHORTENING rather than assuming a side.
const wallShortenedBy = baselineWallExtent.lengthIn - (wallStopped ? wallStopped.lengthIn : 0);
const plateShortenedBy = baselinePlateExtent.lengthIn - (plateStopped ? plateStopped.lengthIn : 0);
record(
  "3d-draws-nothing-across-the-unbuilt-span",
  {
    baselineWallLengthIn: Number(baselineWallExtent.lengthIn.toFixed(3)),
    stoppedWallLengthIn: wallStopped ? Number(wallStopped.lengthIn.toFixed(3)) : null,
    wallShortenedBy: Number(wallShortenedBy.toFixed(3)),
  },
  // No ghost solid: the panel geometry itself gets shorter by the stop.
  (d) => Math.abs(d.wallShortenedBy - STOP_IN) < 1.5,
);
record(
  "3d-truss-plate-shrinks-with-the-run",
  {
    baselinePlateLengthIn: Number(baselinePlateExtent.lengthIn.toFixed(3)),
    stoppedPlateLengthIn: plateStopped ? Number(plateStopped.lengthIn.toFixed(3)) : null,
    plateShortenedBy: Number(plateShortenedBy.toFixed(3)),
  },
  // A plate bears on panels; where there are none there is no plate. This is
  // the assertion the review's MUST-FIX exists for.
  (d) => Math.abs(d.plateShortenedBy - STOP_IN) < 1.5,
);

console.log("10. THE MEMO PIN — forcing a recompute must not change the scene");
// If the roof-bearing memo is reading the stops without depending on them,
// the scene above is whatever it last computed. Toggling Roof off and back on
// touches a dependency the memo DOES list, forcing a fresh compute; a scene
// that changes as a result was stale before.
await clickByText("button", "Panelizer", "Panelizer menu button");
await sleep(700);
await evaluate(`(() => {
  const group = document.querySelector('[aria-label="Scope of work"]');
  const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
  label.querySelector('input[type="checkbox"]').click();
})()`);
await sleep(900);
await evaluate(`(() => {
  const group = document.querySelector('[aria-label="Scope of work"]');
  const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
  label.querySelector('input[type="checkbox"]').click();
})()`);
await sleep(900);
await clickByText("button", "Panelizer", "Panelizer menu button (to close)");
await sleep(1500);
const objRecomputed = parseObjGroups(await captureObj());
const plateRecomputed = extentAlong(objRecomputed, `roofbearing_${targetWallId}_`, targetAxis);
record(
  "roof-bearing-memo-was-not-stale",
  {
    plateBeforeForcedRecomputeIn: plateStopped ? Number(plateStopped.lengthIn.toFixed(3)) : null,
    plateAfterForcedRecomputeIn: plateRecomputed ? Number(plateRecomputed.lengthIn.toFixed(3)) : null,
  },
  // Identical either side of a forced recompute. If these differ, the memo
  // was serving a value computed before the stop existed — the exact defect
  // the code review caught.
  (d) =>
    d.plateBeforeForcedRecomputeIn !== null &&
    d.plateAfterForcedRecomputeIn !== null &&
    Math.abs(d.plateAfterForcedRecomputeIn - d.plateBeforeForcedRecomputeIn) < 0.5,
);

console.log("11. clearing the stop restores the wall");
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
await commitStop("start", 0);
const widthsCleared = await panelWidths();
const noPanelsCleared = await noPanelsLabels();
await shot("07-elevation-cleared");
await reachView((l) => l === "2D Floor Plan", "2D Floor Plan");
await sleep(1200);
const greyWithoutStop = await boundaryGreyPixels();
await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objCleared = parseObjGroups(await captureObj());
const plateCleared = extentAlong(objCleared, `roofbearing_${targetWallId}_`, targetAxis);
await shot("08-3d-cleared");
record(
  "clearing-the-stop-restores-elevation-plan-and-3d",
  {
    totalEighthsCleared: sumEighths(widthsCleared),
    noPanelsLabelsCleared: noPanelsCleared.length,
    boundaryGreyWithStop: greyWithStop,
    boundaryGreyWithoutStop: greyWithoutStop,
    plateClearedIn: plateCleared ? Number(plateCleared.lengthIn.toFixed(3)) : null,
    baselinePlateIn: Number(baselinePlateExtent.lengthIn.toFixed(3)),
  },
  // The run comes back to its full total, the NO PANELS labels go away, the
  // live canvas loses the boundary grey it gained, and the plate is full
  // length again. "Absent entry = today's behaviour" has to hold after a
  // round trip, not just on a fresh project.
  (d) =>
    d.totalEighthsCleared === sumEighths(widthsBefore) &&
    d.noPanelsLabelsCleared === 0 &&
    d.boundaryGreyWithStop > d.boundaryGreyWithoutStop &&
    d.plateClearedIn !== null &&
    Math.abs(d.plateClearedIn - d.baselinePlateIn) < 1.0,
);

console.log("12. a stop that leaves a run too short to tile is refused");
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
const widthsBeforeRefusal = await panelWidths();
// The wall's own total, less a hair — the remaining run lands under the 24in
// fabrication minimum but is not zero, which is exactly the refused band.
const wallTotalIn = sumEighths(widthsBeforeRefusal) / 8;
await commitStop("start", Math.round((wallTotalIn - 10) * 8) / 8);
const refusalField = await stopField("start");
const widthsAfterRefusal = await panelWidths();
await shot("09-refused-stop");
record(
  "too-short-remaining-run-is-refused-and-nothing-changes",
  {
    askedForIn: Math.round((wallTotalIn - 10) * 8) / 8,
    invalid: refusalField?.invalid ?? null,
    message: refusalField?.message ?? null,
    totalEighthsBefore: sumEighths(widthsBeforeRefusal),
    totalEighthsAfter: sumEighths(widthsAfterRefusal),
  },
  // Refused in words, the field marked invalid, and the wall untouched —
  // never partly applied.
  (d) =>
    d.invalid === true &&
    typeof d.message === "string" &&
    /minimum|cannot be panelized/.test(d.message) &&
    d.totalEighthsAfter === d.totalEighthsBefore,
);

record(
  "no-uncaught-exceptions",
  { count: pageExceptions.length, first: pageExceptions[0] ?? null },
  // A field that throws on commit looks exactly like a field that refused.
  (d) => d.count === 0,
);

writeEvidence();
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall checks passed");
process.exit(0);
