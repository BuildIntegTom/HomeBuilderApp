/**
 * Browser harness — Top Bar & Navigation Reorganisation, U1 REBUILT
 * (the bare bar Tommy re-drew on 2026-09-28, and THE MEASUREMENT).
 *
 * ## What this file is for now
 *
 * U1 measured a bar that no longer exists. Tommy read its numbers and changed
 * the design twice on 2026-09-28: `Design` and `View` became **bare words**,
 * the **view dial was removed entirely**, the **wordmark was dropped**, and in
 * the interview that followed **the four `Wall / Foundation / Floor / Roof`
 * tab items left the bar** and became groups inside the Design menu. This file
 * measures THAT bar, and it measures the alternative he did not choose, because
 * the cost of the choice is the evidence for it.
 *
 * **The measurement is the deliverable, not a check on it.** The earlier pass
 * published ~104px each for Account, Projects and Settings — a figure derived
 * by subtracting measured parts from a measured total, i.e. inference, and one
 * that left only ~17px of margin at 1280px. **Every control is now measured
 * individually and its real width is published**, at every width, in every
 * role, with four companies simulated.
 *
 * ## The two bar configurations it measures
 *
 *   built     the bar as it ships: Design and View bare, the Summary and Print
 *             placeholders, no wordmark, no tab items, no tab dial. **Option B.**
 *   optionA   that bar PLUS the four tab items, projected — the structure Tommy
 *             did not choose — **shedding below 1200px exactly as the real nav
 *             did**. Its cost is what "folding the tabs into Design frees
 *             ~264px" actually means, measured rather than asserted.
 *
 * ⚠ **`Summary` and `Print` are no longer projected: they are real, disabled
 * placeholders** on Tommy's decision of 2026-09-29, so every "built" figure
 * includes them. The same bar before they arrived is checked in as
 * `evidence-seven-control-bar.json`, and the difference between the two files
 * is what they cost.
 *
 * ⚠ **AND OPTION A USED TO BE MEASURED UNFAIRLY.** It injected the four tab
 * items at every width, but the real nav only ever rendered at >=1200px, so its
 * narrow-end figures described a bar that never existed — and they flattered
 * the decision already taken. Gated now; its true cost is wide-end only.
 *
 * ⚠ **THE PROJECTED TAB ITEMS CARRY THEIR OWN DECLARATIONS, AND THAT IS SAID
 * OUT LOUD.** Everything else projected here is built from a class read out of
 * the live stylesheet. The nav-tab rule was deleted along with the tabs, so
 * there is no live class to read; the projection uses the exact declarations
 * the deleted `.navTab` rule carried (14px / 400 / 20px, `padding: 0 12px`,
 * transparent 2px top and bottom borders, no side borders, transparent
 * background), quoted from the commit that removed them. A figure built on
 * remembered CSS is weaker than one built on live CSS, and the difference is
 * recorded in the evidence rather than glossed.
 *
 * ## The supported range, and why it is a range
 *
 * Tommy, 2026-09-28: *"If someone is using this on their phone they should be
 * able to turn it sideways and have a longer top bar… I expect most of the work
 * to be done on a computer screen, not a phone."* So this file does not force
 * 360px. It measures 360 / 710 / 768 / 1200 / 1280 / 1366 / 1440 / 1600 and
 * publishes what each does — in particular **every width at which the acting-as
 * company name renders NO characters**, which is the one documented safety
 * property this design spends. Tommy's own 710px is in the list and is not
 * optional.
 *
 * ## HOW TO RUN (from the repo root)
 *   1. `npm run dev --workspace=apps/web -- -p 3218`
 *   2. `chrome --headless=new --remote-debugging-port=9458 --user-data-dir=<temp> --window-size=1600,1000 about:blank`
 *   3. `node apps/web/harness/ui-reorg-u1/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`** — over 127.0.0.1 the dynamic-import
 * chunks never arrive and the Konva canvas silently never appears (the
 * Stage 0/1 harness's note, and it costs an hour every time it is rediscovered).
 *
 * `record()` REFUSES to run without an expectation, and the process exits
 * non-zero if any expectation is false. **Both outcomes are measured:**
 * `UI_REORG_U1_PROVE_FAILURE=1` appends one deliberately false check and the
 * run must then exit 1. A harness nobody has seen fail is not evidence.
 *
 * ## ⚠ Five scars this file is written around
 *
 * 1. **No incidental locators.** Every control is found by `data-bar-control`,
 *    every menu entry by `data-view-stop` / `data-design-subject`, Region 3 by
 *    `data-sidebar-region-3`. Three locators in this repo once rooted on
 *    panel-boundary drag strips and returned nothing on a wall with no adjacent
 *    standard panels — reporting green.
 * 2. **No vacuous passes.** Every reader that can return an empty set asserts
 *    it found something first. The four-company simulation is validated against
 *    a figure a real browser produced on 2026-09-13 before a single width is
 *    judged by it.
 * 3. **Read your own reader.** Widths come from `clientWidth`-based content
 *    boxes, not from bounding rects minus padding: U0's first reader reported
 *    56px of usable rail where the truth was ~40px.
 * 4. **Measure the NAME, not the box around it.** U1's own "nothing is pushed
 *    off screen" was true of a 16px select showing zero characters under a
 *    caption still reading ACTING AS. The select's own width and its visible
 *    character count are recorded at every cell.
 * 5. **A run that records nothing never overwrites a run that did.** An exit
 *    handler once wrote a two-line evidence file over a committed 5,700-line
 *    measurement.
 *
 * ## The evidence files
 *
 *   evidence.json                  this bar — the one that ships.
 *   evidence-u1-labelled-bar.json  ⚠ KEPT, NOT REGENERATED. U1's built bar:
 *                                  labelled Design/View, the dial, the wordmark
 *                                  and the four tab items. It is the "before"
 *                                  for everything here, and the only recording
 *                                  of a bar that no longer exists.
 *   evidence-u1-as-built.json      U1's first shipped form, where the company
 *                                  name assertion FAILS at 1200px — the kept
 *                                  failing "before" for the shed-order fix.
 *   evidence-projection.json       the pre-U1 bar with four controls projected.
 *   region3-baseline.json          ⚠ RETIRED AT U3 (2026-09-29) and no longer
 *                                  read by this script. Region 3's signature
 *                                  at every stop, recorded off the DIAL before
 *                                  any of this. Kept because it cannot be
 *                                  re-made; never to be regenerated.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.UI_REORG_U1_APP_URL ?? "http://localhost:3218/";
const CDP_PORT = process.env.UI_REORG_U1_CDP_PORT ?? "9458";
const PASS = process.env.UI_REORG_U1_PASS === "projection" ? "projection" : "built";
const PROVE_FAILURE = process.env.UI_REORG_U1_PROVE_FAILURE === "1";

const EVIDENCE_FILE = path.join(HERE, PASS === "projection" ? "evidence-projection.json" : "evidence.json");
/* ⚠ `region3-baseline.json` HAS NO CONSTANT HERE ANY MORE. It was RETIRED at
   U3 by a decision taken in advance (see step 10's note, this file's README and
   the spec) — the file is kept as an unrepeatable recording, and nothing reads
   it. If a later stage finds itself adding this path back, read that note
   first: regenerating it off the menus makes a self-comparison that passes by
   construction. */

/**
 * The widths this bar is judged at.
 *
 * 360 is phone portrait and is measured rather than promised — Tommy, 2026-09-28:
 * a phone is for showing people how things work, and "most of the work is going
 * to be done on a bigger screen". 710 is HIS OWN everyday viewport and is not
 * optional. 1200 is the one remaining breakpoint the bar's neighbours still use
 * (the company name's cap, and the sidebar tab dial). 1280 and 1366 are the two
 * common laptop widths the earlier pass left the view control absent at, and
 * 1280 is the width the inferred ~104px controls said had only ~17px of margin.
 */
const WIDTHS = [360, 710, 768, 1200, 1280, 1366, 1440, 1600];
/** `roleDisclaimers` order, as `roleOptions` exports it. */
const ROLE_LABELS = ["Public", "Fabricator", "Admin", "Engineer"];

/**
 * Four REAL entitlements' worth of `switcherLabels` output. Not invented
 * names: `Building Integrity`, `The Seed Collaborative` and `Rare Forms` are
 * the three this repo's own `switcherLabels.test.ts` uses, and the tags are
 * `entitlementTag`'s four strings. `The Seed Collaborative (platform admin)`
 * is the longest real label and is the one the 2026-09-13 measurement pinned
 * at 270px rendered — which is what validates this simulation below.
 */
const FOUR_COMPANY_LABELS = [
  "Building Integrity",
  "The Seed Collaborative (platform admin)",
  "Rare Forms (consortium)",
  "Building Integrity (company admin)",
];
/** The one the simulation selects, so the widest case is the measured case. */
const LONGEST_COMPANY_LABEL = "The Seed Collaborative (platform admin)";
/** Measured in headless Chrome on 2026-09-13 at >=1200px, 13px/600 Geist,
 * including the select's arrow. Recorded in AccountControl.module.css. */
const RECORDED_LONGEST_LABEL_PX = 270;

/**
 * The shipped bar's natural row content BEFORE the Summary and Print
 * placeholders were added — seven controls, measured by this same harness at
 * 1600px with four companies and the widest role label on 2026-09-28, and
 * checked in as `evidence-seven-control-bar.json`.
 *
 * Quoted rather than recomputed, because that bar cannot be measured again
 * without deleting two controls Tommy asked for. It is the base of the
 * published "what Summary and Print cost" figure, and if it is ever doubted the
 * file it came from is right there.
 */
const SEVEN_CONTROL_BAR_NATURAL_PX = 922.5;

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = {
  app: APP_URL,
  pass: PASS,
  ranAt: new Date().toISOString(),
  proveFailureMode: PROVE_FAILURE,
  steps: [],
};
const failures = [];
const pageExceptions = [];

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
  console.log(`  [${isObservation ? "observed" : passed ? "PASS" : "FAIL"}] ${name}: ${JSON.stringify(detail).slice(0, 320)}`);
};

let evidenceWritten = false;
const writeEvidence = () => {
  if (evidenceWritten) return;
  /**
   * ⚠ A RUN THAT RECORDED NOTHING NEVER OVERWRITES THE LAST ONE THAT DID, and
   * this cost a good artefact before it was added. `writeEvidence` is on
   * `process.on("exit")` so that a crash mid-run still leaves its partial
   * measurements behind — which is right. But the projection pass's own guard
   * (below) throws during setup, before a single `record()`, and that exit
   * handler dutifully wrote a two-line `evidence-projection.json` over a
   * 5,700-line measurement that had already been committed. An empty evidence
   * file is never worth having and is always worth less than what it replaced.
   */
  if (evidence.steps.length === 0) {
    console.log("\nno steps were recorded — leaving the existing evidence file alone");
    evidenceWritten = true;
    return;
  }
  /**
   * ⚠ AND A PROVE-FAILURE RUN NEVER OVERWRITES A REAL ONE EITHER.
   *
   * The guard above only catches a run that recorded NOTHING.
   * `UI_REORG_U1_PROVE_FAILURE=1` records everything and then appends one
   * deliberately false check, so it wrote a deliberately-failing evidence.json
   * over a passing one — marked `proveFailureMode: true`, which is honest but
   * is a flag a reader has to notice, and the checked-in artefact is what
   * people read. The run exists to prove the harness CAN fail, not to produce
   * evidence, so it now produces none.
   */
  if (PROVE_FAILURE) {
    evidenceWritten = true;
    console.log(
      "\nprove-failure mode: NOT writing evidence — this run exists to show the harness can fail, " +
        "and its artefact would be a failing record of a passing bar",
    );
    return;
  }
  evidenceWritten = true;
  evidence.pageExceptions = pageExceptions;
  evidence.failures = failures;
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2));
  console.log(`\nevidence -> ${path.basename(EVIDENCE_FILE)}`);
};
process.on("exit", writeEvidence);

// --- CDP plumbing (the Smearforn / U0 harnesses') ---------------------------
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

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 200));
  return res.result.result?.value;
};

const shot = async (name) => {
  const png = await send("Page.captureScreenshot", { format: "png" }, sid);
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(png.result.data, "base64"));
};

const mouse = (type, x, y, extra = {}) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: 1, ...extra }, sid);

const click = async (x, y) => {
  await mouse("mousePressed", x, y);
  await sleep(60);
  await mouse("mouseReleased", x, y);
  await sleep(380);
};

/** CSS viewport width, so the real media queries are in play rather than
 * simulated by reading the stylesheet. Fractional widths are allowed and are
 * the point of the browser-zoom case. */
const setViewport = async (width, height = 900) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sid);
  await sleep(420);
};

const clickSelector = async (selector, what) => {
  const at = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`nothing clickable for ${what} (${selector})`);
  await click(at.x, at.y);
};

/**
 * Click, then check the page really did what the click was for — and try again
 * if it did not.
 *
 * ⚠ WHY: the first click after a cold load can land before React has attached
 * its handlers. The element is there, laid out and enabled, the mouse events
 * are dispatched at its own coordinates, and nothing happens. Seen on
 * 2026-09-28 in three harnesses on the same afternoon, always on the first
 * interaction of a run and never on a re-run.
 *
 * **Three attempts, and it says how many it spent.** A silent retry loop would
 * hide a control that genuinely stopped working, which is worse than the flake
 * it fixes — the same reason the shared view-stop driver's `openMenu` budget is
 * bounded and reported.
 */
