/**
 * Browser harness — the off-screen summary canvas's idle render loop.
 *
 * **In the repo on purpose**, like the Smearforn and ui-reorg harnesses next
 * door, and the CDP plumbing below is theirs.
 *
 * ### What it measures, and why a unit test cannot
 *
 * `BuildingSummaryRender` parks a full `Building3DView` inside a
 * react-three-fiber `<Canvas>` at `left: -9999px` to grab one PNG for the
 * Project Summary page. react-three-fiber's default `frameloop="always"`
 * then keeps that canvas rendering the whole building at 60fps for the rest
 * of the session. Nothing in a test file can see a render loop; only a
 * running browser can.
 *
 * So this harness:
 *   1. draws a footprint, reads the real panel count off the app itself
 *   2. sits in PLAN view and does nothing at all — the IDLE window
 *   3. samples the V8 CPU profiler over that window and attributes self-time
 *      to `three` / `@react-three/fiber` by script URL
 *   4. reads the longest `longtask` PerformanceObserver entry over the same
 *      window
 *   5. captures the Project Summary's own PNG, makes a real design change
 *      (wall height), captures it again, and compares the two by SHA-256 —
 *      a byte-identical PNG after a height change is a STALE summary, which
 *      is a worse bug than the loop it would be fixing
 *
 * ### ⚠ The caveat that has to travel with every number here
 *
 * Headless Chrome rasterises WebGL in **software** (SwiftShader), so the
 * GPU-side share of these figures is pessimistic against a real machine with
 * a real GPU. What is main-thread *anywhere* is the JavaScript: the
 * `updateMatrixWorld` walk over thousands of meshes and drei's raycasting.
 * Treat "the loop runs forever" as solid and the absolute milliseconds as an
 * upper bound. The before/after RATIO is the robust part.
 *
 * ### Why PLAN view is the idle fixture
 *
 * The editor's own `Building3DView` is mounted only on the 3D view stop
 * (`page.tsx`'s `viewMode === "elevation" ? ... : viewMode === "plan" ? ...
 * : <Building3DView>`), so in plan view the ONLY react-three canvas on the
 * page is the off-screen summary one. That isolates the thing under test:
 * anything three.js burns here is the hidden canvas, by construction.
 *
 * HOW TO RUN (from the repo root), against a PRODUCTION build — dev-mode
 * numbers are worthless for this:
 *   1. `cd apps/web && npx next build && npx next start -p <port>`
 *   2. `chrome --headless=new --remote-debugging-port=<cdp>
 *      --window-size=1600,1000 --user-data-dir=<unique temp> about:blank`
 *   3. `FRAMELOOP_APP_URL=http://localhost:<port>/ FRAMELOOP_CDP_PORT=<cdp>
 *      FRAMELOOP_LABEL=before-300 FRAMELOOP_FOOTPRINT_PX=620x460
 *      node apps/web/harness/frameloop-perf/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`** — see the Stage 0/1 harness's note:
 * the dynamic-import chunks never arrive over 127.0.0.1 and the canvas
 * silently never appears.
 *
 * **The first headless Chrome launch of a session draws a different
 * footprint than later ones** (shader cache cold, SwiftShader warming). Run
 * each configuration at least twice and believe the second.
 *
 * Env knobs:
 *   - `FRAMELOOP_FOOTPRINT_PX=WxH` — the drag that draws the footprint, in
 *     px. This is the panel-count dial; the run reports the count it got
 *     rather than assuming one.
 *   - `FRAMELOOP_IDLE_MS` — the idle window (default 2500).
 *   - `FRAMELOOP_LABEL` — names the evidence file and the screenshots.
 *
 * `record()` REFUSES to run without an expectation, and the process exits
 * non-zero if any of them is false. `writeEvidence()` runs on `exit`, which
 * is BEFORE the exit-code check a caller does — so `git status` after every
 * run of this file.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.FRAMELOOP_APP_URL ?? "http://localhost:3301/";
const CDP_PORT = process.env.FRAMELOOP_CDP_PORT ?? "9471";
const LABEL = process.env.FRAMELOOP_LABEL ?? "run";
const IDLE_MS = Number(process.env.FRAMELOOP_IDLE_MS ?? "2500");

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, label: LABEL, ranAt: new Date().toISOString(), idleWindowMs: IDLE_MS, steps: [] };
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
  fs.writeFileSync(path.join(HERE, `evidence-${LABEL}.json`), JSON.stringify(evidence, null, 2));
  console.log(`\nevidence -> evidence-${LABEL}.json`);
};
process.on("exit", writeEvidence);
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
await send("Profiler.enable", {}, sid);
await send("Profiler.setSamplingInterval", { interval: 200 }, sid);

/**
 * Installed BEFORE any app script runs, and it is the most important
 * instrument in this file — because it is the one number the software-raster
 * caveat cannot touch.
 *
 * Two patches:
 *   - `getContext` tags any canvas that asks for a webgl/webgl2 context, so
 *     the census can identify the react-three canvases POSITIVELY rather
 *     than guessing from an off-screen `left`. (A first attempt probed for
 *     r3f's own `__r3f` property and got `false` on every canvas including
 *     the real ones, which would have made the audit a fiction.)
 *   - `drawElements`/`drawArrays` count into a counter. **Draw calls per
 *     idle second is a direct count of whether a render loop is running**,
 *     independent of how fast or slow the machine draws them. A sampled
 *     millisecond figure can be argued about; "it issued 190,000 draw calls
 *     while the user did nothing" cannot.
 *
 * The counter is one `++` per GL call, against a GL call that does real
 * work, so its own cost is noise — but it IS a perturbation and is named
 * here rather than pretended away.
 */
