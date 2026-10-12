/**
 * U4.1 — Summary as a full page, and THE DRAWING SURVIVES THE ROUND TRIP.
 *
 * ⚠ This harness exists for exactly one hazard, named in the 2026-09-26 plan
 * §13: `FootprintCanvas` keeps `viewOffset`, `viewScale` and the measuring-tool
 * state in its own component state, and `Building3DView` keeps its camera in
 * the R3F store. **Unmounting the editor to show Summary silently resets a
 * user's pan, zoom, label toggle and 3D camera** — a "nothing is lost" failure
 * that no unit test catches and that reads as a glitch rather than a bug.
 *
 * ⚠ AND IT PROVES ITS OWN INSTRUMENT FIRST. The view is fingerprinted by
 * hashing the plan canvas's pixels, which is stronger evidence than any
 * readout — but "the hash matched" means nothing unless the hash MOVES when the
 * view moves. So step 3 deliberately pans and zooms and asserts the fingerprint
 * changed, before step 5 asserts it did not. A fingerprint that never changes
 * would pass the round-trip check while measuring nothing at all.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = process.env.UI_REORG_U4_APP_URL ?? "http://localhost:3000/";
const CDP = process.env.UI_REORG_U4_CDP_PORT ?? "9458";
const PROVE_FAILURE = process.env.UI_REORG_U4_PROVE_FAILURE === "1";
const EVIDENCE_FILE = fileURLToPath(new URL("./evidence.json", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
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
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }, sid);

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 160));
  return res.result.result?.value;
};
const mouse = (type, x, y, extra = {}) =>
  send(
    "Input.dispatchMouseEvent",
    { type, x, y, button: "left", clickCount: 1, buttons: type === "mouseReleased" ? 0 : 1, ...extra },
    sid,
  );
const click = async (x, y) => {
  await mouse("mousePressed", x, y);
  await sleep(60);
  await mouse("mouseReleased", x, y);
  await sleep(500);
};
const clickSel = async (sel) => {
  const at = await evaluate(
    "(() => { const e = document.querySelector(" +
      JSON.stringify(sel) +
      "); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null; })()",
  );
  if (!at) throw new Error("not clickable: " + sel);
  await click(at.x, at.y);
};

const failures = [];
const evidence = { app: APP, ranAt: new Date().toISOString(), proveFailureMode: PROVE_FAILURE, checks: [] };
let reachedTheRealWork = false;

const record = (name, detail, expect) => {
  if (typeof expect !== "function") throw new Error("record() needs an expectation: " + name);
  const ok = expect(detail) === true;
  console.log((ok ? "  [PASS] " : "  [FAIL] ") + name + "  " + JSON.stringify(detail));
  evidence.checks.push({ name, ok, detail });
  if (!ok) failures.push(name);
};

/* The evidence-stub hazard: a run that never reached the browser still fires
 * its exit handler, and an unguarded writer replaces a real record with a
 * ~100-byte stub. Nothing is written until there is a building to look at, and
 * nothing at all in prove-failure mode, whose artefact would be a failing
 * record of a passing app. */
process.on("exit", () => {
  if (PROVE_FAILURE || !reachedTheRealWork) return;
  evidence.failures = failures;
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2));
});

/** The plan canvas's pixels, hashed — the view's whole state in one number. */
const viewFingerprint = async () =>
  await evaluate(`(async () => {
  const c = [...document.querySelectorAll('canvas')]
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  if (!c) return { sha: null, zoom: null };
  const url = c.toDataURL();
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  const sha = [...new Uint8Array(d)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  // The zoom readout is a SECOND, independent witness: a canvas that failed to
  // draw at all would hash consistently while telling you nothing.
  const zoomIn = document.querySelector('button[title="Zoom in"]');
  const readout = zoomIn ? zoomIn.previousElementSibling : null;
  const zoom = readout && /^[0-9]+%$/.test(readout.textContent.trim()) ? readout.textContent.trim() : null;
  return { sha, zoom, canvasW: c.width, canvasH: c.height };
})()`);

/** What the editor's canvas column and the Summary page are doing right now. */
const surfaceState = async () =>
  await evaluate(`(() => {
  const page = document.querySelector('[data-editor-surface="summary"]');
  const host = document.querySelector('[data-summary-page-host]');
  const canvas = document.querySelector('canvas');
  // The canvas column is the drawing's own layer, found VIA the canvas so this
  // does not depend on a CSS module's hashed class name.
  const layer = canvas ? canvas.closest('div[class*="editorCanvasLayer"]') : null;
  const summaryBtn = document.querySelector('[data-bar-control="summary"]');
  const design = document.querySelector('[data-view-menu="design"]');
  const view = document.querySelector('[data-view-menu="view"]');
  const section = host ? host.querySelector('#detail-summary') : null;
  return {
    pagePresent: !!page,
    hostPresent: !!host,
    canvasStillInDom: !!canvas,
    canvasLayerDisplay: layer ? getComputedStyle(layer).display : null,
    summaryOwner: summaryBtn ? summaryBtn.getAttribute('data-surface-owner') : null,
    summaryDisabled: summaryBtn ? summaryBtn.disabled : null,
    designOwner: design ? design.getAttribute('data-view-menu-owner') : null,
    viewOwner: view ? view.getAttribute('data-view-menu-owner') : null,
    sectionInHost: !!section,
    sectionTextLength: section ? section.innerText.length : 0,
  };
})()`);