const clickSelectorUntil = async (selector, what, readyExpression) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await clickSelector(selector, what);
    await sleep(attempt === 1 ? 200 : 600);
    if (await evaluate(readyExpression)) return attempt;
  }
  throw new Error(
    `clicked ${what} three times and ${readyExpression} never became true — the control is present and clickable, so is something overlaying it, or did the page not finish hydrating?`,
  );
};

// --- the page-side toolkit --------------------------------------------------
//
// Installed once per page load. Everything below that reads or manipulates the
// bar goes through it, so the locator rules live in one place rather than in
// thirty template strings.
const TOOLKIT = String.raw`
(() => {
  const K = (window.__u1 = window.__u1 || {});

  /**
   * A CSS-module class name, found by the STEM the source file uses.
   *
   * Turbopack emits '<File>-module__<hash>__<stem>'. The hash is a build
   * artefact and must never be written down here; the stem is the source
   * file's own word and is stable across builds.
   *
   * ⚠ The preferred route is 'sibling': take the hashed prefix off an
   * element that really IS in the DOM and swap the stem onto it. That is how
   * '.actingAsSelect' is found while signed out — the class exists in the
   * stylesheet but the element does not, and the chip around it carries the
   * same prefix. The stylesheet scan is the fallback, and it is anchored at
   * BOTH ends: without the trailing boundary, asking for 'tool' can return
   * 'toolActive', and every projected control would then be measured in the
   * wrong style while the run reported green.
   */
  K.moduleClass = (stem, sibling) => {
    if (sibling) {
      const el = document.querySelector(sibling);
      if (el) {
        for (const cls of el.classList) {
          const m = cls.match(/^([A-Za-z0-9_-]+-module__[A-Za-z0-9_-]+?__)[A-Za-z0-9_-]+$/);
          if (m) return m[1] + stem;
        }
      }
    }
    const re = new RegExp('\\.([A-Za-z0-9_-]+-module__[A-Za-z0-9_-]+?__' + stem + ')(?![A-Za-z0-9_-])');
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) { const hit = walk(rule.cssRules); if (hit) return hit; }
          const m = rule.selectorText && rule.selectorText.match(re);
          if (m) return m[1];
        }
        return null;
      };
      const hit = walk(rules);
      if (hit) return hit;
    }
    return null;
  };

  K.rect = (el) => {
    const r = el.getBoundingClientRect();
    const round = (n) => Math.round(n * 10) / 10;
    return { left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), w: round(r.width), h: round(r.height) };
  };

  /** Every control on the bar, named, in document order. Includes the
   * projected ones while a projection is installed — they carry the same
   * attribute, and each row says whether it is real or projected. */
  K.controls = () => {
    const row = document.querySelector('[data-top-bar-row]');
    if (!row) return null;
    return [...row.querySelectorAll('[data-bar-control]')].map((el) => ({
      control: el.getAttribute('data-bar-control'),
      projected: el.hasAttribute('data-bar-control-projected'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      zone: el.closest('[data-top-bar-zone]')?.getAttribute('data-top-bar-zone') ?? null,
      ...K.rect(el),
    }));
  };

  /**
   * THE COMPANY NAME ITSELF — not the chip around it.
   *
   * ⚠ WHY THIS EXISTS, AND WHAT IT IS FIXING. Until 2026-09-28 the only
   * reading taken of the acting-as control was the CHIP's bounding box:
   * 'actingAsWidth', and an 'actingAsOnScreen' that asks whether that box is
   * inside the viewport. Both are true of a chip that is 100.8px wide
   * containing a 16.1px select showing ZERO characters of the company name —
   * a caption reading 'ACTING AS' followed by nothing but a caret. That is
   * the 2026-09-13 failure in its second form, and the chip's bounding box
   * cannot see it: the box is on screen, fully, while the value it exists to
   * carry is gone.
   *
   * So the name is measured on its own terms: the select's (or, signed out,
   * the static span's) own width, and how many characters of the label
   * actually render.
   *
   * HOW THE CHARACTER COUNT IS DERIVED, since a <select> will not tell you.
   * A hidden clone of the element with 'max-width: none' gives the element's
   * NATURAL width — the whole label, the padding, the border and the select's
   * own dropdown arrow. Subtracting the canvas-measured width of the full
   * label string from that clone gives this element's fixed overhead, which
   * is calibrated per reading rather than assumed. The text room available at
   * the element's real width is then its width minus that overhead, and the
   * visible count is the longest prefix of the label that fits in it, less
   * the ellipsis when one is being drawn.
   *
   * The clone is measured in the element's own parent so it inherits the same
   * computed font; anything else would be measuring a different typeface and
   * reporting it as this one.
   *
   * ⚠ ITS ACCURACY, CHECKED AGAINST PICTURES RATHER THAN ASSERTED. The count
   * was validated on 2026-09-28 by constraining this very select to a series
   * of widths at 1600px and screenshotting the chip at each:
   *     16.0px -> renders 'ACTING AS' and nothing at all   computed 0  ✓
   *     22.5px -> a clipped ellipsis dot, no character     computed 0  ✓
   *     38.4px -> renders 'T…'                             computed 0  (−1)
   *     39.1px -> renders 'T…'                             computed 0  (−1)
   *     50.0px -> renders 'Th…'                            computed 2  ✓
   *    270.0px -> the whole label                          computed 39 ✓
   * So it is exact except in the last character before the name disappears,
   * where Chrome CLIPS the ellipsis instead of reserving room for it and this
   * model reserves the whole thing. It therefore errs by at most one
   * character and always DOWNWARD — which is the safe direction for the
   * assertion built on it, since a conservative count can only complain
   * earlier, never later. Anything published from it that turns on a single
   * character should quote the screenshot, not this number.
   */
  K.actingAsName = () => {
    const chip = document.querySelector('[data-bar-control="acting-as"]');
    if (!chip) return null;
    // The select when signed in (real or simulated); the static span when
    // signed out. Both are "the company name" and both can be crushed.
    const el = chip.querySelector('select') || chip.querySelector('span:not([id])');
    if (!el) return null;
    const round = (n) => Math.round(n * 10) / 10;
    const label = (el.tagName === 'SELECT'
      ? (el.selectedOptions[0]?.textContent ?? '')
      : (el.textContent ?? '')).replace(/\s+/g, ' ').trim();
    const cs = getComputedStyle(el);

    const canvas = (K._canvas = K._canvas || document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const textPx = ctx.measureText(label).width;
    const ellipsisPx = ctx.measureText('…').width;

    // The natural width, measured rather than assumed.
    const clone = el.cloneNode(true);
    clone.style.maxWidth = 'none';
    clone.style.minWidth = '0';
    clone.style.width = 'auto';
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.visibility = 'hidden';
    el.parentNode.appendChild(clone);
    const naturalPx = clone.getBoundingClientRect().width;
    clone.remove();

    const widthPx = el.getBoundingClientRect().width;
    // Padding + border + the select's arrow. Never negative: a font the
    // canvas measures slightly wider than the element lays out would
    // otherwise credit the name with room it does not have.
    const overheadPx = Math.max(0, naturalPx - textPx);
    const truncated = widthPx < naturalPx - 0.5;
    let roomPx = widthPx - overheadPx;
    if (truncated) roomPx -= ellipsisPx;

    let visibleChars = 0;
    if (roomPx > 0) {
      for (let i = 1; i <= label.length; i += 1) {
        if (ctx.measureText(label.slice(0, i)).width <= roomPx) visibleChars = i;
        else break;
      }
    }
    if (!truncated) visibleChars = label.length;

    return {
      element: el.tagName.toLowerCase(),
      label,
      labelChars: label.length,
      widthPx: round(widthPx),
      naturalPx: round(naturalPx),
      textPx: round(textPx),
      overheadPx: round(overheadPx),
      roomForTextPx: round(Math.max(0, roomPx)),
      truncated,
      visibleChars,
      visibleText: label.slice(0, visibleChars),
      // The whole point: is ANY of the company name on screen?
      anyNameVisible: visibleChars > 0,
      // The cap its own stylesheet gives it at this width, for the record.
      capPx: window.innerWidth >= 1200 ? 280 : 220,
    };
  };

  /**
   * Does the row fit?
   *
   * ⚠ READ YOUR OWN READER. The content box is clientWidth-based, never the
   * bounding rect minus padding: U0 measured a 64px rail as 56px of usable
   * width that way and made a genuinely overflowing icon look contained.
   * Overflow is reported three ways because they fail differently: scrollWidth
   * (the row wants more than it has), the rightmost control's right edge vs
   * the viewport (a control pushed off, which is the 2026-09-13 bug), and the
   * document's own horizontal scroll (the whole page giving way).
   */
  K.fit = () => {
    const bar = document.querySelector('[data-top-bar]');
    const row = document.querySelector('[data-top-bar-row]');
    const controls = K.controls() || [];
    const cs = getComputedStyle(row);
    const rowContent = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const barCs = getComputedStyle(bar);
    const barContent = bar.clientWidth - parseFloat(barCs.paddingLeft) - parseFloat(barCs.paddingRight);
    const actingAs = controls.find((c) => c.control === 'acting-as');
    const rightmost = controls.reduce((a, c) => (a && a.right >= c.right ? a : c), null);
    return {
      viewport: window.innerWidth,
      barContentWidth: Math.round(barContent * 10) / 10,
      rowContentWidth: Math.round(rowContent * 10) / 10,
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      rowOverflowPx: Math.max(0, row.scrollWidth - row.clientWidth),
      barOverflowPx: Math.max(0, bar.scrollWidth - bar.clientWidth),
      docOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      barHeight: Math.round(bar.getBoundingClientRect().height * 10) / 10,
      controlCount: controls.length,
      controlsWidthSum: Math.round(controls.filter((c) => c.zone).reduce((s, c) => s + c.w, 0) * 10) / 10,
      /* ⚠ EVERY CONTROL'S OWN WIDTH, PUBLISHED. The previous pass derived
         ~104px each for Account, Projects and Settings by subtracting measured
         parts from a measured total — inference, presented beside real
         measurements, and it is what left 1280px looking like it had ~17px of
         margin. These are read one control at a time from the real layout. */
      controlWidths: Object.fromEntries(controls.filter((c) => c.w > 0).map((c) => [c.control, c.w])),
      rightmostControl: rightmost ? rightmost.control : null,
      rightmostRight: rightmost ? rightmost.right : null,
      anyControlOffScreen: controls.filter((c) => c.w > 0 && (c.left < -0.5 || c.right > window.innerWidth + 0.5)).map((c) => c.control),
      // ⚠ THE CHIP'S BOUNDING BOX, AND IT IS NOT ENOUGH ON ITS OWN. This is
      // true of a chip showing 'ACTING AS' and nothing else; see
      // 'actingAsName' below, which is the reading that can see that.
      actingAsOnScreen: actingAs ? actingAs.left >= -0.5 && actingAs.right <= window.innerWidth + 0.5 : false,
      actingAsWidth: actingAs ? actingAs.w : null,
      actingAsText: actingAs ? actingAs.text : null,
      actingAsName: K.actingAsName(),
      present: controls.filter((c) => c.w > 0).map((c) => c.control),
      absent: ['wordmark', 'nav-wall', 'nav-foundation', 'nav-floor', 'nav-roof']
        .filter((n) => !controls.some((c) => c.control === n && c.w > 0)),
    };
  };

  // --- the four-company simulation -----------------------------------------
  //
  // SIMULATED, and every cell it touches is labelled accountState:
  // "four-companies-simulated". Signing in needs Supabase and nothing in this
  // workstream may touch it. What is faked is exactly one thing: the element
  // the acting-as chip renders when signed out (a static span) becomes the
  // element it renders when signed in with four entitlements (a real select,
  // with the app's own class, its own aria-labelledby, and switcherLabels'
  // real output). Nothing else about the page changes.
  K.simulateCompanies = (labels, selected) => {
    const chip = document.querySelector('[data-bar-control="acting-as"]');
    if (!chip) return { ok: false, why: 'no acting-as chip' };
    if (K._simulation) K.clearCompanies();
    const cls = K.moduleClass('actingAsSelect', '[data-bar-control="acting-as"]');
    if (!cls) return { ok: false, why: 'could not find the actingAsSelect class in any stylesheet' };
    const span = chip.querySelector('span:not([id])');
    if (!span) return { ok: false, why: 'no static span to replace' };
    const select = document.createElement('select');
    select.className = cls;
    select.setAttribute('aria-labelledby', 'acting-as-label');
    select.setAttribute('data-simulated-companies', String(labels.length));
    select.title = selected;
    for (const label of labels) {
      const opt = document.createElement('option');
      opt.textContent = label;
      opt.value = label;
      select.appendChild(opt);
    }
    select.value = selected;
    chip.replaceChild(select, span);
    K._simulation = { chip, span, select, usedClass: cls };
    return { ok: true, usedClass: cls, width: Math.round(select.getBoundingClientRect().width * 10) / 10 };
  };

  K.clearCompanies = () => {
    if (!K._simulation) return false;
    const { chip, span, select } = K._simulation;
    chip.replaceChild(span, select);
    K._simulation = null;
    return true;
  };

  // --- the projection ------------------------------------------------------
  //
  // The four controls Tommy's list adds, built out of the bar's OWN classes
  // and inserted into the REAL row, so what is measured is the real layout
  // under the real media queries rather than arithmetic on remembered widths.
  // Anything already present for real is skipped, so the same code measures a
  // fully-projected bar (pass "projection") and a half-built one (pass
  // "built", where Design and View are real and Summary/Print are not).
  //
  // Summary and Print are NOT built for real in U1: they are U4 and U5, and
  // the Top Bar section forbids a control that opens nothing. Projecting them
  // is how the TWELVE-item question gets answered anyway.
  K.project = (spec) => {
    if (K._projection) K.clearProjection();
    const row = document.querySelector('[data-top-bar-row]');
    const zoneLeft = row.querySelector('[data-top-bar-zone="left"]');
    const toolCls = K.moduleClass('tool', '[data-bar-control="project"]');
    const captionCls = K.moduleClass('viewMenuCaption');
    const valueCls = K.moduleClass('viewMenuValue');
    if (!toolCls) return { ok: false, why: 'could not find the .tool class' };
    const made = [];
    for (const item of spec) {
      if (row.querySelector('[data-bar-control="' + item.control + '"]')) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = toolCls;
      btn.setAttribute('data-bar-control', item.control);
      btn.setAttribute('data-bar-control-projected', '');
      if (item.style === 'navTab') {
        /* ⚠ THE ONE PROJECTION NOT BUILT FROM A LIVE CLASS, and it says so in
           the evidence ('projectedFromDeletedCss'). The .navTab rule was deleted
           with the tabs it styled, so there is nothing live to read; these are
           the declarations that rule carried, quoted from the commit that
           removed it. Measuring option A at all requires it, and a remembered
           declaration is weaker evidence than a live one. */
        btn.className = '';
        btn.style.cssText =
          'display:flex;align-items:center;height:100%;padding:0 12px;font-size:14px;font-weight:400;line-height:20px;' +
          'background:transparent;border:none;border-top:2px solid transparent;border-bottom:2px solid transparent;' +
          'white-space:nowrap;cursor:pointer;flex-shrink:0;';
      }
      if (item.caption && item.value) {
        const cap = document.createElement('span');
        cap.textContent = item.caption;
        // The projection uses the real classes when they exist (pass "built")
        // and the SPEC'D declarations when they do not (pass "projection"):
        // 11px/600/uppercase/0.01em muted, and 13px/600 on-surface, read off
        // AccountControl.module.css's .actingAsLabel and .actingAsSelect.
        if (captionCls) cap.className = captionCls;
        else cap.style.cssText = 'font-size:11px;font-weight:600;letter-spacing:0.01em;text-transform:uppercase;';
        const val = document.createElement('span');
        val.textContent = ' ' + item.value;
        if (valueCls) val.className = valueCls;
        else val.style.cssText = 'font-size:13px;font-weight:600;';
        btn.appendChild(cap);
        btn.appendChild(val);
      } else {
        btn.textContent = item.label;
      }
      zoneLeft.appendChild(btn);
      made.push(item.control);
    }
    K._projection = made;
    return {
      ok: true,
      projected: made,
      usedToolClass: toolCls,
      usedRealLabelClasses: Boolean(captionCls && valueCls),
      projectedFromDeletedCss: spec.filter((s) => s.style === 'navTab').map((s) => s.control),
    };
  };

  K.clearProjection = () => {
    const row = document.querySelector('[data-top-bar-row]');
    for (const el of row.querySelectorAll('[data-bar-control-projected]')) el.remove();
    K._projection = null;
  };

  // --- the view stops ------------------------------------------------------

/**
   * What Tommy removed, checked for by its own locators rather than by
   * assuming.
   *
   * A removal is only real if nothing renders it at ANY width, and every one of
   * these has a width-keyed history: the dial was the below-breakpoint form for
   * about a day, the nav tabs were a >=1200px form for a fortnight, and the
   * wordmark for longer. A run that only looked at 1600 would have called all
   * three gone while two of them were alive at 710.
   *
   * 'sidebarViewDial' looks for the dial ANYWHERE in the document, not only in
   * the sidebar, so a copy left behind somewhere else would still be found.
   */
  K.removedControls = () => {
    const laidOut = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const navZone = document.querySelector('[data-top-bar-zone="middle"]');
    return {
      sidebarViewDial: Boolean(document.querySelector('[role="group"][aria-label="View mode"]')),
      sidebarViewDialLaidOut: laidOut(document.querySelector('[role="group"][aria-label="View mode"]')),
      editorNav: Boolean(document.querySelector('nav[aria-label="Editor"]')),
      barNavZone: Boolean(navZone),
      barTabButtons: [...document.querySelectorAll('[data-bar-control^="nav-"]')].map((e) => e.getAttribute('data-bar-control')),
      wordmark: Boolean(document.querySelector('[data-bar-control="wordmark"]')),
      /* The LABEL+Value treatment is meant to be unique to the acting-as chip
         now. If either of these reappears on a view menu the bare-word decision
         has quietly been undone. */
      viewMenuCaptions: document.querySelectorAll('[data-view-menu-caption]').length,
      viewMenuValues: document.querySelectorAll('[data-view-menu-value]').length,
    };
  };

  /**
   * The editor tab dial that used to live in sidebar Region 2 — REMOVED
   * 2026-09-29 on Tommy's decision ("Remove it — Design is the only door"), so
   * this now checks it is gone rather than measuring it.
   *
   * ⚠ IT IS FOUND BY ITS OWN REAL LOCATORS, and the first version of this
   * reader had them WRONG: it looked for '[aria-label="Editor tab"]', which the
   * dial never had, so it reported found:false at every width while the control
   * was alive on screen. The dial's actual markers were
   * 'role="group" aria-label="Editor"' and a title beginning "Scroll or use the
   * arrows to switch between Wall". Both are checked, plus the toolbar box that
   * wrapped it — a locator that cannot see the thing it is asserting the
   * absence of is the vacuous pass this whole file is written against.
   */
  K.editorTabDial = () => {
    const byRole = document.querySelector('[role="group"][aria-label="Editor"]');
    const byTitle = [...document.querySelectorAll('[title]')].find((e) =>
      (e.getAttribute('title') || '').startsWith('Scroll or use the arrows to switch between Wall'),
    );
    const el = byRole ?? byTitle ?? null;
    return {
      found: Boolean(el),
      foundByRole: Boolean(byRole),
      foundByTitle: Boolean(byTitle),
      laidOut: el ? el.getBoundingClientRect().width > 0 : false,
    };
  };

  /**
   * Summary and Print, read as they render.
   *
   * ⚠ THEY WERE data-bar-placeholder UNTIL U4/U5 (2026-10-11), and the
   * selector change is the point. The attribute existed to mark two buttons
   * that opened nothing — a deliberate, recorded one-case break of the Top Bar
   * rule. U4 and U5 built the pages behind them, so the attribute is gone and
   * the exception expired by being satisfied. This reads them by their
   * data-bar-control instead, which is what they have always had, and the
   * check below asserts the OPPOSITE of what it used to.
   *
   * ⚠ NO BACKTICKS IN HERE. This whole toolkit is injected into the page as a
   * template literal, so a backtick in a comment ends the literal and the
   * harness dies with a SyntaxError 500 lines away from the cause. It did.
   */
  K.placeholders = () =>
    [...document.querySelectorAll('[data-bar-control="summary"], [data-bar-control="print"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        control: el.getAttribute('data-bar-control'),
        label: el.textContent.replace(/\s+/g, ' ').trim(),
        disabled: el.disabled === true,
        title: el.getAttribute('title') || '',
        opensAMenu: el.hasAttribute('aria-expanded'),
        isAViewMenu: el.hasAttribute('data-view-menu'),
        w: Math.round(r.width * 10) / 10,
        onScreen: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
      };
    });

  /** The two bar menus, when they exist: which one owns, and what each reads. */
  K.viewMenus = () => {
    const out = {};
    for (const id of ['design', 'view']) {
      const btn = document.querySelector('[data-view-menu="' + id + '"]');
      if (!btn) { out[id] = null; continue; }
      const r = btn.getBoundingClientRect();
      const cs = getComputedStyle(btn);
      out[id] = {
        present: r.width > 0 && r.height > 0,
        owner: btn.getAttribute('data-view-menu-owner') === 'true',
        /* ⚠ LEVEL ONE OF THE HIGHLIGHT, READ AS AN ACCESSIBLE STATE. The owner
           attribute above is the harness's own hook; 'aria-current' is what a
           screen reader is actually told, and the two are asserted to agree so
           the hook cannot drift into being the only true one.

           It was 'aria-pressed' until 2026-09-29. The review's objection is
           recorded in TopBar.tsx and is right: this button also carries
           'aria-expanded' and opens a menu, so announcing it as a pressed
           toggle describes a control this is not. */
        current: btn.getAttribute('aria-current'),
        /* And the sighted half, which must be MORE THAN COLOUR: the inset
           underline. Recorded rather than described. */
        boxShadow: cs.boxShadow,
        color: cs.color,
        borderColor: cs.borderTopColor,
        disabled: btn.disabled === true,
        title: btn.getAttribute('title') || '',
        currentStopAttr: btn.getAttribute('data-view-menu-current-stop'),
        caption: btn.querySelector('[data-view-menu-caption]')?.textContent.trim() ?? null,
        value: btn.querySelector('[data-view-menu-value]')?.textContent.trim() ?? null,
        // ⚠ The bare word gets its own span rather than being read off the
        // button's textContent, which also carries the open/closed caret. A
        // reader that compared textContent to "View" would fail on "View ▼"
        // and read exactly like a rename that never happened.
        word: btn.querySelector('[data-view-menu-word]')?.textContent.trim() ?? null,
        text: btn.textContent.replace(/\s+/g, ' ').trim(),
        w: Math.round(r.width * 10) / 10,
      };
    }
    return out;
  };

  /** The stops an OPEN menu is offering, in its own order. */
  K.openMenuStops = () =>
    [...document.querySelectorAll('[data-view-stop]')].map((el) => ({
      key: el.getAttribute('data-view-stop'),
      label: el.textContent.replace(/\s+/g, ' ').trim(),
      current: el.getAttribute('data-view-stop-current') === 'true',
    }));

  /**
   * EVERYTHING an open menu offers — its subject groups, their headings, and
   * every entry with both halves of its current-state.
   *
   * The two halves are read separately on purpose. 'ariaCurrent' is what a
   * screen reader is told; 'fontWeight' and 'boxShadow' are the sighted cue,
   * and they are recorded so "the highlight is more than colour" can be
   * ASSERTED against a non-current sibling rather than asserted in a comment.
   */
  K.openMenuEntries = () => {
    const note = [...document.querySelectorAll('[data-menu-group]')];
    return note.map((group) => ({
      subject: group.getAttribute('data-menu-group'),
      heading: group.querySelector('[data-menu-group-heading]')?.textContent.trim() ?? null,
      groupRole: group.getAttribute('role'),
      groupLabel: group.getAttribute('aria-label'),
      entries: [...group.querySelectorAll('button')].map((el) => {
        const cs = getComputedStyle(el);
        return {
          kind: el.hasAttribute('data-view-stop') ? 'stop' : 'subject',
          key: el.getAttribute('data-view-stop') ?? el.getAttribute('data-design-subject'),
          label: el.textContent.replace(/\s+/g, ' ').trim(),
          ariaCurrent: el.getAttribute('aria-current'),
          markedAttr: el.getAttribute('data-view-stop-current') === 'true',
          fontWeight: cs.fontWeight,
          boxShadow: cs.boxShadow,
          color: cs.color,
          background: cs.backgroundColor,
        };
      }),
    }));
  };

  /**
   * Region 3's rendered signature.
   *
   * Structure AND text, because either alone misses a real difference: the
   * same words in a different control is a change, and so is the same
   * controls with a different pressed state. Deliberately NOT a screenshot —
   * a pixel diff cannot tell "the split leaked showWraps" from "the canvas
   * re-rendered a frame later".
   */
  K.region3 = () => {
    const root = document.querySelector('[data-sidebar-region-3]');
    if (!root) return null;
    const parts = [];
    const walk = (el, depth) => {
      for (const child of el.children) {
        const tag = child.tagName.toLowerCase();
        const bits = [
          '  '.repeat(depth) + tag,
          child.getAttribute('role') ? 'role=' + child.getAttribute('role') : '',
          child.getAttribute('aria-label') ? 'aria-label=' + child.getAttribute('aria-label') : '',
          child.getAttribute('aria-pressed') ? 'aria-pressed=' + child.getAttribute('aria-pressed') : '',
          child.disabled === true ? 'disabled' : '',
          tag === 'input' ? 'type=' + child.type + ' value=' + child.value + ' checked=' + child.checked : '',
          tag === 'select' ? 'value=' + child.value : '',
        ].filter(Boolean);
        const own = [...child.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join(' ');
        if (own) bits.push('"' + own + '"');
        parts.push(bits.join(' '));
        walk(child, depth + 1);
      }
    };
    walk(root, 0);
    const signature = parts.join('\n');
    return {
      childCount: root.children.length,
      lines: parts.length,
      signature,
      /**
       * The same signature with every run of digits replaced by '#'.
       *
       * ⚠ THIS EXISTS BECAUSE THE FIRST VERSION OF THE CROSS-RUN COMPARISON
       * FAILED, AND IT WAS THE TEST THAT WAS WRONG. Region 3 on an elevation
       * shows the wall's computed weight, and the footprint each run draws
       * comes from a mouse drag across the canvas — so a run-to-run
       * difference of a pixel in where that drag lands is a slightly
       * different building, and "8,147 lb" vs "8,103 lb" is a TRUE reading of
       * two different designs, not a leaked view flag.
       *
       * So the two comparisons take different things, on purpose:
       *   - ACROSS runs (dial baseline vs menus now) compares 'shape', which
       *     is invariant to the footprint but still catches a changed
       *     control, a changed aria-pressed, a section appearing or
       *     disappearing, or any word changing.
       *   - WITHIN one run (dial at 1199 vs menus at 1200, one design)
       *     compares the FULL 'signature', digits and all, because there the
       *     building is identical and any difference at all is the split
       *     having written the flags differently.
       * Neither alone is enough; together they are.
       */
      shape: signature.replace(/\d+/g, '#'),
    };
  };

  return true;
})()
`;