await send(
  "Page.addScriptToEvaluateOnNewDocument",
  {
    source: `
      window.__flDraws = 0;
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (typeof type === "string" && type.indexOf("webgl") === 0) this.__flWebgl = true;
        return origGetContext.call(this, type, ...rest);
      };
      for (const proto of [window.WebGLRenderingContext && window.WebGLRenderingContext.prototype, window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype]) {
        if (!proto) continue;
        for (const fn of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
          const orig = proto[fn];
          if (!orig) continue;
          proto[fn] = function (...args) {
            window.__flDraws++;
            return orig.apply(this, args);
          };
        }
      }
    `,
  },
  sid,
);

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 160));
  return res.result.result?.value;
};

const shot = async (name) => {
  const png = await send("Page.captureScreenshot", { format: "png" }, sid);
  fs.writeFileSync(path.join(SHOTS, `${LABEL}-${name}.png`), Buffer.from(png.result.data, "base64"));
  console.log(`  screenshot -> screenshots/${LABEL}-${name}.png`);
};

const mouse = (type, x, y, extra = {}) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: 1, ...extra }, sid);

// --- profiling --------------------------------------------------------------

/**
 * Aggregates a V8 CPU profile into self-time per script bucket.
 *
 * Self-time, not total time: a node's `hitCount` is the number of samples
 * whose TOP frame was that function, so summing hit counts per bucket and
 * multiplying by the mean sample interval attributes time to the code that
 * was actually executing. (Total time would double-count every three.js
 * frame under its React caller and make the shares meaningless.)
 *
 * The interval is derived from the profile's own wall clock rather than the
 * 200µs we requested, because V8 delivers "about" that and the difference
 * shows up directly in the answer.
 */
