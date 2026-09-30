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
 * in the 3D scene — every member as world-space vertices, grouped by label.
 * Every 3D claim below is measured off that, not off a screenshot.
 *
 * ⚠ Ground-floor wall panels carry NO prefix in that file: their group is
 * `${wallId}_${slotIndex}_${memberId}`, while everything else is prefixed
 * (`story2_`, `gable_`, `roofbearing_`, `balefoundation_`). Assuming a
 * `wall_` prefix made every 3D check here quietly match nothing on the first
 * pass — which is why the baseline step asserts it found walls at all.
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
 *  12. a stop that REACHES a corner the wall owns is ACCEPTED (the
 *      orphan-corner case — the neighbour stops butting into air)
 *  13. no uncaught exception anywhere in the run
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
import { makeViewStopControl } from "../viewStopControl.mjs";
import { makeElevationZoomControl } from "../elevationZoom.mjs";

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

/**
 * Click the first visible element whose trimmed text STARTS WITH `label`.
 *
 * Prefix, not equality, and that is not laziness: the top bar's own menu
 * buttons append a caret glyph to their label ("Project▾"), so an
 * exact-match helper finds nothing and the run dies three steps later
 * somewhere unrelated. Learned the hard way on the first pass of this
 * script.
 */
const clickByText = async (selector, label, what) => {
  const box = await evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.textContent.trim().startsWith(${JSON.stringify(label)}));
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

/** Click by CSS selector, for the controls that carry no text — the ⚙
 * Settings button is icon-only, so `clickByText` cannot reach it. Same real
 * mouse, same visibility requirement. */
const clickSelector = async (selector, what) => {
  const box = await evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`no visible ${what ?? selector} (${selector})`);
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
/** The Scope of work group lives in the Panelizer, and **since U3
 * (2026-09-29) the Panelizer is a section inside the ⚙ Settings note** — one
 * click, not the two it used to take through Project ▾ → Panelizer. Tommy:
 * "we should move the content of the panelizer into the settings in the top
 * right". The gear is icon-only, so it is located by `data-bar-control`
 * rather than by text; the assertion afterwards is unchanged, and it is what
 * would catch the move having lost the checkboxes rather than relocated
 * them. */