await send("Page.navigate", { url: APP }, sid);
await sleep(5000);

console.log("1. the bar before anything: Summary is a real control now");
record(
  "summary-is-no-longer-a-disabled-placeholder",
  await surfaceState(),
  // U4's whole visible change. A `disabled` Summary here would mean the build
  // shipped the state machine and left the door locked.
  (d) => d.summaryDisabled === false && d.summaryOwner === "false" && d.pagePresent === false,
);

console.log("2. a footprint, so there is a drawing worth preserving");
const canvasBox = await evaluate(
  `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`,
);
if (!canvasBox) throw new Error("no canvas — are you on localhost rather than 127.0.0.1?");
{
  const [cx, cy, cw, ch] = canvasBox;
  const x0 = cx + 60,
    y0 = cy + 80,
    x1 = cx + cw - 80,
    y1 = cy + ch - 120;
  await mouse("mousePressed", x0, y0);
  await sleep(80);
  await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
  await sleep(80);
  await mouse("mouseMoved", x1, y1);
  await sleep(80);
  await mouse("mouseReleased", x1, y1);
  await sleep(1800);
}
reachedTheRealWork = true;
const drawn = await viewFingerprint();
record(
  "footprint-drawn-and-the-canvas-has-pixels",
  drawn,
  // Everything below compares fingerprints, so a blank canvas would make every
  // later comparison agree for the wrong reason.
  (d) => typeof d.sha === "string" && d.canvasW > 0 && d.zoom !== null,
);

console.log("3. pan and zoom away from the default, which is what must survive");
/* ⚠ Driven through the canvas's OWN controls rather than synthetic wheel
   events. A first attempt dispatched CDP `mouseWheel` with and without Ctrl
   and the view did not move at all — so the calibration check went red and
   said so, which is the only reason this was caught instead of shipping a
   round-trip check that compared a constant to itself. The buttons carry
   real titles and are what a user uses. */
{
  await clickSel('button[title="Zoom in"]');
  await sleep(400);
  await clickSel('button[title="Zoom in"]');
  await sleep(600);
  // Then PAN, which is a separate piece of state from zoom and would
  // survive or reset independently: arm the pan tool and drag.
  await clickSel('button[title*="Pan"]');
  await sleep(300);
  const [cx, cy, cw, ch] = canvasBox;
  const mx = cx + cw / 2,
    my = cy + ch / 2;
  await mouse("mousePressed", mx, my);
  await sleep(80);
  await mouse("mouseMoved", mx - 90, my - 50);
  await sleep(80);
  await mouse("mouseReleased", mx - 90, my - 50);
  await sleep(700);
}
const moved = await viewFingerprint();
record(
  "the-fingerprint-MOVES-when-the-view-moves",
  { before: drawn.sha, beforeZoom: drawn.zoom, after: moved.sha, afterZoom: moved.zoom },
  // ⚠ THE INSTRUMENT'S OWN CALIBRATION. Without this, the round-trip check
  // below could be true of a fingerprint that is constant no matter what the
  // user does — a check that passes while measuring nothing.
  (d) => d.after !== d.before,
);

console.log("4. open Summary from the bar");
await clickSel('[data-bar-control="summary"]');
await sleep(1200);
const onSummary = await surfaceState();
record(
  "summary-owns-the-surface-and-the-drawing-is-HIDDEN-not-unmounted",
  onSummary,
  // The three parts of U4.1's contract together: the page is there, the drawing
  // is display:none but STILL IN THE DOM (the whole point — an absent canvas is
  // the bug this stage exists to prevent), and exactly one control owns.
  (d) =>
    d.pagePresent === true &&
    d.hostPresent === true &&
    d.canvasStillInDom === true &&
    d.canvasLayerDisplay === "none" &&
    d.summaryOwner === "true" &&
    d.designOwner === "false" &&
    d.viewOwner === "false",
);
record(
  "the-Project-Summary-section-is-rendered-INSIDE-the-page",
  onSummary,
  // Not merely "a page appeared": the section portalled into the host and has
  // real content. An empty page is the thing U4.1 refused to ship.
  (d) => d.sectionInHost === true && d.sectionTextLength > 40,
);

console.log("5. back to the drawing");
await clickSel('[data-bar-control="summary"]');
await sleep(1500);
record(
  "clicking-Summary-again-returns-you-to-the-drawing",
  await surfaceState(),
  (d) => d.pagePresent === false && d.canvasLayerDisplay !== "none" && d.summaryOwner === "false",
);

const restored = await viewFingerprint();
record(
  "PAN-AND-ZOOM-SURVIVED-THE-ROUND-TRIP",
  { leftWith: moved.sha, leftZoom: moved.zoom, cameBackTo: restored.sha, cameBackZoom: restored.zoom },
  // The hazard itself. Calibrated by step 3: this fingerprint is known to be
  // sensitive to both pan and zoom, so an exact match is a real guarantee and
  // not a tautology.
  (d) => d.cameBackTo === d.leftWith && d.cameBackZoom === d.leftZoom,
);

console.log(failures.length === 0 ? "\nALL PASS" : "\nFAILURES: " + failures.join(", "));
await send("Target.closeTarget", { targetId });
ws.close();
process.exit(failures.length === 0 ? 0 : 1);