const summarizeProfile = (profile) => {
  const totalSamples = profile.samples?.length ?? 0;
  const wallMs = (profile.endTime - profile.startTime) / 1000;
  const perSampleMs = totalSamples > 0 ? wallMs / totalSamples : 0;
  const byNodeId = new Map();
  for (const node of profile.nodes) byNodeId.set(node.id, node);

  const bucketOf = (node) => {
    const url = node.callFrame?.url ?? "";
    const fn = node.callFrame?.functionName ?? "";
    if (/three|react-three|\bdrei\b/i.test(url)) return "three-stack";
    if (fn === "(program)") return "native/program";
    if (fn === "(idle)") return "idle";
    if (fn === "(garbage collector)") return "gc";
    if (url) return "app+other-js";
    return "native/anonymous";
  };

  const selfMsByBucket = {};
  const topFns = new Map();
  for (const node of profile.nodes) {
    const hits = node.hitCount ?? 0;
    if (hits === 0) continue;
    const bucket = bucketOf(node);
    selfMsByBucket[bucket] = (selfMsByBucket[bucket] ?? 0) + hits * perSampleMs;
    const fn = node.callFrame?.functionName || "(anonymous)";
    const key = `${bucket}:${fn}`;
    topFns.set(key, (topFns.get(key) ?? 0) + hits * perSampleMs);
  }
  const round = (n) => Math.round(n * 10) / 10;
  for (const k of Object.keys(selfMsByBucket)) selfMsByBucket[k] = round(selfMsByBucket[k]);
  /**
   * The headline figure, and it needs no script-URL attribution to be
   * honest: `busyMs` is wall time minus V8's own `(idle)` samples, i.e. how
   * much of the idle window the main thread spent executing anything at all.
   * ⚠ A production build bundles `three` into a Next.js chunk, so bucketing
   * by script URL CANNOT separate three.js from app code — the first version
   * of this function tried and reported a flat 0 for three while
   * `renderBufferDirect` sat in the app bucket. `busyMs` sidesteps that: in
   * plan view with the hidden canvas as the only WebGL surface, idle busy
   * time IS the render loop, and the before/after difference measures it
   * without having to name it.
   */
  const idleMs = selfMsByBucket.idle ?? 0;
  return {
    wallMs: round(wallMs),
    busyMs: round(wallMs - idleMs),
    busySharePct: wallMs > 0 ? Math.round(((wallMs - idleMs) / wallMs) * 1000) / 10 : 0,
    totalSamples,
    perSampleMs: Math.round(perSampleMs * 1000) / 1000,
    selfMsByBucket,
    topSelfFunctions: [...topFns.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => ({ frame: k, selfMs: round(v) })),
  };
};

/** Arms a longtask observer and clears whatever it saw before. */
const armLongTasks = async () =>
  await evaluate(`(() => {
    window.__flTasks = [];
    if (window.__flObs) window.__flObs.disconnect();
    window.__flObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__flTasks.push(Math.round(e.duration * 10) / 10);
    });
    window.__flObs.observe({ entryTypes: ['longtask'] });
    return true;
  })()`);

const readLongTasks = async () =>
  await evaluate(`(() => {
    const t = (window.__flTasks || []).slice();
    t.sort((a, b) => b - a);
    return { count: t.length, longestMs: t[0] ?? 0, totalMs: Math.round(t.reduce((s, x) => s + x, 0) * 10) / 10, top: t.slice(0, 6) };
  })()`);

/** One idle measurement: arm, profile, do nothing, read back. */
const measureIdle = async (what) => {
  await armLongTasks();
  await evaluate(`(window.__flDraws = 0, true)`);
  await send("Profiler.start", {}, sid);
  await sleep(IDLE_MS);
  const stopped = await send("Profiler.stop", {}, sid);
  const glDrawCalls = await evaluate(`window.__flDraws`);
  const tasks = await readLongTasks();
  const summary = summarizeProfile(stopped.result.profile);
  return {
    what,
    glDrawCalls,
    glDrawCallsPerSec: Math.round(glDrawCalls / (summary.wallMs / 1000)),
    ...summary,
    longTasks: tasks,
  };
};

// --- the app, as the DOM shows it -------------------------------------------

const waitForCanvas = async (timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const box = await evaluate(
      `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return r.width > 0 ? [r.left, r.top, r.width, r.height] : null; })()`,
    );
    if (box) return box;
    if (Date.now() > deadline) return null;
    await sleep(1000);
  }
};

/** Every react-three canvas on the page, with its on-screen position — the
 * audit's own evidence. A canvas parked at a negative `left` is the
 * off-screen summary one; the plan-view 2D editor canvas is a plain 2D
 * context and is told apart by asking the element for a webgl context. */
const canvasCensus = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect();
      // \`__flWebgl\` is set by the getContext patch installed above, so this
      // is a POSITIVE identification of a WebGL canvas rather than an
      // inference from its position.
      return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), webgl: Boolean(c.__flWebgl), offScreen: r.left < -1000 };
    });
  })()`);

/** The Project Summary's own PNG, as the page holds it. Opens the note,
 * reads the `<img>` the page is actually showing, closes it again. */
const readSummaryPng = async () => {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('Project Summary'));
    if (!b) throw new Error('no Project Summary section card');
    b.click();
    return true;
  })()`);
  await sleep(1400);
  const src = await evaluate(`(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => (i.src || '').startsWith('data:image/png'));
    return imgs.length === 0 ? null : imgs[0].src;
  })()`);
  return src;
};