const openPanelizer = async () => {
  /* ⚠ SCOPED TO `#settings-note`, exactly like the post-open check below.
     They disagreed until U3's review (2026-09-29): the guard looked for a
     Scope of work group ANYWHERE in the document while the check that follows
     insists on one inside Settings. Harmless while only Settings renders it —
     and precisely the asymmetry the scoping was added to prevent, since an
     unscoped guard would return early on a group found somewhere else and
     leave every assertion below reading a control this harness never opened. */
  const alreadyOpen = await evaluate(`!!document.querySelector('#settings-note [aria-label="Scope of work"]')`);
  if (alreadyOpen) return;
  await clickSelector('[data-bar-control="settings"]', "the Settings button");
  await sleep(800);
  const ok = await evaluate(`!!document.querySelector('#settings-note [aria-label="Scope of work"]')`);
  if (!ok) throw new Error("the Panelizer section did not open inside Settings (no Scope of work group)");
};
/** Closes whatever notes are open, so nothing covers the canvas afterwards. */
const closeOpenNotes = async () => {
  await evaluate(`(() => {
    for (const b of [...document.querySelectorAll('button[title="Hide this note"]')]) b.click();
  })()`);
  await sleep(700);
};
const setRoofScope = async (on) =>
  await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Scope of work"]');
    if (!group) return null;
    const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
    if (!label) return null;
    const box = label.querySelector('input[type="checkbox"]');
    if (!box) return null;
    if (box.checked !== ${on ? "true" : "false"}) box.click();
    return { checked: box.checked };
  })()`);

await openPanelizer();
const roofToggled = await setRoofScope(true);
record(
  "roof-in-scope",
  { roofToggled },
  // Every 3D truss-plate claim below is vacuous if the roof is out of scope.
  (d) => !!d.roofToggled && d.roofToggled.checked === true,
);
await closeOpenNotes();

console.log("4. baseline 3D scene");
/**
 * Reach a stop by stepping and reading the label back.
 *
 * ⚠ U1 (2026-09-28) split this control in two: the sidebar dial below 1200px,
 * Design and View menus on the top bar at 1200 and up. This harness does not
 * set a viewport width, so it can run on either side of that line, and the
 * old locator (`[aria-label="View mode"]`) would have found nothing at
 * desktop width and thrown "the viewer dial is not on screen" — true, and
 * completely misleading. The shared driver asks the page which form is live.
 *
 * Both of this step's own scars are kept, and both now live in that driver:
 * it scrolls the target into view before clicking (after a panel drag the
 * page can sit low enough that the control is off screen, and a click at an
 * off-screen coordinate hits nothing and fails silently — which read exactly
 * like "the dial has no 2D Floor Plan stop"), and it names what it actually
 * walked past, because a bare "could not reach X" sends the next person
 * looking at the wrong thing.
 */
const view = makeViewStopControl({ evaluate, sleep });
const reachView = async (predicate, what) => await view.reach(predicate, what);

await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objBaseline = parseObjGroups(await captureObj());
await shot("00-3d-baseline");

/**
 * Ground-floor wall panels carry NO prefix in the OBJ — their group name is
 * `${wallId}_${slotIndex}_${memberId}`, while everything else is prefixed
 * (`story2_`, `gable_`, `roofbearing_`, `balefoundation_`, `midwallbeam_`).
 * So a wall id is the first segment of any group that is not one of those
 * keywords. Reading this wrong the first time made every 3D check vacuous
 * rather than failing loudly, which is why the baseline step below asserts
 * that it found walls at all.
 */
const NON_WALL_PREFIXES = new Set(["story2", "gable", "roofbearing", "balefoundation", "midwallbeam", "trussplate", "boxbeam"]);
const wallIdsInObj = [
  ...new Set(
    [...objBaseline.keys()]
      .map((k) => /^([A-Za-z0-9]+)_\d+/.exec(k))
      .filter((m) => m !== null && !NON_WALL_PREFIXES.has(m[1]))
      .map((m) => m[1]),
  ),
];
const wallAxisFor = (groups, wallId) => {
  const ex = extentAlong(groups, `${wallId}_`, 0);
  const ez = extentAlong(groups, `${wallId}_`, 2);
  if (!ex || !ez) return null;
  return ex.lengthIn >= ez.lengthIn ? 0 : 2;
};
let targetWallId = null;
let targetAxis = 0;
let baselineWallExtent = null;
for (const id of wallIdsInObj) {
  const axis = wallAxisFor(objBaseline, id);
  if (axis === null) continue;
  const ext = extentAlong(objBaseline, `${id}_`, axis);
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
  // Both must exist, and the plate must span the wall's RAW line — which on
  // a wall that butts a neighbour at both ends is up to two wall-thicknesses
  // longer than its panel run.
  //
  // **That the plate is LONGER than the panel run is correct, and settled.**
  // Tommy, 2026-09-25: top plates lap at the corners, so a plate that
  // stopped where each panel run stops would leave every corner unplated.
  // The cut length is right; this assertion exists to keep it right.
  //
  // Separately, and still open: the 3D roof-bearing ANCHOR has always
  // measured from the wall's true corner and ignored the butt-joint inset,
  // so the rendered beam can sit up to a wall thickness off its panels.
  // That is render-only — `widthFt` comes from `seg.lengthIn` and never
  // reaches a fabrication sheet — and Stage 3 deliberately did not change it
  // (fixing it would move the render on every existing two-story project).
  // Bounded here rather than waved through, so that if it ever grows, this
  // notices.
  (d) =>
    !!d.targetWallId &&
    !!d.wallExtent &&
    !!d.plateExtent &&
    d.wallExtent.lengthIn > 100 &&
    d.plateExtent.lengthIn >= d.wallExtent.lengthIn - 0.5 &&
    d.plateExtent.lengthIn - d.wallExtent.lengthIn <= 2 * 15.75 + 0.5,
);

console.log("5. opening that wall's elevation");
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
/**
 * ⚠ THE WHOLE WALL HAS TO BE BROUGHT ON SCREEN, WHICH USED TO BE FREE.
 * Before 2026-09-29 an elevation rendered a few hundred pixels wide whatever
 * the window; since Tommy's fit-height / scroll-width change a long wall is
 * wider than the window. Step 7 presses "the middle drag strip" — and the
 * middle of a 48ft wall is off screen at the default view, so the mousedown
 * hit nothing, nothing moved, and the step failed as though the drag had
 * broken on a stopped wall. (The reading steps are unaffected: `panelWidths`
 * and friends here have never filtered to the viewport.)
 */
const wholeWall = await makeElevationZoomControl({ evaluate, sleep, click }).fitWholeWall();
record(
  "whole-wall-on-screen",
  wholeWall,
  // Step 7 presses a strip by its screen coordinate; if the wall does not
  // fit, the strip it picks is not one it can press.
  (d) => d.wholeWallVisible === true,
);
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
// The Plan View sheet opens as a note ON TOP of the editor, including the
// viewer dial — leave it open and every later dial click lands on the note
// instead, which reads as "the dial has no 3D stop".
await closeOpenNotes();

console.log("9. 3D with the stop set");
await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objStopped = parseObjGroups(await captureObj());
await shot("06-3d-stopped");
const wallStopped = extentAlong(objStopped, `${targetWallId}_`, targetAxis);
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
await openPanelizer();
await setRoofScope(false);
await sleep(900);
await setRoofScope(true);
await sleep(900);
await closeOpenNotes();
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

console.log("13. a stop that reaches a corner the wall OWNS is accepted, and the neighbour grows");
// The ADU's own case, and the one the orphan-corner rule is for: on a
// rectangle the SHORTER wall owns the corners, so stopping a short wall is
// exactly what reaches a long neighbour. The neighbour must stop insetting
// into a corner panel that is no longer built — and, just as importantly,
// the stop must be ACCEPTED rather than refused for failing an invariant
// stated against the neighbour's old length.
await closeOpenNotes();
const shortWallId = wallIdsInObj.find((id) => id !== targetWallId && id !== null) ?? null;
let cornerStopResult = { error: "no second wall to try" };
if (shortWallId) {
  // The neighbour's growth is measured off the 3D scene, because that is
  // the only place this harness can see a wall the elevation is not showing.
  // Without it this step only proved the stopped wall shortened, while its
  // own name claimed the neighbour grew.
  await reachView((l) => l === "3D Framed", "3D Framed");
  await sleep(2200);
  const objBeforeCornerStop = parseObjGroups(await captureObj());
  const extentsBefore = Object.fromEntries(
    wallIdsInObj.map((id) => [id, extentAlong(objBeforeCornerStop, `${id}_`, wallAxisFor(objBeforeCornerStop, id) ?? 0)?.lengthIn ?? null]),
  );
  await reachView((l) => l === `Elevation: ${shortWallId}`, `Elevation: ${shortWallId}`);
  await sleep(1200);
  const shortWidths = await panelWidths();
  const shortRunIn = sumEighths(shortWidths) / 8;
  // Stop 30in off the start end — enough to take a corner panel with it,
  // and far more than enough to leave a legal run behind.
  await commitStop("start", 30);
  const field = await stopField("start");
  const afterWidths = await panelWidths();
  await shot("10-corner-stop-accepted");
  await reachView((l) => l === "3D Framed", "3D Framed");
  await sleep(2200);
  const objAfterCornerStop = parseObjGroups(await captureObj());
  const grew = [];
  for (const id of wallIdsInObj) {
    if (id === shortWallId) continue;
    const after = extentAlong(objAfterCornerStop, `${id}_`, wallAxisFor(objAfterCornerStop, id) ?? 0)?.lengthIn ?? null;
    const before = extentsBefore[id];
    if (before !== null && after !== null && after - before > 0.01) grew.push({ id, byIn: Number((after - before).toFixed(3)) });
  }
  cornerStopResult = {
    wallId: shortWallId,
    refusalMessage: field?.message ?? null,
    invalid: field?.invalid ?? null,
    runBeforeIn: shortRunIn,
    runAfterIn: sumEighths(afterWidths) / 8,
    neighboursThatGrew: grew,
  };
}
record(
  "corner-reaching-stop-is-accepted-not-refused",
  cornerStopResult,
  // Accepted (no refusal, field not marked invalid), the run really did
  // shorten by the 30in asked for, AND at least one neighbour grew by a wall
  // thickness — the orphan corner, end to end in the real app. Before the
  // refusal was restated against each wall's OWN tiled length, this came
  // back refused.
  (d) =>
    !!d.wallId &&
    d.invalid === false &&
    d.refusalMessage === null &&
    Math.abs(d.runBeforeIn - d.runAfterIn - 30) < 0.001 &&
    Array.isArray(d.neighboursThatGrew) &&
    d.neighboursThatGrew.length >= 1 &&
    d.neighboursThatGrew.every((n) => Math.abs(n.byIn - 15.5) < 0.6),
);

console.log("14. a Gable End wall's gable panels track the built run — set AND clear");
/**
 * The headline of Tommy's gable decision, driven through the APP rather than
 * through `computeGableTiledRow` directly. It was missing here, and that gap
 * is exactly why a stale-memo defect in the wiring layer (`gableTilesByWallId`
 * not depending on the stop map) survived a whole review: the unit tests
 * proved the tiler clamps, and nothing proved the app ever calls it again.
 *
 * Clearing matters as much as setting — a stale memo fails in both
 * directions, and only the round trip catches that.
 */
const gableExtent = (groups, wallId, axis) => extentAlong(groups, `gable_${wallId}_`, axis);
let gableResult = { error: "not run" };
{
  await closeOpenNotes();
  await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
  await sleep(1200);
  const gableToggled = await evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Add Gable End'));
    if (!label) return null;
    const box = label.querySelector('input[type="checkbox"]');
    if (!box || box.disabled) return { disabled: !!(box && box.disabled) };
    if (!box.checked) box.click();
    return { checked: box.checked };
  })()`);
  await sleep(1400);
  if (gableToggled && gableToggled.checked) {
    const axis = targetAxis;
    // Both the gable row AND the wall's own panel run, because the thing
    // that actually matters is their RELATIONSHIP — see the expectation.
    const capture = async () => {
      const groups = parseObjGroups(await captureObj());
      const gable = gableExtent(groups, targetWallId, axis);
      const wall = extentAlong(groups, `${targetWallId}_`, axis);
      return {
        gableStartIn: gable ? Number(gable.minIn.toFixed(3)) : null,
        gableLengthIn: gable ? Number(gable.lengthIn.toFixed(3)) : null,
        wallStartIn: wall ? Number(wall.minIn.toFixed(3)) : null,
      };
    };
    await reachView((l) => l === "3D Framed", "3D Framed");
    await sleep(2400);
    const unstopped = await capture();
    await shot("11-gable-unstopped");

    await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
    await sleep(1200);
    await commitStop("start", STOP_IN);
    await reachView((l) => l === "3D Framed", "3D Framed");
    await sleep(2400);
    const stopped = await capture();
    await shot("12-gable-stopped");

    await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
    await sleep(1200);
    await commitStop("start", 0);
    await reachView((l) => l === "3D Framed", "3D Framed");
    await sleep(2400);
    const cleared = await capture();
    await shot("13-gable-cleared");

    gableResult = { unstopped, stopped, cleared };
  } else {
    gableResult = { skipped: gableToggled };
  }
}
record(
  "gable-row-tracks-the-built-run-both-ways",
  gableResult,
  /*
   * NOT "shrinks by the stop": the gable row is already inset from the
   * wall's corners by the truss-plate inset, so a 60in stop that only
   * reaches 35.5in past that inset moves it by 35.5in, and asserting 60
   * would be asserting a misunderstanding. The real invariant is the one
   * Tommy's clamp exists for:
   *
   *   1. NO GABLE PANEL BEGINS BEFORE THE WALL'S OWN PANEL RUN DOES — no
   *      gable panel above a span the wall says carries none;
   *   2. it moves when the stop is set and returns EXACTLY when cleared.
   *      A stale memo fails one or both, and it fails in both directions,
   *      which is why the round trip is here.
   */
  (d) =>
    !!d.unstopped &&
    !!d.stopped &&
    !!d.cleared &&
    typeof d.stopped.gableStartIn === "number" &&
    typeof d.stopped.wallStartIn === "number" &&
    d.stopped.gableStartIn >= d.stopped.wallStartIn - 0.01 &&
    d.unstopped.gableStartIn >= d.unstopped.wallStartIn - 0.01 &&
    d.stopped.gableStartIn > d.unstopped.gableStartIn + 0.01 &&
    Math.abs(d.cleared.gableStartIn - d.unstopped.gableStartIn) < 0.01 &&
    Math.abs(d.cleared.gableLengthIn - d.unstopped.gableLengthIn) < 0.01,
);