const installToolkit = async () => {
  const ok = await evaluate(TOOLKIT);
  if (ok !== true) throw new Error("the page-side toolkit did not install");
};

const load = async (url = APP_URL) => {
  await send("Page.navigate", { url }, sid);
  await sleep(9000);
  await installToolkit();
};

// --- the run ----------------------------------------------------------------
console.log(`U1-rebuilt harness — pass "${PASS}"`);
console.log("0. cold load at 1600px");
await setViewport(1600, 1000);
await load();

/**
 * ⚠ THE PROJECTION PASS IS A ONE-TIME RECORDING OF A BAR THAT NO LONGER
 * EXISTS, and it refuses to run against the built code rather than quietly
 * producing a worse version of its own artefact. Its artefacts
 * (`evidence-projection.json`, `region3-baseline.json`) were recorded against
 * the pre-U1 bar, with the sidebar DIAL driving the stops. The dial is gone, so
 * `region3-baseline.json` can never be re-made: it is the only recording of
 * Region 3 as a control other than these menus produced it, which is half of
 * the single-writer proof.
 */
if (PASS === "projection") {
  const built = await evaluate(`Boolean(document.querySelector('[data-view-menu]'))`);
  if (built) {
    throw new Error(
      "the projection pass is being run against code that ALREADY HAS the Design and View menus. Its artefacts " +
        "(evidence-projection.json, region3-baseline.json) are a recording of the bar BEFORE U1, driven by a dial " +
        "that has since been removed, and they must not be regenerated. Run the built pass instead.",
    );
  }
}