const closeOpenNotes = async () => {
  await evaluate(`(() => { for (const b of [...document.querySelectorAll('button[title="Hide this note"]')]) b.click(); })()`);
  await sleep(700);
};

const sha = (s) => (s === null ? null : crypto.createHash("sha256").update(s).digest("hex").slice(0, 16));

/** Commits a new wall height the way a user does — type, then Enter.
 * `LengthInput` commits on blur/Enter, not per keystroke, so an `input`
 * event alone would type into the draft and never commit it. */
const setWallHeightFt = async (ft) => {
  // U3 moved the Panelizer's fields into the ⚙ Settings note, so the field
  // only exists once that note is open — a first version of this helper
  // looked for it on the bare page and threw "no Wall height field".
  await evaluate(`(() => {
    const b = document.querySelector('button[aria-label="Settings"]');
    if (!b) throw new Error('no Settings button in the top bar');
    b.click();
    return true;
  })()`);
  await sleep(1200);
  await evaluate(`(() => {
    const el = document.querySelector('input[aria-label="Wall height"]');
    if (!el) throw new Error('no Wall height field in the open Settings note');
    el.scrollIntoView({ block: 'center' });
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(String(ft))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, sid);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, sid);
  await sleep(1600);
  const committed = await evaluate(`(() => {
    const el = document.querySelector('input[aria-label="Wall height"]');
    return el ? el.value : null;
  })()`);
  await evaluate(`(() => { for (const b of [...document.querySelectorAll('button[title="Hide this note"]')]) b.click(); })()`);
  await sleep(800);
  return committed;
};

/** The app's own panel count, read off the Project Summary's Panels row —
 * the number the app reports, not one this harness derived. */
const readPanelCount = async () => {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('Project Summary'));
    if (!b) throw new Error('no Project Summary section card');
    b.click();
    return true;
  })()`);
  await sleep(1200);
  const n = await evaluate(`(() => {
    const m = /([0-9]+) wall panels/.exec(document.body.innerText);
    return m ? Number(m[1]) : null;
  })()`);
  return n;
};

// --- the run ----------------------------------------------------------------
console.log(`1. loading the app (${LABEL})`);
await send("Page.navigate", { url: APP_URL }, sid);
const canvasBox = await waitForCanvas(120000);
if (!canvasBox) throw new Error("no canvas after 120s — is the URL localhost rather than 127.0.0.1?");

console.log("2. drawing a footprint");
/**
 * The panel-count dial has TWO knobs, because the drag alone cannot reach
 * the high count: the draw gesture is in screen px and the plan canvas is
 * 720x480, so at the default scale (~12 px/ft) the biggest footprint that
 * fits is roughly 60x40ft — about 80 panels. `FRAMELOOP_ZOOM_OUT` clicks the
 * plan view's own Zoom out button first (x1.25 per click, floored at 0.25 in
 * `FootprintCanvas`), which buys up to 4x the feet per px.
 */
const ZOOM_OUT = Number(process.env.FRAMELOOP_ZOOM_OUT ?? "0");
if (ZOOM_OUT > 0) {
  for (let i = 0; i < ZOOM_OUT; i++) {
    await evaluate(`(() => {
      const b = document.querySelector('button[title="Zoom out"]');
      if (!b) throw new Error('no Zoom out button in the plan toolbar');
      b.click();
      return true;
    })()`);
    await sleep(150);
  }
  evidence.zoomOutClicks = ZOOM_OUT;
  console.log(`  (zoomed out ${ZOOM_OUT}x first)`);
}
const [cx, cy, cw, ch] = canvasBox;
/** Keeps the whole drag inside the plan canvas. A drag that ran past the
 * bottom edge produced NO footprint at all and the run then failed three
 * steps down with "panelCount: 0", naming nothing useful. */