console.log("15. openings inside the unbuilt span are DROPPED, REMEMBERED and RESTORED");
/**
 * **The defect Tommy reported on 2026-09-29, driven end to end.**
 *
 * > *"i am having trouble building the seahorn project using the stop wall
 * > tool. whenever i stop wall over a certain amount, for one wall this
 * > boundary was 174", it says that the panel wall doesnt add up and will not
 * > let me edit the layout how i need to"*
 *
 * `retileWithOpenings` kept every opening on the wall at full width no matter
 * how short the stop made the run, because an `OpeningAnchor` carries an
 * ORDINAL and not a position. Once the run was narrower than
 * `Σ openings + Σ corners` — 174in on his wall, exactly those two totals —
 * the slots summed to more than the wall and the sum-invariant backstop
 * refused every further stop with a message about arithmetic.
 *
 * His decision, given three options, was **"Drop them, and remember"**. So
 * what this step drives is all three halves of that: the opening leaves the
 * built run, the app SAYS it was set aside rather than deleted, and clearing
 * the stop puts the wall back panel for panel.
 *
 * The sweep is the part that pins the bug itself: at no stop anywhere along
 * the wall may the "does not add back up" sentence appear again.
 */
await closeOpenNotes();
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
// Step 14 left a gable end on this wall, and a gable window has its own,
// entirely separate refusal (a stop may not cut one in half). Turning it back
// off keeps this step measuring the ONE thing it is about.
await evaluate(`(() => {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Add Gable End'));
  const box = label && label.querySelector('input[type="checkbox"]');
  if (box && !box.disabled && box.checked) box.click();
})()`);
await sleep(1400);
await commitStop("start", 0);
await commitStop("end", 0);