record(
  "the-bar-is-addressable",
  await evaluate(`(() => { const f = window.__u1.fit(); return { controlCount: f.controlCount, present: f.present, barHeight: f.barHeight }; })()`),
  // Everything below counts controls, so a locator that found none has to fail
  // HERE rather than silently reporting a bar that fits because it is empty.
  // 56px is --topbar-height, declared rather than content-driven.
  (d) => d.controlCount >= 5 && d.present.includes("acting-as") && d.present.includes("settings") && d.barHeight === 56,
);

/* ⚠ THE LAUNCH STATE, READ BEFORE ANYTHING IS DRAWN OR CLICKED. Tommy: "When
   you open the app it'll automatically be in planview editor. This will make
   the design button highlighted." That is a claim about a cold load with NO
   footprint, and the rule U1 shipped could not satisfy it — ownership required
   a live view stop, which requires a footprint, so neither menu was
   highlighted on the one screen he described. It is asserted here, first,
   before the footprint below makes the case untestable for the rest of the
   run. */
record(
  "on-a-cold-load-with-no-footprint-Design-is-the-highlighted-menu",
  await evaluate(`(() => {
    const m = window.__u1.viewMenus();
    return {
      design: { owner: m.design.owner, current: m.design.current, disabled: m.design.disabled, word: m.design.word },
      view: { owner: m.view.owner, current: m.view.current, disabled: m.view.disabled, word: m.view.word, title: m.view.title },
    };
  })()`),
  // Design owns and is marked current; View is DISABLED, because a 3D view of a
  // building that does not exist yet is not a destination — which is exactly
  // what the removed dial did before a footprint was drawn, kept rather than
  // reinvented. And Design is never disabled, because it is now the only way
  // back from the Floor, Roof and Foundation editors.
  (d) =>
    d.design.owner === true &&
    d.design.current === "true" &&
    d.design.disabled === false &&
    d.design.word === "Design" &&
    d.view.owner === false &&
    d.view.current === null &&
    d.view.disabled === true &&
    d.view.title.length > 0,
);

console.log("1. a footprint, so the stops are the real ones");
const canvasBox = await evaluate(
  `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`,
);
if (!canvasBox) throw new Error("no canvas — are you on localhost rather than 127.0.0.1?");
{
  const [cx, cy, cw, ch] = canvasBox;
  const x0 = cx + 60, y0 = cy + 80, x1 = cx + cw - 80, y1 = cy + ch - 120;
  await mouse("mousePressed", x0, y0);
  await sleep(80);
  await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
  await sleep(80);
  await mouse("mouseMoved", x1, y1);
  await sleep(80);
  await mouse("mouseReleased", x1, y1);
  await sleep(1500);
}
record(
  "footprint-drawn",
  await evaluate(`(() => {
    const m = window.__u1.viewMenus();
    return { currentStop: m.design.currentStopAttr, viewDisabled: m.view.disabled };
  })()`),
  // Every destination below depends on there being a building: with no
  // footprint there are no elevation entries and the View menu is empty, which
  // looks identical to "the merge lost the elevations".
  (d) => d.currentStop === "2D Floor Plan" && d.viewDisabled === false,
);

/* ⚠ U3'S REAL ACCEPTANCE CRITERION, HALF ONE — read BEFORE the checkboxes are
   touched, and before Settings is even opened.

   Moving the Panelizer into Settings is what satisfies Tommy's "all floor,
   foundation, and roof options should be a checkbox toggle under settings",
   and the thing that would make that move worthless is the checkboxes quietly
   ceasing to gate anything. So the Design menu's subject groups are read here
   against the default scope (Floors, Roof and Foundation OFF since Smearforn
   Stage 0) and again below with all four on, and both times they are compared
   to the CHECKBOXES THEMSELVES rather than to a hard-coded list — a gate that
   had stopped working would otherwise look like a list that happened to
   match. */
const designSubjects = async () => {
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  const entries = await evaluate(`window.__u1.openMenuEntries()`);
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  return entries.map((g) => g.subject);
};
const SCOPE_LABEL_TO_SUBJECT = { Floors: "floor", Walls: "wall", Roof: "roof", Foundation: "foundation" };
const subjectsFromBoxes = (boxes) =>
  boxes.filter((b) => b.checked).map((b) => SCOPE_LABEL_TO_SUBJECT[b.text]);
const designSubjectsAtDefaultScope = await designSubjects();

console.log("2. all four scope branches on — the widest bar the keyhole allows");
/* ⚠ U3 (2026-09-29): ONE CLICK, NOT TWO. The Panelizer is a section inside the
   ⚙ Settings note now — Tommy, "we should move the content of the panelizer
   into the settings in the top right" — so the old Project ▾ → Panelizer pair
   of cold clicks is a single click on the gear, and what it waits for is the
   Panelizer's own scope group INSIDE `#settings-note` rather than a note id
   that no longer exists. */