const MARGIN_PX = 12;
const spec = process.env.FRAMELOOP_FOOTPRINT_PX ?? "";
const [specW, specH] = spec.split("x").map((n) => Number(n));
const fw = Number.isFinite(specW) && specW > 0 ? specW : 0;
const fh = Number.isFinite(specH) && specH > 0 ? specH : fw;
const x0 = cx + MARGIN_PX;
const y0 = cy + MARGIN_PX;
const x1 = fw > 0 ? x0 + fw : cx + cw - MARGIN_PX;
const y1 = fh > 0 ? y0 + fh : cy + ch - MARGIN_PX;
evidence.footprintPx = fw > 0 ? `${fw}x${fh}` : "full-canvas";
await mouse("mousePressed", x0, y0);
await sleep(80);
await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
await sleep(80);
await mouse("mouseMoved", x1, y1);
await sleep(80);
await mouse("mouseReleased", x1, y1);
await sleep(2500);

/**
 * The standard-width knob. Panels tile at the project's Standard width, so
 * dropping it from the 32in default to the 24in fabrication floor puts
 * about a third more panels on the same walls without changing the
 * building. ⚠ 24in is `fabricationMinPanelWidthIn`, the shop's own floor —
 * this knob must never be driven BELOW it, because a wall tiled at a
 * sub-floor setting is unbuildable (see the spec's minimum-panel-width
 * section). It is here as a scene-size dial, not as a design suggestion.
 */
if (process.env.FRAMELOOP_STANDARD_WIDTH_IN) {
  const widthIn = process.env.FRAMELOOP_STANDARD_WIDTH_IN;
  await evaluate(`(() => {
    const b = document.querySelector('button[aria-label="Settings"]');
    if (!b) throw new Error('no Settings button in the top bar');
    b.click();
    return true;
  })()`);
  await sleep(1200);
  await evaluate(`(() => {
    const el = document.querySelector('input[aria-label="Standard width in inches"]');
    if (!el) throw new Error('no Standard width field in the open Settings note');
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(String(widthIn))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, sid);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, sid);
  await sleep(2000);
  await evaluate(`(() => { for (const b of [...document.querySelectorAll('button[title="Hide this note"]')]) b.click(); })()`);
  await sleep(800);
  evidence.standardWidthIn = Number(widthIn);
  console.log(`  (standard width set to ${widthIn}in)`);
}

/**
 * The second-storey knob, and it exists for an arithmetic reason rather than
 * a feature one. Panel count grows with the wall PERIMETER at a measured
 * ~0.29 panels/ft, and the draw gesture converts SCREEN px at a fixed
 * 12px/ft (`SCALE_PX_PER_FT`), so the 720x480 plan canvas caps a single drag
 * at about 58x38ft — roughly 55 ground-floor panels, full stop. A second
 * storey roughly doubles the scene.
 *
 * ⚠ **Measured, and it is why this file no longer leans on `FRAMELOOP_ZOOM_OUT`:**
 * zooming the plan view out first does NOT draw a bigger building. The same
 * 500x340px drag produced **41 panels at zoom 0, 41 at zoom 3 and 41 at zoom
 * 5**. Whether that is intended is not something this harness investigated —
 * it is recorded because it is the reason the high panel count here is a few
 * hundred rather than a few thousand.
 */
if (process.env.FRAMELOOP_SECOND_STORY === "1") {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Add Second Story'));
    if (!b) throw new Error('no Add Second Story button in the plan toolbar');
    if (b.disabled) throw new Error('Add Second Story is disabled — is there a footprint?');
    b.click();
    return true;
  })()`);
  await sleep(2500);
  evidence.secondStory = true;
  console.log("  (added a second storey)");
}

/**
 * The third knob, and the only one that grows the SCENE without growing the
 * panel count. `maxPanelHeightIn` defaults to 120in, so a wall taller than
 * 10ft is built as two stacked vertical bands of panels — the Project
 * Summary still reports the same number of wall panels, but the 3D scene
 * carries roughly twice the meshes and the render loop roughly twice the
 * draw calls (measured: 77,285 -> 147,465 draws over the same 2.5s idle
 * window when the wall went 10ft -> 16ft at 19 panels). That is why this
 * run reports draw-calls-per-frame alongside the panel count: panel count
 * is the brief's axis, draws-per-frame is the honest one.
 */