/** How many openings the app says the unbuilt span swallowed — read off its
 * own sentence in the Stop Wall panel, so this measures what Tommy would
 * actually be told, not an internal. 0 when the sentence is absent. */
const withheldOpeningCount = async () =>
  await evaluate(`(() => {
    const t = document.body.innerText || "";
    const m = /([0-9]+)\\s+(?:opening|openings)\\s+in the unbuilt span/.exec(t);
    return m ? Number(m[1]) : 0;
  })()`);

/**
 * How many slots on this wall are OPENINGS, read off the 3D model rather than
 * off the drawing.
 *
 * The elevation gives every slot a width label and no type, so a DOM count
 * cannot tell a window from a standard panel. The OBJ can: an opening
 * assembly contributes `header_` and `sill_` members, and its group name
 * carries the slot index (`${wallId}_${slotIndex}_${memberId}`). Counting
 * distinct slot indices with those members counts openings exactly — and it
 * counts them in the SAME model the cut list, the fabrication groups and the
 * shop drawings are built from, which is the claim "an unbuilt section of
 * wall has no window in it" actually needs.
 */
const openingSlotCount = (groups, wallId) => {
  const slots = new Set();
  for (const name of groups.keys()) {
    const m = new RegExp(`^${wallId}_(\\d+)_(header|sill)_`).exec(name);
    if (m) slots.add(m[1]);
  }
  return slots.size;
};
const captureOpeningSlots = async () => {
  await reachView((l) => l === "3D Framed", "3D Framed");
  await sleep(2400);
  const n = openingSlotCount(parseObjGroups(await captureObj()), targetWallId);
  await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
  await sleep(1200);
  return n;
};