const coldClickAttempts = {
  settingsMenu: await clickSelectorUntil(
    '[data-bar-control="settings"]',
    "the Settings menu",
    `Boolean(document.querySelector('#settings-note [data-settings-section="panelizer"] [aria-label="Scope of work"]'))`,
  ),
};
evidence.coldClickAttempts = coldClickAttempts;
record(
  "the-cold-click-retry-is-a-safety-net-and-not-load-bearing",
  { coldClickAttempts, budget: 3, ceiling: 2 },
  // ⚠ A RETRY NOBODY WATCHES BECOMES A MASK. The budget is 3, so a run in which
  // every first click failed would still have gone green, with the evidence of
  // it buried in a field nobody reads. Asserting a CEILING of 2 lets the net
  // catch the known cold-load race — one retry, which this machine needs most
  // runs — and fails the run if clicks start needing every attempt, which would
  // be a real control problem wearing a flake's clothes.
  (d) => Object.values(d.coldClickAttempts).every((attempts) => attempts <= d.ceiling),
);
const scopeBoxes = await evaluate(`(() => {
  const note = document.querySelector('#settings-note [data-settings-section="panelizer"]');
  if (!note) return null;
  return [...note.querySelectorAll('label')]
    .map((l) => ({ text: l.textContent.replace(/\\s+/g,' ').trim(), checked: l.querySelector('input[type="checkbox"]')?.checked ?? null }))
    .filter((l) => ['Floors','Walls','Roof','Foundation'].includes(l.text));
})()`);
if (!scopeBoxes || scopeBoxes.length !== 4) throw new Error(`expected 4 scope checkboxes, saw ${JSON.stringify(scopeBoxes)}`);
for (const box of scopeBoxes) {
  if (box.checked) continue;
  const at = await evaluate(`(() => {
    const note = document.querySelector('#settings-note [data-settings-section="panelizer"]');
    const label = [...note.querySelectorAll('label')].find((l) => l.textContent.replace(/\\s+/g,' ').trim() === ${JSON.stringify(box.text)});
    const input = label.querySelector('input[type="checkbox"]');
    input.scrollIntoView({ block: 'nearest' });
    const r = input.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await click(at.x, at.y);
}
const scopeAfter = await evaluate(`(() => {
  const note = document.querySelector('#settings-note [data-settings-section="panelizer"]');
  return [...note.querySelectorAll('label')]
    .map((l) => ({ text: l.textContent.replace(/\\s+/g,' ').trim(), checked: l.querySelector('input[type="checkbox"]')?.checked ?? null }))
    .filter((l) => ['Floors','Walls','Roof','Foundation'].includes(l.text));
})()`);
await clickSelector('#settings-note button[title="Hide this note"]', "the Settings note's close button");
await sleep(500);
// Nothing may be left overlaying the editor: an open note sitting over a
// control is how U0's harness once lost six clicks in a row and reported
// "Membranes unreachable" — a locator problem wearing a feature bug's clothes.
// ⚠ `#site-properties-note` and `#panelizer-note` are gone as of U3 — both are
// sections of `#settings-note` now — so this list names the notes that exist.
const notesStillOpen = await evaluate(
  `[...document.querySelectorAll('#settings-note, #project-note')].filter((n) => n.getBoundingClientRect().width > 0).length`,
);
if (notesStillOpen > 0) throw new Error(`${notesStillOpen} top-bar note(s) left open over the editor`);
record(
  "all-four-scope-branches-on",
  { scopeBefore: scopeBoxes, scopeAfter },
  // The widest possible bar is the case every width below is judged on. Left at
  // its default (Floor and Foundation OFF since Smearforn Stage 0) the Design
  // menu would be measured two subject groups short, and option A two tabs
  // short.
  (d) => d.scopeAfter.length === 4 && d.scopeAfter.every((b) => b.checked === true),
);

/* ⚠ U3'S REAL ACCEPTANCE CRITERION, HALF TWO. The checkboxes were ticked in
   their NEW home — inside ⚙ Settings — and the Design menu is read again. Both
   readings are compared to the checkbox states they were taken under, so this
   fails if the relocation left the boxes rendering but no longer wired to
   `scopeOfWork` → `enabledEditorTabs` → the menu's subject groups. That is the
   failure the move is most likely to cause and the one nothing else here would
   catch: the note would still open, the boxes would still tick, and the Design
   menu would simply stop changing. */
const designSubjectsAtFullScope = await designSubjects();
record(
  "the-panelizers-scope-checkboxes-still-gate-the-design-menu-from-their-new-home-in-settings",
  {
    where: "the Panelizer, as a section inside #settings-note (U3)",
    atDefaultScope: { boxes: scopeBoxes, wantSubjects: subjectsFromBoxes(scopeBoxes), designSubjects: designSubjectsAtDefaultScope },
    atFullScope: { boxes: scopeAfter, wantSubjects: subjectsFromBoxes(scopeAfter), designSubjects: designSubjectsAtFullScope },
  },
  // Sets, not sequences: the menu's group ORDER is Tommy's (Wall, Floor, Roof,
  // Foundation) and is asserted by its own unit test, not here. What is
  // asserted here is that the set of subject groups the Design menu offers is
  // exactly the set of scope branches checked in the Panelizer — twice, under
  // two different scopes, so a menu that ignores the boxes cannot pass both.
  (d) =>
    [d.atDefaultScope, d.atFullScope].every(
      (c) =>
        c.designSubjects.length === c.wantSubjects.length &&
        c.wantSubjects.every((s) => c.designSubjects.includes(s)),
    ) && d.atDefaultScope.designSubjects.length !== d.atFullScope.designSubjects.length,
);

console.log("3. validating the four-company simulation against a real 2026-09-13 measurement");
// ⚠ AT 1600, WHERE NOTHING IS FIGHTING FOR THE WIDTH. The 270px reference was
// measured with room to spare, so the select was at its natural width.
// Validating it at a width where the bar is squeezed would compare a squeezed
// select against an unsqueezed figure and call the difference a broken
// simulation.
await setViewport(1600, 1000);
await installToolkit();
const simCheck = await evaluate(
  `(() => { const r = window.__u1.simulateCompanies(${JSON.stringify(FOUR_COMPANY_LABELS)}, ${JSON.stringify(LONGEST_COMPANY_LABEL)}); const f = window.__u1.fit(); return { ...r, chipText: f.actingAsText, chipWidth: f.actingAsWidth }; })()`,
);
record(
  "four-company-simulation-renders-like-the-real-control",
  {
    ...simCheck,
    recordedPx: RECORDED_LONGEST_LABEL_PX,
    deltaPx: simCheck.width == null ? null : Math.round((simCheck.width - RECORDED_LONGEST_LABEL_PX) * 10) / 10,
  },
  // ⚠ THE ANTI-VACUOUS-PASS GUARD FOR THE WHOLE SIMULATION. If the hashed class
  // lookup failed, the select renders unstyled — a different font at a
  // different size — and every "four companies" width below would be a
  // measurement of nothing.
  (d) => d.ok === true && d.deltaPx !== null && Math.abs(d.deltaPx) <= 12 && d.chipText.includes("Seed"),
);
await evaluate(`window.__u1.clearCompanies()`);

console.log("4. what was removed is gone at EVERY width, and what replaced it is present at every width");
const removalSweep = [];
for (const w of WIDTHS) {
  await setViewport(w, 900);
  await installToolkit();
  const seen = await evaluate(`(() => {
    const m = window.__u1.viewMenus();
    return {
      removed: window.__u1.removedControls(),
      editorTabDial: window.__u1.editorTabDial(),
      placeholders: window.__u1.placeholders(),
      design: { present: m.design.present, word: m.design.word, text: m.design.text, w: m.design.w },
      view: { present: m.view.present, word: m.view.word, text: m.view.text, w: m.view.w },
    };
  })()`);
  removalSweep.push({ width: w, ...seen });
}
evidence.removalSweep = removalSweep;
record(
  "the-dial-the-nav-tabs-the-tab-dial-and-the-wordmark-are-gone-at-every-width",
  {
    removalSweep: removalSweep.map((r) => ({ width: r.width, ...r.removed, editorTabDial: r.editorTabDial })),
  },
  // ⚠ A REMOVAL IS ONLY REAL IF IT HOLDS AT EVERY WIDTH. Each of these three
  // had a width-keyed life: the dial was the below-breakpoint form, the nav
  // tabs and the wordmark appeared at 1200 and up. A sweep at 1600 alone would
  // have called all three gone while two were alive at 710. The caption and
  // value counts are here too: the LABEL+Value treatment is meant to be unique
  // to the acting-as chip now, and its reappearance on a view menu would be the
  // bare-word decision quietly undone.
  (d) =>
    d.removalSweep.every(
      (r) =>
        r.sidebarViewDial === false &&
        r.editorNav === false &&
        r.barNavZone === false &&
        r.barTabButtons.length === 0 &&
        r.wordmark === false &&
        r.viewMenuCaptions === 0 &&
        r.viewMenuValues === 0 &&
        // ⚠ ADDED 2026-09-29: the Wall/Foundation/Floor/Roof tab dial, which
        // Region 2 of the sidebar held until Tommy removed it. It was the LAST
        // second door to a subject; with it gone the Design menu is the only
        // way to change what you are editing, which is what he asked for and is
        // the thing most worth a check at every width.
        r.editorTabDial.found === false,
    ),
);
record(
  "Design-and-View-are-BARE-WORDS-on-the-bar-at-every-width",
  {
    cells: removalSweep.map((r) => ({ width: r.width, design: r.design, view: r.view })),
    // The bar's own two words, and their measured widths. The carets are part
    // of `text` and are dropped below 768 by the stylesheet, which is why the
    // WORD is read from its own span rather than off textContent — a reader
    // comparing textContent to "View" fails on "View ▼" and reads exactly like
    // a rename that never happened.
    designWidthByWidth: Object.fromEntries(removalSweep.map((r) => [r.width, r.design.w])),
    viewWidthByWidth: Object.fromEntries(removalSweep.map((r) => [r.width, r.view.w])),
  },
  // Tommy, 2026-09-28: "That would reduce the view button to just saying view."
  // Present at every width — with no dial there is nothing to catch these if
  // they shed — and carrying the word and nothing else.
  (d) =>
    d.cells.every(
      (c) =>
        c.design.present === true &&
        c.view.present === true &&
        c.design.word === "Design" &&
        c.view.word === "View" &&
        c.design.text.replace(/[▼▲]/g, "").trim() === "Design" &&
        c.view.text.replace(/[▼▲]/g, "").trim() === "View",
    ),
);

record(
  "Summary-and-Print-are-REAL-controls-at-every-width-and-still-fit",
  {
    cells: removalSweep.map((r) => ({ width: r.width, placeholders: r.placeholders })),
    widths: removalSweep.map((r) => r.width),
  },
  /* ⚠ THIS CHECK WAS INVERTED BY U4/U5, 2026-10-11, AND THAT IS THE RECORD OF
     THE EXCEPTION CLOSING.
     It used to assert that Summary and Print were really DISABLED, because the
     Top Bar rule forbids a control that opens nothing and Tommy took that
     exception knowingly for these two: *"i like the add then now as disabled
     placeholders… i want to get a feel for how this is going to be a user
     friendly experience"*. U4 built the Summary page and U5 built Print, so the
     exception expired by being satisfied, and the honest thing is to assert the
     opposite rather than delete the check.
     They must now be ENABLED and must open something — and they must still take
     no part in the VIEW machinery, which has not changed: no `aria-expanded`
     (each is one destination, not a menu) and no `data-view-menu` (ownership of
     the surface is tracked by `data-surface-owner`, so they cannot be mistaken
     for a view stop).
     ⚠ AND `onScreen` IS STILL THE POINT, at every width including Tommy's own
     710px. U1 existed to test whether twelve controls could share this bar
     without re-creating the 2026-09-13 overflow bug; two of them becoming real
     does not change their width, but that is a claim, and this is where it is
     measured rather than assumed. */
  (d) =>
    d.cells.every(
      (c) =>
        c.placeholders.length === 2 &&
        c.placeholders.map((p) => p.control).join(",") === "summary,print" &&
        // Order settled by Tommy on 2026-10-11: *"Order: Summary Print"*.
        c.placeholders.map((p) => p.label).join(",") === "Summary,Print" &&
        c.placeholders.every(
          (p) => p.disabled === false && p.title.length > 0 && p.opensAMenu === false && p.isAViewMenu === false && p.onScreen === true,
        ),
    ),
);

console.log("5. every destination is reachable from the bar, and counted");
await setViewport(1600, 1000);
await installToolkit();
const designEntries = await (async () => {
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  const entries = await evaluate(`window.__u1.openMenuEntries()`);
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  return entries;
})();
const viewEntries = await (async () => {
  await clickSelector('[data-view-menu="view"]', "the View menu");
  const entries = await evaluate(`window.__u1.openMenuEntries()`);
  await clickSelector('[data-view-menu="view"]', "the View menu");
  return entries;
})();
evidence.menuContents = { design: designEntries, view: viewEntries };
const allStopLabels = [
  ...designEntries.flatMap((g) => g.entries.filter((e) => e.kind === "stop").map((e) => e.label)),
  ...viewEntries.flatMap((g) => g.entries.filter((e) => e.kind === "stop").map((e) => e.label)),
];
/* The longest stop label, recorded rather than used: it is what a menu ENTRY
   has to be wide enough for, and with the bar words bare it is the only place
   that string still has to fit. A later stage adding a longer stop name can
   compare against it. */
evidence.longestStopLabel = allStopLabels.reduce((a, b) => (b.length > a.length ? b : a), allStopLabels[0]);
record(
  "the-two-menus-together-reach-every-stop-and-every-subject-in-scope",
  {
    designGroups: designEntries.map((g) => ({ subject: g.subject, heading: g.heading, groupRole: g.groupRole, groupLabel: g.groupLabel, entries: g.entries.map((e) => e.label) })),
    viewGroups: viewEntries.map((g) => ({ subject: g.subject, heading: g.heading, entries: g.entries.map((e) => e.label) })),
    stops: allStopLabels,
    subjects: designEntries.flatMap((g) => g.entries.filter((e) => e.kind === "subject").map((e) => e.key)),
    elevationCount: allStopLabels.filter((l) => l.startsWith("Elevation:")).length,
  },
  // ⚠ THE CENTRAL REQUIREMENT — "let's make sure nothing is lost" — and with
  // both the dial and the four tabs gone, a destination missing here is a
  // destination NOBODY CAN REACH AT ALL. Counted rather than sampled: the plan,
  // one elevation per wall of the rectangle drawn above, the three 3D
  // representations by name (Membranes was a specific request), and the three
  // non-wall subjects, which are present only because step 2 checked them on.
  (d) =>
    d.stops[0] === "2D Floor Plan" &&
    d.elevationCount >= 3 &&
    d.stops.includes("3D Framed") &&
    d.stops.includes("3D Boxes") &&
    d.stops.includes("Membranes") &&
    !d.stops.includes("3D Wraps") &&
    JSON.stringify(d.subjects) === JSON.stringify(["floor", "roof", "foundation"]) &&
    // Tommy chose GROUPED over flat, so the wall group carries a heading and it
    // is the group's accessible name too — a heading that only sighted readers
    // get is not grouping.
    d.designGroups[0].heading === "Wall" &&
    d.designGroups[0].groupRole === "group" &&
    d.designGroups[0].groupLabel === "Wall",
);

/**
 * THE BAR CONFIGURATIONS.
 *
 * `built` is measured as it renders; the others add PROJECTED controls to the
 * real row so the real media queries and the real flex behaviour are in play
 * rather than arithmetic on remembered widths.
 */
const TAB_SPEC = [
  { control: "nav-wall", label: "Wall", style: "navTab" },
  { control: "nav-foundation", label: "Foundation", style: "navTab" },
  { control: "nav-floor", label: "Floor", style: "navTab" },
  { control: "nav-roof", label: "Roof", style: "navTab" },
];
/**
 * ⚠ SUMMARY AND PRINT ARE NO LONGER PROJECTED — THEY ARE ON THE BAR.
 *
 * They were projected here because the Top Bar rule forbids a control that
 * opens nothing. Tommy broke that rule for this one case on 2026-09-29 ("i like
 * the add then now as disabled placeholders… i want to get a feel for how this
 * is going to be a user friendly experience"), so they are real, disabled
 * buttons and every "built" figure below INCLUDES them. The previous run — the
 * same bar without them — is kept as `evidence-seven-control-bar.json`, and the
 * difference between the two is what Summary and Print actually cost.
 *
 * ⚠ OPTION A IS GATED AT >=1200px, AND THE FIRST VERSION OF THIS WAS WRONG.
 * It injected the four tab items at EVERY width, but the real nav tabs only
 * ever rendered at >=1200px — below that they shed and cost the company name
 * nothing. So the narrow-end "option A" figures described a bar that never
 * existed, and the comparison was unfair in the direction that flattered the
 * decision already taken. Option A now sheds exactly as the nav did, which
 * makes its true cost a wide-end one: the company name whole from 1253px
 * instead of 1200px. The 294.3px fold saving is unaffected — it was measured at
 * 1600px, where the tabs really did show.
 */
const BAR_CONFIGS = [
  {
    id: "optionA",
    spec: TAB_SPEC,
    minWidth: 1200,
    what: "the four tab items back on the bar, shedding below 1200px exactly as the real nav did — the structure Tommy did not choose",
  },
];
evidence.barConfigurations = [
  {
    id: "built",
    spec: [],
    what: "the bar as it ships: bare Design and View, the Summary and Print placeholders, no wordmark, no tab items, no tab dial",
  },
  ...BAR_CONFIGS,
];

const setRole = async (label) => {
  await clickSelector('[data-bar-control="role"]', "the Role control");
  const at = await evaluate(`(() => {
    const note = document.querySelector('#role-note');
    if (!note) return null;
    const btn = [...note.querySelectorAll('button')].find((b) => b.querySelector('[data-role-option-label]')?.textContent.trim() === ${JSON.stringify(label)});
    if (!btn) return null;
    btn.scrollIntoView({ block: 'nearest' });
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`no role option labelled "${label}"`);
  await click(at.x, at.y);
  await sleep(350);
  const now = await evaluate(`document.querySelector('[data-bar-control="role"]').textContent.replace(/\\s+/g,' ').trim()`);
  if (!now.includes(label)) throw new Error(`role did not change to ${label}; the control reads "${now}"`);
};

/** One reading of the row. `wantedPx` is every control at its natural width
 * plus the gaps the row really uses at this breakpoint — i.e. what the row
 * would need if nothing were allowed to shrink. `rowContentWidth` is what it
 * has. */
const summarise = (fit, width) => ({
  controls: fit.present,
  controlCount: fit.controlCount,
  /* ⚠ THE PER-CONTROL WIDTHS, the figure this pass was sent to produce. */
  controlWidths: fit.controlWidths,
  widthSum: fit.controlsWidthSum,
  rowContentWidth: fit.rowContentWidth,
  overflowPx: fit.rowOverflowPx,
  docOverflowPx: fit.docOverflowPx,
  actingAsWidth: fit.actingAsWidth,
  actingAsOnScreen: fit.actingAsOnScreen,
  /* The select's own width and how much of the company name is legible in it.
     The chip's box above says "on screen" for a chip whose select is 16.1px
     wide and shows nothing, which is the reading that let U1 ship the
     2026-09-13 failure in its second form. */
  nameWidthPx: fit.actingAsName ? fit.actingAsName.widthPx : null,
  nameNaturalPx: fit.actingAsName ? fit.actingAsName.naturalPx : null,
  nameVisibleChars: fit.actingAsName ? fit.actingAsName.visibleChars : null,
  nameLabelChars: fit.actingAsName ? fit.actingAsName.labelChars : null,
  nameVisibleText: fit.actingAsName ? fit.actingAsName.visibleText : null,
  nameTruncated: fit.actingAsName ? fit.actingAsName.truncated : null,
  anyNameVisible: fit.actingAsName ? fit.actingAsName.anyNameVisible : null,
  offScreen: fit.anyControlOffScreen,
  barHeight: fit.barHeight,
  wantedPx: Math.round((fit.controlsWidthSum + Math.max(0, fit.controlCount - 1) * (width < 768 ? 4 : 10)) * 10) / 10,
  shortfallPx: Math.round((fit.controlsWidthSum + Math.max(0, fit.controlCount - 1) * (width < 768 ? 4 : 10) - fit.rowContentWidth) * 10) / 10,
});

const applyAccountState = async (accountState, width) => {
  if (accountState !== "four-companies-simulated") return;
  const sim = await evaluate(
    `window.__u1.simulateCompanies(${JSON.stringify(FOUR_COMPANY_LABELS)}, ${JSON.stringify(LONGEST_COMPANY_LABEL)})`,
  );
  if (!sim.ok) throw new Error(`the four-company simulation failed at ${width}px: ${sim.why}`);
};

console.log("6. THE MATRIX — 8 widths x 2 account states x 4 roles x 4 bar configurations");
const MEASURED_WIDTHS = [...WIDTHS];
evidence.measuredWidths = MEASURED_WIDTHS;
const matrix = [];
for (const role of ROLE_LABELS) {
  // The role is set at a width where its note is comfortably on screen. The
  // control itself is never shed at any width; the role persists across every
  // viewport change below.
  await setViewport(1440, 1000);
  await installToolkit();
  await setRole(role);
  for (const width of MEASURED_WIDTHS) {
    await setViewport(width, 900);
    await installToolkit();
    for (const accountState of ["signed-out", "four-companies-simulated"]) {
      await applyAccountState(accountState, width);
      const cell = { role, width, accountState };
      cell.built = summarise(await evaluate(`window.__u1.fit()`), width);
      for (const config of BAR_CONFIGS) {
        /* Below its own minWidth a configuration IS the shipped bar, because
           what it adds really did shed there. Recorded as such rather than
           skipped, so a reader of the table sees a number at every width. */
        if (config.minWidth && width < config.minWidth) {
          cell[config.id] = { ...cell.built, shedHere: config.spec.map((s) => s.control) };
          continue;
        }
        const projection = await evaluate(`window.__u1.project(${JSON.stringify(config.spec)})`);
        if (!projection.ok) throw new Error(`projecting ${config.id} at ${width}px failed: ${projection.why}`);
        const fit = await evaluate(`window.__u1.fit()`);
        // ⚠ ANTI-VACUOUS GUARD. A configuration that added nothing AND found
        // nothing already there would report the shipped bar as the projected
        // one and say it fits beautifully.
        const wanted = config.spec.map((s) => s.control);
        const missing = wanted.filter((c) => !fit.present.includes(c));
        if (missing.length > 0) throw new Error(`${config.id} at ${width}px is missing ${missing.join(", ")} from the row`);
        cell[config.id] = summarise(fit, width);
        cell[config.id].projectedHere = projection.projected;
        cell[config.id].projectedFromDeletedCss = projection.projectedFromDeletedCss;
        await evaluate(`window.__u1.clearProjection()`);
      }
      if (accountState === "four-companies-simulated") await evaluate(`window.__u1.clearCompanies()`);
      matrix.push(cell);
    }
  }
}
evidence.matrix = matrix;

/** Four companies is the widest real case, so every summary below is taken
 * from it. The signed-out rows stay in `matrix` for comparison. */
const worst = matrix.filter((m) => m.accountState === "four-companies-simulated");
const CONFIG_IDS = ["built", "optionA"];
const summaryFor = (configId) => {
  const out = {};
  for (const w of MEASURED_WIDTHS) {
    const cells = worst.filter((m) => m.width === w).map((m) => m[configId]).filter(Boolean);
    if (cells.length === 0) continue;
    out[w] = {
      rowContentWidth: cells[0].rowContentWidth,
      maxWantedPx: Math.max(...cells.map((c) => c.wantedPx)),
      maxShortfallPx: Math.max(...cells.map((c) => c.shortfallPx)),
      fits: cells.every((c) => c.shortfallPx <= 0),
      maxOverflowPx: Math.max(...cells.map((c) => c.overflowPx)),
      maxDocOverflowPx: Math.max(...cells.map((c) => c.docOverflowPx)),
      minActingAsWidth: Math.min(...cells.map((c) => c.actingAsWidth ?? 0)),
      actingAsAlwaysOnScreen: cells.every((c) => c.actingAsOnScreen),
      // The name itself, which is what the chip's width above cannot report.
      minNameWidthPx: Math.min(...cells.map((c) => c.nameWidthPx ?? 0)),
      nameNaturalPx: cells[0].nameNaturalPx,
      minNameVisibleChars: Math.min(...cells.map((c) => c.nameVisibleChars ?? 0)),
      nameLabelChars: cells[0].nameLabelChars,
      anyNameVisibleEverywhere: cells.every((c) => c.anyNameVisible === true),
      nameWholeEverywhere: cells.every((c) => c.nameTruncated === false),
      worstNameVisibleText: cells.reduce(
        (a, c) => (a === null || (c.nameVisibleChars ?? 0) < a.length ? (c.nameVisibleText ?? "") : a),
        null,
      ),
      everOffScreen: [...new Set(cells.flatMap((c) => c.offScreen))],
      controlsPresent: cells[0].controls,
      /* Per control, per width, the widest reading across the four roles — the
         answer to "how wide IS Account, really". */
      controlWidths: Object.fromEntries(
        [...new Set(cells.flatMap((c) => Object.keys(c.controlWidths)))].map((name) => [
          name,
          Math.max(...cells.map((c) => c.controlWidths[name] ?? 0)),
        ]),
      ),
    };
  }
  return out;
};
evidence.byWidth = Object.fromEntries(CONFIG_IDS.map((id) => [id, summaryFor(id)]));

/**
 * ⚠ THE PER-CONTROL WIDTHS, PUBLISHED ON THEIR OWN, because they are the point
 * of this pass.
 *
 * The previous record carried ~104px each for Account, Projects and Settings,
 * derived by subtracting measured parts from a measured total. That is
 * inference sitting in a table of measurements, and it is what made 1280px look
 * like it had ~17px of margin. These are read one control at a time out of the
 * real layout, at the width where nothing is squeezing them (1600) and again at
 * every measured width.
 */
evidence.perControlWidths = {
  measuredAt: "four companies simulated, the widest reading across all four roles",
  atEachWidth: Object.fromEntries(
    MEASURED_WIDTHS.map((w) => [w, evidence.byWidth.built[w] ? evidence.byWidth.built[w].controlWidths : null]),
  ),
  unsqueezedAt1600: evidence.byWidth.built[1600] ? evidence.byWidth.built[1600].controlWidths : null,
};
record(
  "THE-PER-CONTROL-WIDTHS",
  evidence.perControlWidths,
  // An observation, not a gate — but it does have to be a real reading, and a
  // missing control here would mean every derived figure below is arithmetic on
  // a hole. Account, Projects and Settings are named explicitly because they
  // are the three that were inferred.
  (d) =>
    d.unsqueezedAt1600 !== null &&
    ["acting-as", "account", "project", "design", "view", "role", "settings"].every(
      (c) => typeof d.unsqueezedAt1600[c] === "number" && d.unsqueezedAt1600[c] > 0,
    ),
);

/**
 * The narrowest viewport at which a configuration really fits, bisected in a
 * real browser rather than extrapolated from the sampled widths.
 *
 * FOUR predicates, because "fits" has several honest meanings and the gaps
 * between them are the whole lesson of 2026-09-13 — twice over:
 *   `nothingOffScreen`   — no control has left the viewport and nothing
 *                          scrolls. The floor.
 *   `anyNameVisible`     — that, AND at least one character of the acting-as
 *                          company really renders. **Below this width the name
 *                          is FULLY ABSENT, which is the number Tommy asked to
 *                          see for this design.**
 *   `companyNameIntact`  — that, AND the acting-as CHIP is at least as wide as
 *                          the cap its select's stylesheet gives it. Kept
 *                          because older figures are stated in its terms; it
 *                          reads the chip, which carries ~85px of caption and
 *                          padding, so it clears while the name is still cut.
 *   `companyNameWhole`   — that, AND the NAME ELEMENT itself is at its natural
 *                          untruncated width, measured against a
 *                          `max-width: none` clone. This is the one "the name
 *                          is not crushed" means.
 *
 * ⚠ BISECTED PER BREAKPOINT BAND, because fit is not monotonic in width: the
 * bar's neighbours still change at 1200 (the name's cap rises from 220px to
 * 280px), so a configuration can behave differently at 1199 and 1200. Each band
 * is monotonic on its own.
 *
 * ⚠ AND AT THE WIDEST ROLE LABEL, SET EXPLICITLY. An earlier version inherited
 * whatever role the matrix loop left set and every published threshold was
 * 6-7px off in the optimistic direction.
 */
const WIDEST_ROLE_LABEL = "Fabricator";
const BREAKPOINT_BANDS = [
  { id: "below-768", lo: 320, hi: 767, what: "carets dropped, ACTING AS caption shed, tighter controls" },
  { id: "768-1199", lo: 768, hi: 1199, what: "caption shown, company name capped at 220px" },
  { id: "1200-up", lo: 1200, hi: 2400, what: "company name capped at 280px; sidebar tab dial hidden" },
];

const makeFitsAt = (spec, predicateId, minWidth = 0) => async (w) => {
  await setViewport(w, 900);
  await installToolkit();
  await applyAccountState("four-companies-simulated", w);
  // Same gating as the matrix: below its own minWidth the configuration sheds
  // what it adds, so there is nothing to project and the answer is the shipped
  // bar's. Without this the bisection answers a question about a bar nobody
  // ever shipped or proposed.
  if (spec.length > 0 && w >= minWidth) {
    const projection = await evaluate(`window.__u1.project(${JSON.stringify(spec)})`);
    if (!projection.ok) throw new Error(`bisect projection failed at ${w}px: ${projection.why}`);
  }
  const fit = await evaluate(`window.__u1.fit()`);
  await evaluate(`window.__u1.clearProjection(); window.__u1.clearCompanies();`);
  const nothingOffScreen = fit.anyControlOffScreen.length === 0 && fit.docOverflowPx === 0 && fit.rowOverflowPx === 0;
  if (predicateId === "nothingOffScreen") return nothingOffScreen;
  if (predicateId === "companyNameWhole") {
    return nothingOffScreen && fit.actingAsName !== null && fit.actingAsName.truncated === false;
  }
  if (predicateId === "anyNameVisible") {
    return nothingOffScreen && fit.actingAsName !== null && fit.actingAsName.anyNameVisible === true;
  }
  const cap = w >= 1200 ? 280 : 220;
  return nothingOffScreen && (fit.actingAsWidth ?? 0) >= cap;
};

const bisectBand = async (spec, predicateId, band, minWidth = 0) => {
  const fitsAt = makeFitsAt(spec, predicateId, minWidth);
  if (await fitsAt(band.lo)) return band.lo;
  if (!(await fitsAt(band.hi))) return `never in ${band.lo}-${band.hi}`;
  let lo = band.lo;
  let hi = band.hi;
  while (hi - lo > 2) {
    const mid = Math.round((lo + hi) / 2);
    if (await fitsAt(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
};

console.log("6b. the Settings note's sections, read out of the DOM at all four roles");
/**
 * ⚠ THE ROLE-GATE HOLE, CLOSED AT THE DOM — added 2026-09-29 at U3's review.
 *
 * U3's named failure mode is the Panelizer ending up INSIDE the role-gated
 * Admin Options group: the app's central control would simply stop existing
 * for a signed-out visitor, with no error anywhere and nothing red.
 *
 * **`topBarMenus.test.ts` does not close that hole and cannot.** Its tests
 * exercise a pure filter over a frozen five-element array of ids and have no
 * view of JSX nesting whatsoever. Paste `{siteContent}` into TopBar's `admin:`
 * entry and `settingsMenuSections("public")` still returns `"site"`, every one
 * of those tests still passes, and `public` still loses Site Properties. What
 * actually closes it is the `Record<SettingsSectionId, ReactNode>` shape — one
 * entry per id, rendered as siblings — together with THIS check, which reads
 * the live DOM at every role and compares it to the contract.
 *
 * ⚠ The expected lists are RESTATED here rather than imported, because a
 * `.mjs` harness cannot import a `.ts` module — and the restatement is the
 * point. Two independent statements of one list, one of them measured out of a
 * running browser: if `SETTINGS_SECTION_IDS` changes, this goes red and has to
 * be changed on purpose.
 */
const SETTINGS_SECTIONS_BY_ROLE = {
  Public: ["panelizer", "site", "units", "sandbox"],
  Fabricator: ["panelizer", "site", "units", "sandbox", "admin"],
  Admin: ["panelizer", "site", "units", "sandbox", "admin"],
  Engineer: ["panelizer", "site", "units", "sandbox", "admin"],
};
await setViewport(1440, 1000);
await installToolkit();
const settingsSectionsByRole = [];
for (const role of ROLE_LABELS) {
  await setRole(role);
  await clickSelectorUntil(
    '[data-bar-control="settings"]',
    "the Settings menu",
    `Boolean(document.querySelector('#settings-note [data-settings-section]'))`,
  );
  const reading = await evaluate(`(() => {
    const note = document.getElementById('settings-note');
    const sections = [...note.querySelectorAll('[data-settings-section]')];
    const byId = (id) => note.querySelector('[data-settings-section="' + id + '"]');
    const panelizer = byId('panelizer');
    const site = byId('site');
    const admin = byId('admin');
    return {
      sections: sections.map((e) => e.dataset.settingsSection),
      panelizerPresent: !!panelizer,
      sitePresent: !!site,
      /* The hole stated directly, in the only terms that can see it: is the
         relocated section a DESCENDANT of the role-gated group? The id list
         cannot answer this; the DOM can. */
      panelizerInsideAdmin: !!(panelizer && admin && admin !== panelizer && admin.contains(panelizer)),
      siteInsideAdmin: !!(site && admin && admin !== site && admin.contains(site)),
      scopeGroupInsideThePanelizer: !!note.querySelector('[data-settings-section="panelizer"] [aria-label="Scope of work"]'),
    };
  })()`);
  settingsSectionsByRole.push({ role, want: SETTINGS_SECTIONS_BY_ROLE[role], ...reading });
  await clickSelector('#settings-note button[title="Hide this note"]', "the Settings note's close button");
  await sleep(300);
}
await setRole(ROLE_LABELS[0]);
await clickSelectorUntil(
  '[data-bar-control="settings"]',
  "the Settings menu",
  `Boolean(document.querySelector('#settings-note [data-settings-section]'))`,
);
await shot("06b-settings-sections-at-public");
await clickSelector('#settings-note button[title="Hide this note"]', "the Settings note's close button");
await sleep(300);
record(
  "the-settings-notes-sections-in-the-dom-match-settingsmenusections-at-every-role",
  { byRole: settingsSectionsByRole, roles: settingsSectionsByRole.length },
  // ORDER is included, not just membership: Panelizer FIRST is the answer to
  // Tommy's "where is it?", so the right sections in the wrong order is a
  // finding rather than a detail. `admin` is the only id ever withheld and it
  // is withheld from `Public` alone — counted both ways so a gate that stopped
  // gating and a gate that started over-gating both fail.
  (d) =>
    d.roles === 4 &&
    d.byRole.every(
      (r) =>
        JSON.stringify(r.sections) === JSON.stringify(r.want) &&
        r.panelizerPresent === true &&
        r.sitePresent === true &&
        r.panelizerInsideAdmin === false &&
        r.siteInsideAdmin === false &&
        r.scopeGroupInsideThePanelizer === true,
    ) &&
    d.byRole.find((r) => r.role === "Public").sections.includes("admin") === false &&
    d.byRole.filter((r) => r.sections.includes("admin")).length === 3,
);

console.log("7. the thresholds, bisected in the browser");
await setViewport(1440, 1000);
await installToolkit();
await setRole(WIDEST_ROLE_LABEL);

const firstFits = {};
for (const config of [{ id: "built", spec: [] }, ...BAR_CONFIGS]) {
  firstFits[config.id] = {};
  for (const predicateId of ["nothingOffScreen", "anyNameVisible", "companyNameIntact", "companyNameWhole"]) {
    firstFits[config.id][predicateId] = {};
    for (const band of BREAKPOINT_BANDS) {
      firstFits[config.id][predicateId][band.id] = await bisectBand(config.spec, predicateId, band, config.minWidth ?? 0);
    }
  }
}
/* ⚠ AND PUT THE ROLE BACK. Region 3's content is ROLE-DEPENDENT — the
   "Estimated Structural Capacity" block is one of the sections a role gates —
   so leaving Fabricator set here made the cross-run comparison below fail on
   every elevation against a baseline recorded under a different role. That is
   the comparison being handed a different page, not a leaked view flag. */
await setViewport(1440, 1000);
await installToolkit();
await setRole(ROLE_LABELS[ROLE_LABELS.length - 1]);

evidence.firstFitsAtViewportWidth = firstFits;
evidence.firstFitsMeasuredAt = {
  role: WIDEST_ROLE_LABEL,
  why: "the widest role label; it leaves the company name narrowest of the four",
  accountState: "four-companies-simulated",
  companyLabel: LONGEST_COMPANY_LABEL,
  bisectionTolerancePx: 2,
};
evidence.breakpointBands = BREAKPOINT_BANDS;

/** Each configuration's NATURAL width: the row content it wants when nothing is
 * squeezed, read at the widest sampled width rather than summed from remembered
 * figures, and reported as a viewport number too (the bar's own 20px padding
 * each side). This is the number "does it fit on a 1920 monitor" is answered
 * from. */
const natural = {};
for (const id of CONFIG_IDS) {
  const at1600 = worst.filter((m) => m.width === 1600).map((m) => m[id]).filter(Boolean);
  if (at1600.length === 0) continue;
  natural[id] = {
    naturalRowContentPx: Math.max(...at1600.map((c) => c.wantedPx)),
    naturalViewportPx: Math.max(...at1600.map((c) => c.wantedPx)) + 40,
    measuredAt: "1600px, four companies, the widest role label",
  };
}
evidence.naturalWidths = natural;

/** ⚠ WHAT FOLDING THE TABS INTO THE DESIGN MENU ACTUALLY BOUGHT, measured
 * rather than quoted. The plan says "roughly 264px"; this is the difference
 * between the shipped bar and the same bar with the four tab items projected
 * back onto it, at the width where neither is squeezed. */
evidence.tabFoldSavingPx =
  natural.optionA && natural.built
    ? Math.round((natural.optionA.naturalRowContentPx - natural.built.naturalRowContentPx) * 10) / 10
    : null;
/** What Summary and Print cost, now that they are real: the shipped bar minus
 * the same bar before they were added, which is the checked-in
 * `evidence-seven-control-bar.json` and is quoted here rather than recomputed,
 * because that bar cannot be measured again without deleting them. */
evidence.summaryPrintCostPx = natural.built
  ? Math.round((natural.built.naturalRowContentPx - SEVEN_CONTROL_BAR_NATURAL_PX) * 10) / 10
  : null;
evidence.sevenControlBarNaturalPx = SEVEN_CONTROL_BAR_NATURAL_PX;

/** ⚠ EVERY WIDTH AT WHICH THE COMPANY NAME IS FULLY ABSENT — the number Tommy
 * asked for by name, stated as a range per band and as a list of the sampled
 * widths where it really happened. Truncated-but-present beats absent; where
 * even truncation runs out, that is published rather than glossed. */
evidence.companyNameFullyAbsent = {
  atSampledWidths: Object.fromEntries(
    CONFIG_IDS.map((id) => [
      id,
      MEASURED_WIDTHS.filter((w) => {
        const cells = worst.filter((m) => m.width === w).map((m) => m[id]).filter(Boolean);
        return cells.length > 0 && cells.some((c) => c.anyNameVisible === false);
      }),
    ]),
  ),
  firstWidthWithAnyNameVisible: Object.fromEntries(CONFIG_IDS.map((id) => [id, firstFits[id].anyNameVisible])),
  note:
    "Below the 'anyNameVisible' threshold for its band the acting-as company renders zero characters. " +
    "The chip, its caption and the switcher itself are still there and still on screen; it is the NAME that is gone.",
};

record(
  "THE-MEASUREMENT-what-each-bar-costs-and-where-it-fits",
  {
    byWidth: evidence.byWidth,
    naturalWidths: natural,
    firstFitsAtViewportWidth: firstFits,
    tabFoldSavingPx: evidence.tabFoldSavingPx,
    summaryPrintCostPx: evidence.summaryPrintCostPx,
    companyNameFullyAbsent: evidence.companyNameFullyAbsent,
    perControlWidths: evidence.perControlWidths,
    cells: matrix.length,
  },
  // ⚠ AN OBSERVATION ON PURPOSE. "Does it fit" is the question this pass was
  // sent to ANSWER, not a property it gets to assert. Asserting a pass here
  // would mean the only way to finish is for the answer to be yes — which is
  // exactly the pressure that produces a quietly shrunk font, a dropped label
  // or an invented breakpoint, none of which Tommy has been asked about. The
  // numbers go in evidence.json and the decisions are his, the same way 1200px
  // was in 2026-09-13.
  { observationOnly: "the width budget IS the finding; a pass/fail here would put a thumb on the scale" },
);

record(
  "nothing-the-bar-ships-is-ever-pushed-off-screen",
  {
    configuration: "the real shipped bar at every measured width, four companies, four roles",
    offScreenAnywhere: [...new Set(worst.flatMap((c) => c.built.offScreen))],
    actingAsAlwaysOnScreen: worst.every((c) => c.built.actingAsOnScreen),
    narrowestActingAsPx: Math.min(...worst.map((c) => c.built.actingAsWidth ?? 0)),
    docOverflowAnywhere: Math.max(...worst.map((c) => c.built.docOverflowPx)),
    rowOverflowAnywhere: Math.max(...worst.map((c) => c.built.overflowPx)),
  },
  // The 2026-09-13 bug's permanent headstone, asserted against what SHIPS. No
  // control may leave the viewport and nothing may scroll horizontally.
  // ⚠ It is not enough on its own — every clause of it was true of a bar whose
  // company name had been crushed to nothing. The record below is the one that
  // can see that, and it is deliberately an observation rather than a gate,
  // because at the narrow end of the range this design DOES spend the name and
  // pretending otherwise would be the dishonest half of a green run.
  (d) =>
    d.actingAsAlwaysOnScreen === true &&
    d.offScreenAnywhere.length === 0 &&
    d.docOverflowAnywhere === 0 &&
    d.rowOverflowAnywhere === 0,
);

const nameCells = worst.map((c) => ({
  role: c.role,
  width: c.width,
  nameWidthPx: c.built.nameWidthPx,
  nameVisibleChars: c.built.nameVisibleChars,
  nameVisibleText: c.built.nameVisibleText,
  nameTruncated: c.built.nameTruncated,
}));
record(
  "how-much-of-the-acting-as-company-name-survives-at-each-width",
  {
    everyCell: nameCells,
    widthsWithNoNameAtAll: [...new Set(nameCells.filter((c) => (c.nameVisibleChars ?? 0) === 0).map((c) => c.width))],
    fewestVisibleChars: Math.min(...nameCells.map((c) => c.nameVisibleChars ?? 0)),
    atTommysOwn710: nameCells.filter((c) => c.width === 710).map((c) => `${c.role}: ${c.nameVisibleChars} chars ("${c.nameVisibleText}")`),
    at1280: nameCells.filter((c) => c.width === 1280).map((c) => `${c.role}: ${c.nameVisibleChars} chars ("${c.nameVisibleText}")`),
  },
  // ⚠ AN OBSERVATION, AND THE REASON IS THE POINT. U1 asserted "at least one
  // character everywhere" and that assertion was RIGHT for U1, whose menus
  // could shed into the dial when the name needed the room. There is no dial to
  // shed into now — the menus are how every view is reached — so at the narrow
  // end something has to give and it is the name. Asserting the old promise
  // here would have forced one of: shrinking type, inventing a breakpoint, or
  // hiding a menu and making views unreachable. Instead the cost is measured,
  // published, and put in front of Tommy, who has already been told twice why
  // this name matters.
  { observationOnly: "the name's shedding is a measured cost of removing the dial, and it is Tommy's call, not a gate" },
);

console.log("8. the two levels of highlight, read out of the DOM");
await setViewport(1440, 1000);
await installToolkit();
const readHighlight = async (what) => {
  const bar = await evaluate(`window.__u1.viewMenus()`);
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  const design = await evaluate(`window.__u1.openMenuEntries()`);
  await clickSelector('[data-view-menu="design"]', "the Design menu");
  await sleep(200);
  await clickSelector('[data-view-menu="view"]', "the View menu");
  const view = await evaluate(`window.__u1.openMenuEntries()`);
  await clickSelector('[data-view-menu="view"]', "the View menu");
  await sleep(200);
  return { what, bar, design, view };
};
const flat = (groups) => groups.flatMap((g) => g.entries);
await selectStopByMenu("2D Floor Plan");
const onPlan = await readHighlight("2D Floor Plan");
await selectStopByMenu("3D Framed");
const on3d = await readHighlight("3D Framed");
await shot("built-owner-rule-3d-framed");
await selectSubjectByMenu("roof");
const onRoof = await readHighlight("the Roof editor");
await selectStopByMenu("2D Floor Plan");
evidence.highlightStates = { onPlan, on3d, onRoof };

record(
  "LEVEL-ONE-the-bar-highlights-the-OWNING-menu-and-says-so-accessibly",
  {
    onPlan: { design: { owner: onPlan.bar.design.owner, current: onPlan.bar.design.current, boxShadow: onPlan.bar.design.boxShadow, title: onPlan.bar.design.title }, view: { owner: onPlan.bar.view.owner, current: onPlan.bar.view.current, boxShadow: onPlan.bar.view.boxShadow } },
    on3dFramed: { design: { owner: on3d.bar.design.owner, current: on3d.bar.design.current, boxShadow: on3d.bar.design.boxShadow }, view: { owner: on3d.bar.view.owner, current: on3d.bar.view.current, boxShadow: on3d.bar.view.boxShadow, title: on3d.bar.view.title } },
    onRoof: { design: { owner: onRoof.bar.design.owner, current: onRoof.bar.design.current, title: onRoof.bar.design.title }, view: { owner: onRoof.bar.view.owner, current: onRoof.bar.view.current } },
    designWidths: [onPlan.bar.design.w, on3d.bar.design.w, onRoof.bar.design.w],
    viewWidths: [onPlan.bar.view.w, on3d.bar.view.w, onRoof.bar.view.w],
  },
  // ⚠ ITS OWN ACCEPTANCE CRITERION, separate from level two below, because they
  // are two different controls carrying two different facts.
  //  - Exactly one menu is marked in each state, and it is the one that owns.
  //  - The state reaches a screen reader: `aria-current="true"`, not colour.
  //    (It was `aria-pressed` until 2026-09-29 — wrong for a button that opens
  //    a menu rather than toggling; the reasoning is in TopBar.tsx.)
  //  - The sighted cue is MORE THAN COLOUR: an inset underline, which a
  //    non-owner does not have.
  //  - Design owns on the Roof editor, because editing a roof IS designing —
  //    and because Design is the only way back, so it must never be the
  //    unhighlighted, forgotten door.
  //  - And the widths do not move between states: ownership changing may not
  //    reflow the bar, which is why the marker is an underline and not weight.
  (d) =>
    d.onPlan.design.owner === true &&
    d.onPlan.design.current === "true" &&
    d.onPlan.view.current === null &&
    d.onPlan.design.boxShadow !== "none" &&
    d.onPlan.view.boxShadow === "none" &&
    d.on3dFramed.view.owner === true &&
    d.on3dFramed.view.current === "true" &&
    d.on3dFramed.design.current === null &&
    d.on3dFramed.view.boxShadow !== "none" &&
    d.onRoof.design.owner === true &&
    d.onRoof.design.current === "true" &&
    d.onRoof.view.current === null &&
    new Set(d.designWidths).size === 1 &&
    new Set(d.viewWidths).size === 1,
);

record(
  "LEVEL-TWO-the-open-menu-marks-the-CURRENT-stop-with-aria-current-and-more-than-colour",
  {
    onPlan: {
      designMarked: flat(onPlan.design).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
      viewMarked: flat(onPlan.view).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
      markedStyle: flat(onPlan.design).find((e) => e.ariaCurrent === "true") ?? null,
      unmarkedStyle: flat(onPlan.design).find((e) => e.ariaCurrent !== "true") ?? null,
    },
    on3dFramed: {
      designMarked: flat(on3d.design).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
      viewMarked: flat(on3d.view).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
    },
    onRoof: {
      designMarked: flat(onRoof.design).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
      designMarkedKinds: flat(onRoof.design).filter((e) => e.ariaCurrent === "true").map((e) => e.kind),
      viewMarked: flat(onRoof.view).filter((e) => e.ariaCurrent === "true").map((e) => e.label),
    },
    // The bar's harness-only current-stop attribute must agree with the entry
    // the user can actually see marked — otherwise this harness is reading a
    // second, private truth.
    attrAgreesOnPlan: onPlan.bar.design.currentStopAttr,
    attrAgreesOn3d: on3d.bar.view.currentStopAttr,
    attrOnRoof: onRoof.bar.design.currentStopAttr,
  },
  // ⚠ ITS OWN ACCEPTANCE CRITERION.
  //  - Exactly ONE entry is marked, in the owning menu, and none in the other.
  //  - It is marked with `aria-current`, not colour alone, and the sighted cue
  //    differs from an unmarked sibling in weight and an edge bar as well as
  //    colour.
  //  - On the Roof editor the marked entry is the SUBJECT, and no stop is
  //    marked at all: marking `Elevation: CD` while roof tools are on screen
  //    would be a statement about somewhere the user is not.
  //  - The harness's own attribute reads the same stop the user sees marked,
  //    and reads nothing at all when no stop is on screen.
  (d) =>
    JSON.stringify(d.onPlan.designMarked) === JSON.stringify(["2D Floor Plan"]) &&
    d.onPlan.viewMarked.length === 0 &&
    d.onPlan.markedStyle !== null &&
    d.onPlan.unmarkedStyle !== null &&
    d.onPlan.markedStyle.fontWeight !== d.onPlan.unmarkedStyle.fontWeight &&
    d.onPlan.markedStyle.boxShadow !== d.onPlan.unmarkedStyle.boxShadow &&
    JSON.stringify(d.on3dFramed.viewMarked) === JSON.stringify(["3D Framed"]) &&
    d.on3dFramed.designMarked.length === 0 &&
    JSON.stringify(d.onRoof.designMarked) === JSON.stringify(["Roof"]) &&
    JSON.stringify(d.onRoof.designMarkedKinds) === JSON.stringify(["subject"]) &&
    d.onRoof.viewMarked.length === 0 &&
    d.attrAgreesOnPlan === "2D Floor Plan" &&
    d.attrAgreesOn3d === "3D Framed" &&
    d.attrOnRoof === null,
);

console.log("9. the menus work under a real mouse, at 360, 710 and 1280");
const realMouse = [];
for (const w of [360, 710, 1280]) {
  await setViewport(w, 900);
  await installToolkit();
  await selectStopByMenu("2D Floor Plan");
  const before = await evaluate(`window.__u1.viewMenus().design.currentStopAttr`);
  // A real press and release at the button's own coordinates, not an element
  // dispatch: this is the one harness whose subject is this control, and an
  // element dispatch cannot tell a hit-testable control from one sitting under
  // something else.
  await clickSelector('[data-view-menu="view"]', "the View menu");
  const opened = await evaluate(`document.querySelector('[data-view-menu="view"]').getAttribute('aria-expanded')`);
  const at = await evaluate(`(() => {
    const el = [...document.querySelectorAll('[data-view-stop]')].find((e) => e.textContent.trim() === 'Membranes');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (at) await click(at.x, at.y);
  await sleep(700);
  const after = await evaluate(`window.__u1.viewMenus().view.currentStopAttr`);
  realMouse.push({ width: w, before, menuOpened: opened, membranesClickable: Boolean(at), after });
  await selectStopByMenu("2D Floor Plan");
}
evidence.realMouse = realMouse;
record(
  "a-real-mouse-reaches-Membranes-from-the-bar-at-360-710-and-1280",
  { realMouse },
  // 710 is Tommy's own viewport. 360 is phone portrait, which is DEMO ONLY in
  // the declared range — but "demo only" has to mean "it works and is cramped",
  // not "it silently cannot get there", and with the dial gone this is the only
  // door to Membranes at any width.
  (d) =>
    d.realMouse.every(
      (r) => r.menuOpened === "true" && r.membranesClickable === true && r.after === "Membranes",
    ),
);

console.log("10. Region 3's signature at every stop — the single-writer test");
/**
 * ⚠ HOW THE PROOF CHANGED WHEN THE DIAL WENT, AND AGAIN AT U3.
 *
 * U1 proved one writer two ways: ACROSS the change (Region 3's signature at
 * every stop, recorded off the DIAL before U1, compared against the menus
 * after) and WITHIN one run (the dial at one width vs the menus at another, on
 * one design, byte for byte). The second half became impossible when the dial
 * was removed — there is no second control to compare against — and was
 * replaced by the TWO-PATH comparison below: each stop is reached twice, once
 * directly and once after a detour through a stop of the other kind, and
 * Region 3 must be byte-for-byte identical both times. That is the half the
 * cross-run comparison could not make (it normalised digits away), and it
 * catches precisely the failure the plan names as most likely — `showWraps`
 * left true on a plan view arrived at from 3D — because the detour is what
 * sets those flags in the first place.
 *
 * ⚠⚠ **`region3-baseline.json` IS RETIRED AT U3, BY A DECISION TAKEN IN
 * ADVANCE**, recorded in this harness's own README ("What happens to
 * region3-baseline.json at U3 and U5 — decide now, not then") and in the spec.
 * The reason it was decided early is that nobody decides it calmly on the day
 * a red run blocks a merge: it is a recording of Region 3 as driven by the
 * **view dial**, which no longer exists, so once it stops matching the only
 * honest move is to retire it — regenerating it off the menus would turn a
 * two-control comparison into a self-comparison that passes by construction
 * while still looking like the strongest check in the file.
 *
 * **It was still GREEN when it was retired, and that is recorded rather than
 * glossed.** U3 moved Site Properties and the Panelizer into Settings and
 * touched none of the four view flags, so the comparison passed one last time
 * on 2026-09-29 — all 8 stops, zero differences — and that run is in this
 * repository's history, in the commit before the one that removed it. The
 * retirement is therefore a deliberate simplification, not a red check being
 * deleted to go green.
 *
 * **The file itself is KEPT, not deleted**: it is the only recording of
 * Region 3 as a control other than these menus produced it, and it can never
 * be re-made. It is simply no longer asserted against.
 */
const stopSignatures = {};
if (PASS === "projection") {
  throw new Error("the projection pass records Region 3 off the dial, which no longer exists");
}
await setViewport(1440, 1000);
await installToolkit();
/* The stop list now comes from the MENUS THEMSELVES — the labels read out of
   the open Design and View menus in step 5 — rather than from the retired
   baseline's key set. Deduplicated because a stop reachable from both menus
   would otherwise be walked twice. */
/**
 * ⚠ THE STOP COUNT, PINNED — it is the number `region3-baseline.json` used to
 * hold by listing its 8 keys, and after that file was retired at U3 nothing
 * else in this harness held it. Eight is `2D Floor Plan` + four wall
 * elevations + `3D Boxes` + `3D Framed` + `Membranes` on the rectangle step 1
 * draws. If a stop is legitimately added or removed, this number moves WITH
 * the change and says so; it does not get to drift on its own.
 */
const EXPECTED_VIEW_STOPS = 8;
const compared = [...new Set(allStopLabels)];
for (const label of compared) {
  if (!(await selectStopByMenu(label))) throw new Error(`could not reach ${label} from the bar menus`);
  stopSignatures[label] = await evaluate(`window.__u1.region3()`);
}

const twoPath = [];
const detourFor = (label) => (label.startsWith("3D") || label === "Membranes" ? "2D Floor Plan" : "3D Boxes");
for (const label of compared) {
  if (!(await selectStopByMenu(label))) throw new Error(`could not return to ${label}`);
  const direct = (await evaluate(`window.__u1.region3()`)).signature;
  const detour = detourFor(label);
  if (!(await selectStopByMenu(detour))) throw new Error(`could not detour via ${detour}`);
  if (!(await selectStopByMenu(label))) throw new Error(`could not come back to ${label} from ${detour}`);
  const viaDetour = (await evaluate(`window.__u1.region3()`)).signature;
  twoPath.push({
    label,
    detour,
    identical: direct === viaDetour,
    firstDifference: direct === viaDetour ? null : firstDifferingLine(direct, viaDetour),
  });
}
record(
  "the-same-stop-reached-two-ways-leaves-region-3-byte-for-byte-identical",
  {
    twoPath,
    comparedOn: "the full signature, digits included",
    stops: twoPath.length,
    comparedLabels: compared,
    expectedStops: EXPECTED_VIEW_STOPS,
  },
  // THE SINGLE-WRITER TEST, HALF TWO, REBUILT. One design, one run, one
  // control — so the comparison can be exact rather than shape-only. Every stop
  // is visited directly and again after a detour through the OTHER menu, which
  // is what writes `showWraps` / `simplified3D` / `elevationViewWallId` in the
  // first place. Any difference at all — a digit, a pressed state, a section
  // present one way and not the other — is `handleViewerStopChange` not being
  // the only writer, or not being idempotent about the flags it does not own.
  // ⚠ A HARD PIN, NOT A FLOOR — restored 2026-09-29 at U3's review. The
  // retired `region3-baseline` step asserted exactly its 8 keys; once it went,
  // a `>= 6` floor was the only thing left holding the count, and a run that
  // quietly walked two stops fewer would have gone green on every other
  // assertion in this file. THE COUNT IS PART OF THE CHECK.
  (d) =>
    d.stops === EXPECTED_VIEW_STOPS &&
    d.comparedLabels.length === EXPECTED_VIEW_STOPS &&
    d.twoPath.every((t) => t.identical === true),
);

function firstDifferingLine(a, b) {
  const la = a.split("\n"), lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return { line: i, baseline: la[i] ?? "(end)", now: lb[i] ?? "(end)" };
  }
  return null;
}

/** Pick a stop from whichever bar menu offers it. Returns false if neither
 * does — which is itself a finding, never a skip. */
async function selectStopByMenu(label) {
  for (const menu of ["design", "view"]) {
    await clickSelector(`[data-view-menu="${menu}"]`, `the ${menu} menu`).catch(() => {});
    const at = await evaluate(`(() => {
      const el = [...document.querySelectorAll('[data-view-stop]')].find((e) => e.textContent.replace(/\\s+/g,' ').trim() === ${JSON.stringify(label)});
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (at) {
      await click(at.x, at.y);
      await sleep(600);
      return true;
    }
    // Close the menu we opened and could not use, so the next one is not
    // stacked under it.
    await evaluate(`(() => { const b = document.querySelector('[data-view-menu="${menu}"]'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); })()`);
    await sleep(250);
  }
  return false;
}

/** Pick a design subject — the replacement for clicking a bar tab, which no
 * longer exists. */
async function selectSubjectByMenu(subject) {
  await clickSelector('[data-view-menu="design"]', "the Design menu").catch(() => {});
  const at = await evaluate(`(() => {
    const el = document.querySelector('[data-design-subject=${JSON.stringify(subject)}]');
    if (!el) return null;
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`the Design menu offers no "${subject}" subject — is it in the scope of work?`);
  await click(at.x, at.y);
  await sleep(700);
  return true;
}

record(
  "no-uncaught-exception-anywhere-in-the-run",
  { pageExceptions },
  (d) => d.pageExceptions.length === 0,
);

if (PROVE_FAILURE) {
  record(
    "PROVE_FAILURE-this-check-is-deliberately-false",
    { deliberate: true },
    // Both outcomes measured. With UI_REORG_U1_PROVE_FAILURE=1 the run must
    // exit 1 — a harness nobody has watched fail is not evidence.
    () => false,
  );
}

writeEvidence();
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall assertions passed");
process.exit(0);