if (process.env.FRAMELOOP_WALL_HEIGHT_FT) {
  const committed = await setWallHeightFt(process.env.FRAMELOOP_WALL_HEIGHT_FT);
  evidence.wallHeightFt = process.env.FRAMELOOP_WALL_HEIGHT_FT;
  console.log(`  (wall height set to ${committed})`);
}

console.log("3. the app's own panel count");
const panelCount = await readPanelCount();
await closeOpenNotes();
evidence.panelCount = panelCount;
record("panel count read off the app", { panelCount }, (d) => typeof d.panelCount === "number" && d.panelCount > 0);

console.log("4. canvas census (the audit's evidence)");
const census = await canvasCensus();
record(
  "canvases in the live DOM while in plan view",
  { total: census.length, offScreen: census.filter((c) => c.offScreen).length, canvases: census },
  observationOnly("the audit is read from this, not asserted — the expected shape differs before and after the fix"),
);
const domNodes = await evaluate(`document.getElementsByTagName('*').length`);
record("live DOM node count", { domNodes }, observationOnly("cross-checks the profiler agent's 240-248 figure"));

console.log(`5. IDLE measurement, pass 1 (${IDLE_MS}ms, plan view, no input)`);
const idle1 = await measureIdle("idle-pass-1");
record("idle pass 1", idle1, observationOnly("first pass of the session — see the header note on cold SwiftShader"));

console.log(`6. IDLE measurement, pass 2 (${IDLE_MS}ms, plan view, no input)`);
const idle2 = await measureIdle("idle-pass-2");
record("idle pass 2 (the one to believe)", idle2, observationOnly("the reportable idle figure"));

console.log("7. summary PNG, before a design change");
await closeOpenNotes();
const pngBefore = await readSummaryPng();
await shot("summary-before-change");
await closeOpenNotes();
record(
  "a summary PNG exists at all",
  { bytes: pngBefore ? pngBefore.length : 0, sha256_16: sha(pngBefore) },
  (d) => d.bytes > 5000,
);

// The currency check has to be a change the RENDER can show, not just one
// the totals can. A wall-height change moves every panel in the scene, so a
// byte-identical PNG across it cannot be explained away as "the camera
// happened to hide it". The target is derived from whatever height this run
// configured, so the knob above and this step cannot collide on the same
// value and make the check vacuous.
const CHANGE_TO_FT = Number(process.env.FRAMELOOP_WALL_HEIGHT_FT || "10") + 6;
console.log(`8. a real design change: wall height -> ${CHANGE_TO_FT}ft`);
const committedHeight = await setWallHeightFt(CHANGE_TO_FT);
record(
  "the wall-height change actually committed",
  { committedHeight, targetFt: CHANGE_TO_FT },
  (d) => String(d.committedHeight ?? "").startsWith(`${d.targetFt}'`),
);
await sleep(1200);

console.log("9. summary PNG, after the design change");
const pngAfter = await readSummaryPng();
await shot("summary-after-change");
record(
  "the summary PNG reflects the CURRENT design (byte-different after a 10ft->16ft wall-height change)",
  {
    beforeBytes: pngBefore ? pngBefore.length : 0,
    afterBytes: pngAfter ? pngAfter.length : 0,
    beforeSha: sha(pngBefore),
    afterSha: sha(pngAfter),
    identical: pngBefore === pngAfter,
  },
  (d) => d.afterBytes > 5000 && d.identical === false,
);
await closeOpenNotes();

console.log("10. IDLE measurement after the edit — the loop must not have restarted");
const idle3 = await measureIdle("idle-after-edit");
record("idle after a design change and a capture", idle3, observationOnly("proves the fix does not leave the loop running once re-armed"));

record("no uncaught page exception", { pageExceptions }, (d) => d.pageExceptions.length === 0);

console.log(`\n${failures.length === 0 ? "ALL EXPECTATIONS PASSED" : `${failures.length} FAILURE(S): ${failures.join(", ")}`}`);
writeEvidence();
if (failures.length > 0) process.exit(1);
process.exit(0);