/**
 * ⚠ **This step PLACES the opening it depends on, rather than relying on the
 * seeded one — because relying on the seed made expectation 3 sample-dependent,
 * which is a red step on green code.**
 *
 * `seedDefaultOpenings` picks a wall's default window at a RANDOM standard
 * ordinal, and the sweep below only goes to 0.75 of the wall. Measured on the
 * checked-in evidence of 2026-09-29: with one seeded opening, `withheldOpenings`
 * was 1 at only the deepest stop — and a draw that puts that single window in
 * the last quarter withholds nothing at any accepted stop, so
 * `openingSlotsStopped < openingSlotsBefore` fails on code that is working. With
 * the ordinal roughly uniform over ~11 candidates that is about a 1-in-5 flake.
 *
 * So the step arms the Stage 2 Window tool and inserts at a KNOWN boundary near
 * the start of the wall. The seeded opening is left where it is; it is simply no
 * longer what the expectation rests on, and the insert itself is asserted so
 * this cannot quietly go back to depending on it.
 */
const toolButton = async (label) =>
  await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Panel placement tool"]');
    if (!group) return null;
    const b = [...group.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pressed: b.getAttribute('aria-pressed') === 'true' };
  })()`);

/** Arms a tool and CHECKS IT ARMED — the same guard the Stage 2 harness carries,
 * because the left bar scrolls and a click that lands on nothing looks exactly
 * like a tool that did nothing. */
const armTool = async (label) => {
  await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Panel placement tool"]');
    const b = group && [...group.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (b) b.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(250);
  const btn = await toolButton(label);
  if (!btn) throw new Error(`no "${label}" button in the placement group`);
  if (!btn.pressed) {
    await click(btn.x, btn.y);
    await sleep(400);
  }
  const after = await toolButton(label);
  if (!after || !after.pressed) throw new Error(`"${label}" did not arm — the click missed (button at ${btn.x},${btn.y})`);
  // Scrolling the button into view can take the elevation off screen, and a
  // click at an off-screen coordinate hits nothing and fails silently.
  await evaluate(`(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('g[style*="pointer"]'));
    if (svg) svg.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(350);
};

/** Puts the tool away again, so the panel-boundary drag and the stop fields
 * behave for the rest of this step exactly as they did before it. */
const disarmTool = async (label) => {
  const btn = await toolButton(label);
  if (btn && btn.pressed) {
    await click(btn.x, btn.y);
    await sleep(400);
  }
  const after = await toolButton(label);
  if (after && after.pressed) throw new Error(`"${label}" would not put itself away`);
};

/** Panel bodies (the clickable coloured groups), left to right, each with its
 * own width label — the Stage 2 harness's own locator, note for note: "the
 * first svg with a text in it" is the compass widget, which cost that harness a
 * run. */
const panelBodies = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg g')]
      .filter((g) => (g.getAttribute('style') || '').includes('pointer'))
      .filter((g) => [...g.querySelectorAll('text')].some((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t.textContent.trim())))
      .map((g) => {
        const r = g.getBoundingClientRect();
        const label = [...g.querySelectorAll('text')].map((t) => t.textContent.trim()).find((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t));
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, label };
      })
      .filter((p) => p.w > 4 && p.x > 250 && p.x < window.innerWidth - 40 && p.y > 60 && p.y < window.innerHeight - 40)
      .sort((a, b) => a.x - b.x);
  })()`);

/** The placement tool's own notice line, whatever it currently says. */
const placementNotice = async () =>
  await evaluate(`(() => {
    const ps = [...document.querySelectorAll('p')].map((p) => p.textContent.trim());
    return ps.find((t) => /^(Inserted|Replaced|Deleted|Refused|Corner and safety-gap|That panel is already)/.test(t)) ?? null;
  })()`);

const openingSlotsBeforePlacement = await captureOpeningSlots();
const bodiesBeforePlacement = await panelBodies();
/**
 * ⚠ **REPLACE a standard panel, do not INSERT a new one — and the difference is
 * not stylistic.** An insert is born at the project's standard width and takes
 * that width out of the automatic panels, so the wall comes back from a stop
 * with one panel FEWER than it went in with: measured on this very step,
 * `basePanelCount: 17` against `restoredPanelCount: 16`, with the length still
 * exact to the eighth and both openings back. That is the pre-existing rule that
 * a re-tile does not preserve hand-set STANDARD widths (`handPlacedWallRetile.ts`
 * guards the width-edit path against it and the stop path does not), it is not
 * what this step is about, and asserting around it would have hidden it.
 *
 * Replacing the leftmost panel that is ALREADY at the wall's most common width —
 * the project standard — changes no width and no count at all: one standard slot
 * becomes one window slot of the same width. Deterministic, and it leaves
 * expectation 4 ("panel for panel") meaning what it says.
 */
const standardLabel = (() => {
  const counts = new Map();
  for (const body of bodiesBeforePlacement) counts.set(body.label, (counts.get(body.label) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || parseFloat(b[0]) - parseFloat(a[0]));
  return ranked.length > 0 ? ranked[0][0] : null;
})();
const replaceTarget = bodiesBeforePlacement.find((body) => body.label === standardLabel) ?? null;
if (!replaceTarget) throw new Error(`no panel at this wall's most common width (${standardLabel}) to replace with a window`);
await armTool("Window");
await click(replaceTarget.x, replaceTarget.y);
await sleep(900);
const placedOpeningNotice = await placementNotice();
await disarmTool("Window");
const placedOpeningWidthLabel = standardLabel;

const memoryBaseWidths = await panelWidths();
const memoryBaseEighths = sumEighths(memoryBaseWidths);
const openingSlotsBefore = await captureOpeningSlots();
await shot("14-openings-before-stop");
// Stops are swept from the START end, which is where the opening just placed
// is. A sweep with nothing in the way proves nothing, which is what
// expectation 3 below exists to catch — and what the insert above makes
// independent of the random seed.
const sweep = [];
for (const fraction of [0.15, 0.3, 0.45, 0.6, 0.75]) {
  const stopIn = Math.round(memoryBaseEighths * fraction) / 8;
  await commitStop("start", stopIn);
  const field = await stopField("start");
  const widths = await panelWidths();
  sweep.push({
    stopIn,
    invalid: field?.invalid ?? null,
    message: field?.message ?? null,
    totalEighths: sumEighths(widths),
    withheldOpenings: await withheldOpeningCount(),
  });
}
// The deepest stop the app accepted — where the most has been set aside.
const deepest = [...sweep].filter((s) => s.invalid === false).sort((a, b) => b.stopIn - a.stopIn)[0] ?? null;
let openingSlotsStopped = null;
if (deepest) {
  await commitStop("start", deepest.stopIn);
  openingSlotsStopped = await captureOpeningSlots();
}
await shot("15-openings-dropped-by-stop");
// Back to a whole wall, and the openings must come back.
await commitStop("start", 0);
const restoredWidths = await panelWidths();
const restoredWithheld = await withheldOpeningCount();
const openingSlotsRestored = await captureOpeningSlots();
await shot("16-openings-restored");
record(
  "openings-in-the-unbuilt-span-are-dropped-remembered-and-restored",
  {
    baseEighths: memoryBaseEighths,
    basePanelCount: memoryBaseWidths.length,
    openingSlotsBeforePlacement,
    panelCountBeforePlacement: bodiesBeforePlacement.length,
    placedOpeningNotice,
    placedOpeningWidthLabel,
    openingSlotsBefore,
    sweep,
    deepestAcceptedStopIn: deepest?.stopIn ?? null,
    openingSlotsStopped,
    restoredEighths: sumEighths(restoredWidths),
    restoredPanelCount: restoredWidths.length,
    restoredWithheld,
    openingSlotsRestored,
  },
  (d) =>
    // 0. Not vacuous — and not sample-dependent either: the opening this step
    //    rests on was PLACED by the step, near the start end, and the insert is
    //    asserted rather than assumed. `openingSlotsBefore` counts it in the
    //    3D model, so a refused insert cannot pass here.
    /^Replaced/.test(String(d.placedOpeningNotice ?? "")) &&
    d.openingSlotsBefore === d.openingSlotsBeforePlacement + 1 &&
    // The replacement neither widened nor narrowed anything: same panel count
    // going in as the wall had before it.
    d.basePanelCount === d.panelCountBeforePlacement &&
    d.openingSlotsBefore >= 1 &&
    // 1. THE BUG. The sentence Tommy was shown never appears again, at any
    //    stop anywhere along this wall.
    d.sweep.every((s) => !/add back up/i.test(String(s.message ?? ""))) &&
    // 2. Every stop the app accepted still conserves the wall exactly, in
    //    eighths — the invariant that was breaking.
    d.sweep
      .filter((s) => s.invalid === false)
      .every((s) => s.totalEighths + Math.round(s.stopIn * 8) === d.baseEighths) &&
    // 3. An opening really did leave the BUILT MODEL — not just the drawing —
    //    and the app said so in words rather than swallowing it silently.
    d.deepestAcceptedStopIn !== null &&
    d.openingSlotsStopped !== null &&
    d.openingSlotsStopped < d.openingSlotsBefore &&
    d.sweep.some((s) => s.invalid === false && s.withheldOpenings >= 1) &&
    // 4. And clearing the stop gives every one of them back, with nothing
    //    left withheld. "Remembered, not deleted", measured.
    d.restoredWithheld === 0 &&
    d.restoredEighths === d.baseEighths &&
    d.restoredPanelCount === d.basePanelCount &&
    d.openingSlotsRestored === d.openingSlotsBefore,
);

console.log("16. a brand-new footprint must not inherit the old building's remembered openings");
/**
 * ⚠ **The only shape that can catch a regression in `handleDraw`'s memory
 * reset, and it has to be here rather than in a unit test.**
 *
 * The third review's must-fix was that a remembered opening survived a brand-new
 * footprint and landed on the new building: wall ids are reused
 * (`buildRectangleFootprint` always emits "AB".."DA"), `pruneOpeningMemoryToLiveWalls`
 * drops ids the footprint LACKS and so cannot see it, and `hasStop` in the tiler
 * is true whenever the memory holds anything — so the next re-tile of any kind
 * merges a window from a building that no longer exists into this one as a REAL
 * opening, with a cut list line, a fabrication group, a shop drawing and a price.
 * The fix is one line in `handleDraw`: `setUnbuiltOpeningsByStoryAndWallId({ ground: {}, second: {} })`.
 *
 * **Its regression test did not guard it.** `retile.test.ts`'s "a leftover memory
 * puts a window on a wall nobody drew one on" is a geometry test — it never
 * touches page.tsx, so it passes identically with and without that line. Delete
 * the fix and the unit suite stays green. Nothing below `handleDraw` can guard
 * `handleDraw`, and every other building-replacement path (file load, cloud
 * open) goes through `applyProjectState`, so this gesture is the gap.
 *
 * So: stop the wall until it really is holding an opening, draw a new footprint
 * over the top, and re-tile the reused wall id once. The opening count on that
 * wall must not move. With the fix removed it goes up by one.
 */
const redrawWithheld = deepest ? await (async () => {
  await commitStop("start", deepest.stopIn);
  return await withheldOpeningCount();
})() : 0;
await reachView((l) => l === "2D Floor Plan", "2D Floor Plan");
await sleep(900);
await closeOpenNotes();
// The Rectangle tool re-arms by title, not by text: each button's label sits
// beside an icon glyph in the same element, so `textContent` is "▭Rectangle".
const armRectangle = async () => {
  const box = await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Shape tool"]');
    if (!group) return null;
    const b = [...group.querySelectorAll('button')].find((x) => x.getAttribute('title') === 'Rectangle');
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pressed: b.getAttribute('aria-pressed') === 'true' };
  })()`);
  if (!box) throw new Error('no Rectangle button in the Shape tool group');
  if (!box.pressed) {
    await click(box.x, box.y);
    await sleep(400);
  }
  const after = await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Shape tool"]');
    const b = group && [...group.querySelectorAll('button')].find((x) => x.getAttribute('title') === 'Rectangle');
    return b ? b.getAttribute('aria-pressed') === 'true' : null;
  })()`);
  if (after !== true) throw new Error('the Rectangle tool did not arm');
};
await armRectangle();
// A DIFFERENT rectangle, deliberately — the wall length is what proves the
// draw actually happened, and a redraw at the same size would prove nothing.
// Different but not much SMALLER: a short building has fewer stops the app
// will accept (the pre-existing braced-combine residual refuses on the
// neighbour), and the step needs one accepted stop to re-tile with.
const redrawBox = await evaluate(`(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
if (!redrawBox) throw new Error("no canvas to redraw on");
const [rx, ry, rw, rh] = redrawBox;
const nx0 = rx + 70;
const ny0 = ry + 95;
const nx1 = rx + rw - 110;
const ny1 = ry + rh - 155;
await mouse("mousePressed", nx0, ny0);
await sleep(80);
await mouse("mouseMoved", (nx0 + nx1) / 2, (ny0 + ny1) / 2);
await sleep(80);
await mouse("mouseMoved", nx1, ny1);
await sleep(80);
await mouse("mouseReleased", nx1, ny1);
await sleep(1800);
await shot("17-redrawn-footprint");
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
const redrawnWidths = await panelWidths();
const redrawnEighths = sumEighths(redrawnWidths);
const openingSlotsAfterRedraw = await captureOpeningSlots();
/**
 * ONE further edit of any kind is all the stale memory ever needed — `hasStop`
 * in the tiler is true whenever the memory holds anything — and a stop is
 * simply the edit this harness can already drive.
 *
 * ⚠ **It has to be an ACCEPTED one, and the first version of this step did not
 * check.** A refused stop changes nothing, so the count below would have been
 * read off a wall that was never re-tiled and the whole step would have passed
 * vacuously — it did, on its first run: every start stop on the redrawn wall
 * came back `invalid` with *"does not leave a run on wall BC whose panels add
 * back up to that wall"*, which is the known pre-existing braced-combine
 * residual on the NEIGHBOUR wall (see "Six things left uncoded" in the spec),
 * not anything this step is about.
 *
 * ⚠ **So the stop does not have to be on the wall being checked, and it is
 * better that it is not.** `retilePreservingOpeningsWithRunStopMemory` walks
 * EVERY wall on every call and merges each one's remembered openings, so a stop
 * accepted anywhere in the building re-tiles the reused wall id too. The step
 * therefore walks the elevations until the app accepts a stop somewhere,
 * records every attempt with its refusal sentence, and requires one to have
 * been taken.
 */
const nudgeAttempts = [];
let nudgeTaken = null;
const elevationStops = (await view.cycle()).filter((l) => l.startsWith("Elevation: "));
for (const label of elevationStops) {
  if (nudgeTaken) break;
  await reachView((l) => l === label, label);
  await sleep(1000);
  const wallEighths = sumEighths(await panelWidths());
  for (const fraction of [0.08, 0.05, 0.03]) {
    const candidateIn = Math.round(wallEighths * fraction) / 8;
    if (candidateIn <= 0) continue;
    await commitStop("start", candidateIn);
    const field = await stopField("start");
    nudgeAttempts.push({ wall: label, stopIn: candidateIn, invalid: field?.invalid ?? null, message: field?.message ?? null });
    const accepted = field?.invalid === false;
    // Always put the field back, accepted or refused: the count below is read
    // off a whole building, the same shape as the one taken after the draw.
    // Clearing an accepted stop is itself a second re-tile, which is fine.
    await commitStop("start", 0);
    if (accepted) {
      nudgeTaken = { wall: label, stopIn: candidateIn };
      break;
    }
  }
}
await reachView((l) => l === `Elevation: ${targetWallId}`, `Elevation: ${targetWallId}`);
await sleep(1200);
const openingSlotsAfterRetile = await captureOpeningSlots();
const withheldAfterRetile = await withheldOpeningCount();
await shot("18-redrawn-after-one-retile");
record(
  "a-new-footprint-does-not-inherit-the-old-buildings-remembered-openings",
  {
    withheldWhenRedrawn: redrawWithheld,
    baseEighthsBeforeRedraw: memoryBaseEighths,
    redrawnEighths,
    redrawnPanelCount: redrawnWidths.length,
    openingSlotsAfterRedraw,
    nudgeTaken,
    nudgeAttempts,
    nudgeAccepted: nudgeTaken !== null,
    openingSlotsAfterRetile,
    withheldAfterRetile,
  },
  (d) =>
    // 0. Not vacuous: the old building really was holding an opening in memory
    //    at the moment the new one was drawn. Without this the step would pass
    //    on a wall that had nothing to inherit.
    d.withheldWhenRedrawn >= 1 &&
    // 1. A new building really was drawn over the old one, on the same reused
    //    wall id — a different wall length is the proof.
    d.redrawnEighths > 0 &&
    d.redrawnEighths !== d.baseEighthsBeforeRedraw &&
    d.redrawnPanelCount >= 3 &&
    // 2. The re-tile really happened: a refused stop changes nothing, and a
    //    step that never re-tiled would pass the next line for free.
    d.nudgeAccepted === true &&
    // 3. THE FIX. One re-tile of the reused wall id, and no opening from the
    //    building that no longer exists appears on it.
    d.openingSlotsAfterRedraw !== null &&
    d.openingSlotsAfterRetile === d.openingSlotsAfterRedraw &&
    // 4. …and nothing is being held back on the new building either, so the
    //    count above is not just a withheld opening hiding a resurrected one.
    d.withheldAfterRetile === 0,
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
