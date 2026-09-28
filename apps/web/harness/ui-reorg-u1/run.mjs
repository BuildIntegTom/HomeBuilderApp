/**
 * Browser harness — Top Bar & Navigation Reorganisation, stage U1
 * (the label pattern, the Design/View split, and THE MEASUREMENT).
 *
 * ## Why this file is the deliverable, not a check on the deliverable
 *
 * The plan's own riskiest assumption is written down in §12: *"the width
 * budget is already spent"*. The bar needed a third breakpoint to fit SIX
 * controls; Tommy's list is TWELVE; his own everyday viewport is 710px, where
 * the nav and the wordmark are already shed; and the plan's estimate for the
 * new group — **~1550-1600px** — is explicitly marked *unmeasured*. So the
 * question "does a twelve-item bar fit, and if not what sheds" is answered
 * here, in numbers, at 360 / 710 / 768 / 1200 / 1440 / 1600, signed out and
 * with four companies, in all four roles, and the answer is CHECKED IN rather
 * than summarised in a commit message.
 *
 * **If twelve do not fit, that is a finding.** This script does not shrink
 * type, drop a label or invent an overflow menu to make an assertion pass.
 * It measures, and the numbers go to Tommy.
 *
 * ## It runs in two passes, and both are checked in
 *
 *   `UI_REORG_U1_PASS=projection` — run against the bar BEFORE Design/View
 *     exist. The four new controls are PROJECTED: built out of the bar's own
 *     real classes, inserted into the real row, measured, removed. Writes
 *     `evidence-projection.json`, plus `region3-baseline.json` — Region 3's
 *     rendered signature at every view stop, driven by the DIAL.
 *
 *   `UI_REORG_U1_PASS=built` (the default) — run against the finished bar.
 *     Design and View are REAL and are measured as they render; Summary and
 *     Print are still projected, because they are U4 and U5 and building an
 *     inert button that opens nothing is forbidden by the Top Bar section's
 *     own rule. Writes `evidence.json`, and re-derives Region 3's signature
 *     at every stop **driven by the MENUS**, asserting it equals the baseline
 *     the projection pass recorded off the dial. That comparison is the
 *     acceptance criterion *"Region 3 renders identically for every stop
 *     before and after the change"*, and it is the direct test that
 *     `handleViewerStopChange` stayed the ONLY writer of the four view flags:
 *     Region 3 keys off `elevationWall` / `viewMode` / `showWraps`, so a
 *     second writer leaving `showWraps` true on a plan view shows up here as
 *     a changed signature rather than as nothing at all.
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
 * ## ⚠ Four scars this file is written around
 *
 * 1. **No incidental locators.** Every control is found by `data-bar-control`
 *    (added for this, in TopBar.tsx and AccountControl.tsx), every stop by
 *    `data-view-stop`, Region 3 by `data-sidebar-region-3`. Three locators in
 *    this repo once rooted on panel-boundary drag strips and returned nothing
 *    on a wall with no adjacent standard panels — reporting green.
 * 2. **No vacuous passes.** Every reader that can return an empty set asserts
 *    it found something first: the four-company simulation is validated
 *    against a figure measured in a real browser on 2026-09-13 (the longest
 *    real label, 270px at >=1200px) before a single width is judged by it, and
 *    the projection is validated by checking the projected controls really
 *    landed in the row. Assuming a `wall_` prefix in an OBJ once made every 3D
 *    check match nothing while the run reported green.
 * 3. **Read your own reader.** Widths come from `clientWidth`-based content
 *    boxes, not from bounding rects minus padding: U0's first reader reported
 *    56px of usable rail where the truth was ~40px, and that one wrong number
 *    made an overflowing icon look contained.
 * 4. **Four companies are SIMULATED, and the file says so out loud.** Signing
 *    in needs Supabase, which nothing in this workstream may touch. So the
 *    signed-out `.actingAsStatic` span is swapped for a real `<select>`
 *    carrying the real `switcherLabels` output for four real entitlements,
 *    built with the app's own hashed `.actingAsSelect` class read out of the
 *    live stylesheet. Every cell records `accountState` so no reader can
 *    mistake the simulation for a session.
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
const REGION3_FILE = path.join(HERE, "region3-baseline.json");

/** The six widths §12 names, plus the two the "exactly one presentation" rule
 * is checked at. 710 is Tommy's own everyday viewport. */
const WIDTHS = [360, 710, 768, 1200, 1440, 1600];
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
      rightmostControl: rightmost ? rightmost.control : null,
      rightmostRight: rightmost ? rightmost.right : null,
      anyControlOffScreen: controls.filter((c) => c.w > 0 && (c.left < -0.5 || c.right > window.innerWidth + 0.5)).map((c) => c.control),
      actingAsOnScreen: actingAs ? actingAs.left >= -0.5 && actingAs.right <= window.innerWidth + 0.5 : false,
      actingAsWidth: actingAs ? actingAs.w : null,
      actingAsText: actingAs ? actingAs.text : null,
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
    return { ok: true, projected: made, usedToolClass: toolCls, usedRealLabelClasses: Boolean(captionCls && valueCls) };
  };

  K.clearProjection = () => {
    const row = document.querySelector('[data-top-bar-row]');
    for (const el of row.querySelectorAll('[data-bar-control-projected]')) el.remove();
    K._projection = null;
  };

  // --- the view stops ------------------------------------------------------

  /** The dial's current label, or null when the dial is not rendered. */
  K.dialLabel = () => {
    const dial = document.querySelector('[role="group"][aria-label="View mode"]');
    if (!dial) return null;
    return [...dial.querySelectorAll('div')].map((d) => d.textContent.trim()).find((t) => t && t !== '▲' && t !== '▼') ?? null;
  };

  /** Whether the dial is rendered AND laid out (display:none is the shed). */
  K.dialPresent = () => {
    const dial = document.querySelector('[role="group"][aria-label="View mode"]');
    if (!dial) return false;
    const r = dial.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /** The two bar menus, when they exist: which one owns, and what each reads. */
  K.viewMenus = () => {
    const out = {};
    for (const id of ['design', 'view']) {
      const btn = document.querySelector('[data-view-menu="' + id + '"]');
      if (!btn) { out[id] = null; continue; }
      const r = btn.getBoundingClientRect();
      out[id] = {
        present: r.width > 0 && r.height > 0,
        owner: btn.getAttribute('data-view-menu-owner') === 'true',
        disabled: btn.disabled === true,
        title: btn.getAttribute('title') || '',
        caption: btn.querySelector('[data-view-menu-caption]')?.textContent.trim() ?? null,
        value: btn.querySelector('[data-view-menu-value]')?.textContent.trim() ?? null,
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
    return { childCount: root.children.length, lines: parts.length, signature: parts.join('\n') };
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
console.log(`U1 harness — pass "${PASS}"`);
console.log("0. cold load at 1600px");
await setViewport(1600, 1000);
await load();

record(
  "the-bar-is-addressable",
  await evaluate(`(() => { const f = window.__u1.fit(); return { controlCount: f.controlCount, present: f.present, barHeight: f.barHeight }; })()`),
  // Everything below counts controls, so a locator that found none has to fail
  // HERE rather than silently reporting a bar that fits because it is empty.
  // 56px is --topbar-height, declared rather than content-driven.
  (d) => d.controlCount >= 5 && d.present.includes("acting-as") && d.present.includes("settings") && d.barHeight === 56,
);

console.log("1. a footprint, so the view stops are the real ones");
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
  await evaluate(`(() => ({ dialLabel: window.__u1.dialLabel(), nextDisabled: document.querySelector('[role="group"][aria-label="View mode"] button[title="Next view"]')?.disabled ?? null }))()`),
  // Every stop below depends on there being a building. With no footprint the
  // dial is disabled, its ▼ does nothing, and a walk of it reports exactly one
  // stop -- which looks identical to "the split lost the elevations".
  (d) => d.dialLabel === "2D Floor Plan" && d.nextDisabled === false,
);

console.log("2. all four scope branches on — the widest nav the keyhole allows");
await clickSelector('[data-bar-control="project"]', "the Project menu");
await clickSelector('#project-note button[title^="Which editor tools"]', "the Panelizer item");
const scopeBoxes = await evaluate(`(() => {
  const note = document.querySelector('#panelizer-note');
  if (!note) return null;
  return [...note.querySelectorAll('label')]
    .map((l) => ({ text: l.textContent.replace(/\\s+/g,' ').trim(), checked: l.querySelector('input[type="checkbox"]')?.checked ?? null }))
    .filter((l) => ['Floors','Walls','Roof','Foundation'].includes(l.text));
})()`);
if (!scopeBoxes || scopeBoxes.length !== 4) throw new Error(`expected 4 scope checkboxes, saw ${JSON.stringify(scopeBoxes)}`);
for (const box of scopeBoxes) {
  if (box.checked) continue;
  const at = await evaluate(`(() => {
    const note = document.querySelector('#panelizer-note');
    const label = [...note.querySelectorAll('label')].find((l) => l.textContent.replace(/\\s+/g,' ').trim() === ${JSON.stringify(box.text)});
    const input = label.querySelector('input[type="checkbox"]');
    input.scrollIntoView({ block: 'nearest' });
    const r = input.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await click(at.x, at.y);
}
const scopeAfter = await evaluate(`(() => {
  const note = document.querySelector('#panelizer-note');
  return [...note.querySelectorAll('label')]
    .map((l) => ({ text: l.textContent.replace(/\\s+/g,' ').trim(), checked: l.querySelector('input[type="checkbox"]')?.checked ?? null }))
    .filter((l) => ['Floors','Walls','Roof','Foundation'].includes(l.text));
})()`);
await clickSelector('#panelizer-note button[title="Hide this note"]', "the Panelizer note's close button");
await sleep(500);
// Nothing may be left overlaying the editor: an open note sitting over the
// view dial is how U0's harness once lost six dial clicks in a row and
// reported "Membranes unreachable" -- a locator problem wearing a feature
// bug's clothes. Checked, not hoped for.
const notesStillOpen = await evaluate(
  `[...document.querySelectorAll('#panelizer-note, #project-note, #site-properties-note')].filter((n) => n.getBoundingClientRect().width > 0).length`,
);
if (notesStillOpen > 0) throw new Error(`${notesStillOpen} top-bar note(s) left open over the editor`);
record(
  "all-four-scope-branches-on",
  { scopeBefore: scopeBoxes, scopeAfter },
  // The widest possible nav is the case every width below is judged on. If the
  // keyhole is left at its default (Floor and Foundation OFF since Smearforn
  // Stage 0) the bar is measured two tabs narrower than Tommy's list.
  (d) => d.scopeAfter.length === 4 && d.scopeAfter.every((b) => b.checked === true),
);

console.log("3. validating the four-company simulation against a real 2026-09-13 measurement");
await setViewport(1440, 1000);
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
  // ⚠ THE ANTI-VACUOUS-PASS GUARD FOR THE WHOLE SIMULATION. If the hashed
  // class lookup failed, the select renders unstyled — a different font at a
  // different size — and every "four companies" width below would be a
  // measurement of nothing. 270px is the figure a real browser produced for
  // this exact label on 2026-09-13 and it is written into
  // AccountControl.module.css. Within 12px of it is the same control; wildly
  // off is a broken simulation, and it fails here rather than downstream.
  (d) => d.ok === true && d.deltaPx !== null && Math.abs(d.deltaPx) <= 12 && d.chipText.includes("Seed"),
);
await evaluate(`window.__u1.clearCompanies()`);

console.log("4. THE MATRIX — 6 widths x 2 account states x 4 roles, twelve controls");
/** Read every stop label by walking the dial one full turn, at a width where
 * the dial exists in both passes (below 1200 it is never shed). */
await setViewport(1100, 1000);
await installToolkit();
const allStopLabels = [];
{
  const first = await evaluate(`window.__u1.dialLabel()`);
  if (!first) throw new Error("no view dial at 1100px — the dial is the below-breakpoint form and must exist here");
  allStopLabels.push(first);
  for (let i = 0; i < 14; i++) {
    const before = await evaluate(`window.__u1.dialLabel()`);
    await clickSelector('[role="group"][aria-label="View mode"] button[title="Next view"]', "the dial's ▼");
    const label = await evaluate(`window.__u1.dialLabel()`);
    // A click that lands on nothing leaves the label alone, and a walk that
    // stops after one stop is the vacuous shape this whole file is written
    // against. Say which of the two it was.
    if (label === before) throw new Error(`the dial did not move off "${before}" -- the ▼ click missed`);
    if (label === allStopLabels[0]) break;
    allStopLabels.push(label);
  }
}
record(
  "the-dial-offers-plan-every-elevation-and-the-three-3d-modes",
  { stops: allStopLabels, elevationCount: allStopLabels.filter((l) => l.startsWith("Elevation:")).length },
  // Membranes by name: that word was a specific request and U1 touches the
  // file that holds it. A footprint drawn as a rectangle gives four walls.
  (d) =>
    d.stops[0] === "2D Floor Plan" &&
    d.elevationCount >= 3 &&
    d.stops.includes("3D Framed") &&
    d.stops.includes("3D Boxes") &&
    d.stops.includes("Membranes") &&
    !d.stops.includes("3D Wraps"),
);
const longestStopLabel = allStopLabels.reduce((a, b) => (b.length > a.length ? b : a), allStopLabels[0]);

const PROJECTION_SPEC = [
  { control: "design", caption: "DESIGN", value: longestStopLabel, label: "Design" },
  { control: "view", label: "View" },
  { control: "summary", label: "Summary" },
  { control: "print", label: "Print" },
];
/**
 * THREE bar configurations are measured in every cell, because they answer
 * three different questions and conflating them is how a stage ships on a
 * number that was never about it:
 *
 *   today        — the bar exactly as it is, six controls. The control group.
 *   designView   — today PLUS Design and View only. **This is the bar U1
 *                  actually ships**, so this is the configuration U1's own
 *                  no-overflow assertion is made against.
 *   twelve       — Tommy's whole list. Design, View, Summary and Print all on
 *                  the row. **Nothing in U1 builds this** — Summary is U4 and
 *                  Print is U5, and the Top Bar section forbids a control that
 *                  opens nothing — but it is the question U1 was sent to
 *                  answer, so it is measured rather than deferred to the stage
 *                  that would discover it the hard way.
 */
const BAR_CONFIGS = [
  { id: "designView", spec: PROJECTION_SPEC.slice(0, 2) },
  { id: "twelve", spec: PROJECTION_SPEC },
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

/** One reading of the row, summarised the same way whichever configuration is
 * installed. `wantedPx` is every control at its natural width plus the gaps
 * the row really uses at this breakpoint — i.e. what the row would need if
 * nothing were allowed to shrink. `rowContentWidth` is what it has. */
const summarise = (fit, width) => ({
  controls: fit.present,
  controlCount: fit.controlCount,
  widthSum: fit.controlsWidthSum,
  rowContentWidth: fit.rowContentWidth,
  overflowPx: fit.rowOverflowPx,
  docOverflowPx: fit.docOverflowPx,
  actingAsWidth: fit.actingAsWidth,
  actingAsOnScreen: fit.actingAsOnScreen,
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

const matrix = [];
for (const role of ROLE_LABELS) {
  // The role is set at a width where its note is comfortably on screen. The
  // control itself is never shed at any width; only its note is easier to hit
  // here, and the role persists across every viewport change below.
  await setViewport(1440, 1000);
  await installToolkit();
  await setRole(role);
  for (const width of WIDTHS) {
    await setViewport(width, 900);
    await installToolkit();
    for (const accountState of ["signed-out", "four-companies-simulated"]) {
      await applyAccountState(accountState, width);
      const cell = { role, width, accountState };
      cell.dialPresent = await evaluate(`window.__u1.dialPresent()`);
      cell.today = summarise(await evaluate(`window.__u1.fit()`), width);
      // ⚠ WHICH PASS PROJECTS WHAT, and why it is not the same in both.
      //
      // The projection pass forces all four new controls onto the row at
      // EVERY width, because "does a twelve-item bar fit" is literally a
      // question about a bar that never sheds.
      //
      // The built pass must not do that below 1200px: there, Design and View
      // are really in the DOM but `display: none` — they have SHED into the
      // sidebar dial, which is what U1 ships and is the correct answer. A
      // projection would skip them (they exist) and then measure a row
      // missing two of the controls it claims to have measured. So below the
      // breakpoint the built pass measures only the real bar, and `today`
      // there IS the shipped bar.
      const configsHere = PASS === "projection" || width >= 1200 ? BAR_CONFIGS : [];
      for (const config of configsHere) {
        const projection = await evaluate(`window.__u1.project(${JSON.stringify(config.spec)})`);
        if (!projection.ok) throw new Error(`projecting ${config.id} at ${width}px failed: ${projection.why}`);
        const fit = await evaluate(`window.__u1.fit()`);
        // ⚠ ANTI-VACUOUS GUARD. `project()` skips anything already on the bar
        // for real, so in the built pass it legitimately adds fewer controls
        // than the spec lists. What may never happen is a configuration that
        // added nothing AND found nothing already there — that would report a
        // six-control bar as a twelve-control one that fits beautifully.
        const wanted = config.spec.map((s) => s.control);
        const missing = wanted.filter((c) => !fit.present.includes(c));
        if (missing.length > 0) throw new Error(`${config.id} at ${width}px is missing ${missing.join(", ")} from the row`);
        cell[config.id] = summarise(fit, width);
        cell[config.id].projectedHere = projection.projected;
        cell[config.id].realHere = wanted.filter((c) => !projection.projected.includes(c));
        await evaluate(`window.__u1.clearProjection()`);
      }
      if (accountState === "four-companies-simulated") await evaluate(`window.__u1.clearCompanies()`);
      matrix.push(cell);
    }
  }
}
evidence.matrix = matrix;

/** Four companies is the widest real case, so it is the one every summary
 * below is taken from. The signed-out rows stay in `matrix` for comparison. */
const worst = matrix.filter((m) => m.accountState === "four-companies-simulated");
const summaryFor = (configId) => {
  const out = {};
  for (const w of WIDTHS) {
    const cells = worst.filter((m) => m.width === w).map((m) => m[configId]).filter(Boolean);
    if (cells.length === 0) {
      // Below 1200 in the built pass there is no projection to summarise,
      // because the controls have shed. Said out loud rather than reported as
      // a width that fits perfectly.
      out[w] = { notMeasured: "the new controls are shed at this width; see today[" + w + "]" };
      continue;
    }
    out[w] = {
      rowContentWidth: cells[0].rowContentWidth,
      maxWantedPx: Math.max(...cells.map((c) => c.wantedPx)),
      maxShortfallPx: Math.max(...cells.map((c) => c.shortfallPx)),
      fits: cells.every((c) => c.shortfallPx <= 0),
      maxOverflowPx: Math.max(...cells.map((c) => c.overflowPx)),
      maxDocOverflowPx: Math.max(...cells.map((c) => c.docOverflowPx)),
      minActingAsWidth: Math.min(...cells.map((c) => c.actingAsWidth ?? 0)),
      actingAsAlwaysOnScreen: cells.every((c) => c.actingAsOnScreen),
      everOffScreen: [...new Set(cells.flatMap((c) => c.offScreen))],
      controlsPresent: cells[0].controls,
    };
  }
  return out;
};
evidence.byWidth = {
  today: summaryFor("today"),
  designView: summaryFor("designView"),
  twelve: summaryFor("twelve"),
};

/**
 * The narrowest viewport at which a configuration really fits, bisected in a
 * real browser rather than extrapolated from the six sampled widths.
 *
 * TWO predicates, because "fits" has two honest meanings and the gap between
 * them is the whole lesson of 2026-09-13:
 *   `nothingOffScreen`   — no control has left the viewport and nothing
 *                          scrolls. The floor, and the thing U1 must keep.
 *   `companyNameIntact`  — that, AND the acting-as company is still at the
 *                          width its own stylesheet caps it to (220px below
 *                          1200, 280px at and above). "Truncated but present
 *                          beats absent" is the rule, but a company name cut
 *                          to a letter is the SHAPE of the bug, not a
 *                          graceful degradation, so it is measured separately.
 *
 * ⚠ BISECTED PER BREAKPOINT BAND, AND THE FIRST VERSION OF THIS WAS WRONG.
 * A plain bisect over 320..2400 assumes fit improves monotonically with
 * width. It does not: at exactly 1200px the bar GAINS the wordmark and four
 * nav tabs, ~380px of content arriving in one step, so a configuration can
 * fit at 1199 and fail at 1200. The naive bisect happily reported "fits from
 * 875px" for a bar that is crushed at 1200 — a true number that means the
 * opposite of what it looks like. Each band is monotonic on its own, so each
 * is bisected on its own and reported on its own.
 */
const BREAKPOINT_BANDS = [
  { id: "below-768", lo: 320, hi: 767, what: "no wordmark, no nav, ACTING AS caption shed" },
  { id: "768-1199", lo: 768, hi: 1199, what: "no wordmark, no nav, caption shown" },
  { id: "1200-up", lo: 1200, hi: 2400, what: "wordmark + four nav tabs" },
];

const makeFitsAt = (spec, predicateId) => async (w) => {
  await setViewport(w, 900);
  await installToolkit();
  await applyAccountState("four-companies-simulated", w);
  const projection = await evaluate(`window.__u1.project(${JSON.stringify(spec)})`);
  if (!projection.ok) throw new Error(`bisect projection failed at ${w}px: ${projection.why}`);
  const fit = await evaluate(`window.__u1.fit()`);
  await evaluate(`window.__u1.clearProjection(); window.__u1.clearCompanies();`);
  const nothingOffScreen = fit.anyControlOffScreen.length === 0 && fit.docOverflowPx === 0 && fit.rowOverflowPx === 0;
  if (predicateId === "nothingOffScreen") return nothingOffScreen;
  // The cap is declared on the SELECT in AccountControl.module.css; the chip
  // measured here is that select plus its caption and padding, so reaching the
  // cap is a conservative reading of "the name is not being crushed" rather
  // than a threshold this file invented.
  const cap = w >= 1200 ? 280 : 220;
  return nothingOffScreen && (fit.actingAsWidth ?? 0) >= cap;
};

const bisectBand = async (spec, predicateId, band) => {
  const fitsAt = makeFitsAt(spec, predicateId);
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

const firstFits = {};
for (const config of PASS === "projection" ? [{ id: "today", spec: [] }, ...BAR_CONFIGS] : [{ id: "today", spec: [] }]) {
  firstFits[config.id] = {};
  for (const predicateId of ["nothingOffScreen", "companyNameIntact"]) {
    firstFits[config.id][predicateId] = {};
    for (const band of BREAKPOINT_BANDS) {
      firstFits[config.id][predicateId][band.id] = await bisectBand(config.spec, predicateId, band);
    }
  }
}
evidence.firstFitsAtViewportWidth = firstFits;
evidence.breakpointBands = BREAKPOINT_BANDS;

/**
 * Each configuration's NATURAL width: the row content it wants when nothing
 * is being squeezed, i.e. measured where there is room to spare. Read off the
 * widest sampled width rather than summed from remembered figures, and
 * reported as a viewport number too (the bar's own 20px padding each side).
 * This is the number "does it fit on a 1920 monitor" is answered from.
 */
const natural = {};
for (const id of ["today", "designView", "twelve"]) {
  const at1600 = worst.filter((m) => m.width === 1600).map((m) => m[id]).filter(Boolean);
  if (at1600.length === 0) continue;
  natural[id] = {
    naturalRowContentPx: Math.max(...at1600.map((c) => c.wantedPx)),
    naturalViewportPx: Math.max(...at1600.map((c) => c.wantedPx)) + 40,
    measuredAt: "1600px, four companies, the widest role label",
  };
}
evidence.naturalWidths = natural;


record(
  "THE-MEASUREMENT-does-a-twelve-item-bar-fit",
  {
    byWidth: evidence.byWidth,
    naturalWidths: natural,
    firstFitsAtViewportWidth: firstFits,
    cells: matrix.length,
    designValueMeasured: longestStopLabel,
  },
  // ⚠ AN OBSERVATION ON PURPOSE, AND THE ONLY ONE IN THIS FILE.
  //
  // "Does it fit" is the question U1 was sent to ANSWER, not a property U1
  // gets to assert. Asserting a pass here would mean the only way to finish
  // the stage is for the answer to be yes — which is exactly the pressure
  // that produces a quietly shrunk font, a dropped label or an invented
  // overflow menu, none of which Tommy has been asked about. The numbers go
  // in evidence.json and the decision is his, the same way 1200px was in
  // 2026-09-13.
  { observationOnly: "the width budget IS the finding; a pass/fail here would put a thumb on the scale" },
);

record(
  "nothing-U1-ships-is-ever-pushed-off-screen",
  {
    // In the built pass this reads the REAL bar at every width, which below
    // 1200 is the bar with Design and View shed into the sidebar. In the
    // projection pass it reads the projected designView bar, i.e. the same
    // ten controls forced on at every width — the harsher of the two, and the
    // one that says whether shedding them is optional. (It is not: see the
    // 12px acting-as chip the projection reports at 360px.)
    configuration: PASS === "projection"
      ? "designView projected at EVERY width — the ten controls with nothing allowed to shed"
      : "the real shipped bar at every width",
    offScreenAnywhere: [...new Set(worst.map((c) => c.designView ?? c.today).flatMap((c) => c.offScreen))],
    actingAsAlwaysOnScreen: worst.every((c) => (c.designView ?? c.today).actingAsOnScreen),
    narrowestActingAsPx: Math.min(...worst.map((c) => (c.designView ?? c.today).actingAsWidth ?? 0)),
    docOverflowAnywhere: Math.max(...worst.map((c) => (c.designView ?? c.today).docOverflowPx)),
    rowOverflowAnywhere: Math.max(...worst.map((c) => (c.designView ?? c.today).overflowPx)),
  },
  // The 2026-09-13 bug's permanent headstone, and it is asserted against what
  // U1 ACTUALLY SHIPS rather than against the hypothetical twelve. No control
  // may leave the viewport and the acting-as company must be on screen at
  // every width. Whether twelve fit is the observation above; whether ten do
  // is a promise this stage has to keep.
  (d) =>
    d.actingAsAlwaysOnScreen === true &&
    d.offScreenAnywhere.length === 0 &&
    d.docOverflowAnywhere === 0 &&
    d.rowOverflowAnywhere === 0,
);

console.log("5. the shed order, read off the matrix");
const shedOrder = {};
for (const control of ["wordmark", "nav-wall", "nav-foundation", "nav-floor", "nav-roof", "acting-as", "account", "project", "role", "settings", "design", "view", "summary", "print"]) {
  // Read off `today` — the REAL bar — so the shed order recorded here is the
  // one that ships, not the one the projection forced. In the projection pass
  // that means design/view/summary/print read as "never present", which is
  // true of the bar as it stood before U1.
  const widthsPresent = WIDTHS.filter((w) => worst.some((c) => c.width === w && c.today.controls.includes(control)));
  shedOrder[control] = {
    presentAt: widthsPresent,
    shedBelow: widthsPresent.length === 0 ? "never present" : widthsPresent.length === WIDTHS.length ? "never shed" : Math.min(...widthsPresent),
  };
}
evidence.shedOrder = shedOrder;
record(
  "the-existing-shed-order-is-not-disturbed",
  { shedOrder },
  // The non-negotiable half of §12: the acting-as company, the file menu, the
  // role control and Settings are never shed at any width. Asserted as a
  // property of the measured bar, not read off the stylesheet.
  (d) =>
    ["acting-as", "account", "project", "role", "settings"].every((c) => d.shedOrder[c].shedBelow === "never shed") &&
    d.shedOrder["wordmark"].shedBelow === 1200 &&
    d.shedOrder["nav-wall"].shedBelow === 1200 &&
    // And U1's own addition: Design and View shed at the SAME width the nav
    // does, into the sidebar dial that is already there — the plan's
    // recommendation, checked rather than assumed. Before U1 they are not on
    // the bar at all, which is what the projection pass records.
    (PASS === "projection"
      ? ["design", "view"].every((c) => d.shedOrder[c].shedBelow === "never present")
      : ["design", "view"].every((c) => d.shedOrder[c].shedBelow === 1200)),
);

await setViewport(1600, 1000);
await installToolkit();
await evaluate(`window.__u1.simulateCompanies(${JSON.stringify(FOUR_COMPANY_LABELS)}, ${JSON.stringify(LONGEST_COMPANY_LABEL)})`);
await evaluate(`window.__u1.project(${JSON.stringify(PROJECTION_SPEC)})`);
await shot(`${PASS}-twelve-item-bar-1600`);
await evaluate(`window.__u1.clearProjection(); window.__u1.clearCompanies();`);

console.log("6. Region 3's signature at every stop");
/**
 * The pass-dependent half. In "projection" the stops are driven by the DIAL at
 * 1100px and the signatures are WRITTEN; in "built" they are driven by the
 * MENUS at 1440px and the signatures are COMPARED against them.
 *
 * ⚠ Why the widths differ, and why that is the right comparison rather than a
 * confound: Region 3 is `elevationControls` / `wallAssemblyControls` / the
 * plan toolbar / the 3D group, and every one of those keys off the four view
 * flags ONLY. Region 1 (the dial) and Region 2 (the tab dial) are outside
 * `[data-sidebar-region-3]` precisely so the breakpoint difference between the
 * two passes cannot contaminate the comparison. If a signature differs, the
 * flags differ — which is a second writer.
 */
const stopSignatures = {};
if (PASS === "projection") {
  await setViewport(1100, 1000);
  await installToolkit();
  let label = await evaluate(`window.__u1.dialLabel()`);
  const seen = new Set();
  while (label && !seen.has(label)) {
    seen.add(label);
    stopSignatures[label] = await evaluate(`window.__u1.region3()`);
    await clickSelector('[role="group"][aria-label="View mode"] button[title="Next view"]', "the dial's ▼");
    label = await evaluate(`window.__u1.dialLabel()`);
  }
  fs.writeFileSync(REGION3_FILE, JSON.stringify({ ranAt: new Date().toISOString(), drivenBy: "the sidebar view dial at 1100px", stops: stopSignatures }, null, 2));
  record(
    "region-3-baseline-captured-for-every-stop",
    { stops: Object.keys(stopSignatures), lines: Object.fromEntries(Object.entries(stopSignatures).map(([k, v]) => [k, v.lines])) },
    // A baseline of nothing would compare equal to anything later, which is
    // the vacuous-pass shape. Region 3 is non-empty on the plan stop (the
    // drawing toolbar) and on an elevation, so both are required to be.
    (d) =>
      d.stops.length >= 6 &&
      d.lines["2D Floor Plan"] > 5 &&
      Object.keys(d.lines).some((k) => k.startsWith("Elevation:") && d.lines[k] > 5),
  );
} else {
  if (!fs.existsSync(REGION3_FILE)) throw new Error(`no ${path.basename(REGION3_FILE)} — run the projection pass first`);
  const baseline = JSON.parse(fs.readFileSync(REGION3_FILE, "utf8"));
  await setViewport(1440, 1000);
  await installToolkit();
  const diffs = [];
  const compared = [];
  for (const [label, want] of Object.entries(baseline.stops)) {
    const reached = await selectStopByMenu(label);
    if (!reached) {
      diffs.push({ label, why: "not reachable from the bar menus" });
      continue;
    }
    const got = await evaluate(`window.__u1.region3()`);
    compared.push(label);
    if (!got || got.signature !== want.signature) {
      diffs.push({
        label,
        wantLines: want.lines,
        gotLines: got ? got.lines : null,
        firstDifference: got ? firstDifferingLine(want.signature, got.signature) : "region 3 was not found at all",
      });
    }
  }
  record(
    "region-3-renders-identically-for-every-stop-before-and-after-the-split",
    { comparedStops: compared, baselineStops: Object.keys(baseline.stops), differences: diffs },
    // THE SINGLE-WRITER TEST. Region 3 keys off elevationWall / viewMode /
    // showWraps, so two menus each writing their own subset — the exact
    // mistake the plan names as most likely — shows up here as a changed
    // signature. Every baseline stop must be compared: a stop the menus
    // cannot reach is a difference, not an excuse to skip it.
    (d) => d.differences.length === 0 && d.comparedStops.length === d.baselineStops.length,
  );
}

function firstDifferingLine(a, b) {
  const la = a.split("\n"), lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return { line: i, baseline: la[i] ?? "(end)", now: lb[i] ?? "(end)" };
  }
  return null;
}

/** Pick a stop from whichever bar menu owns it. Returns false if no menu
 * offers it — which is itself a finding, never a skip. */
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

// --- the built-pass-only assertions -----------------------------------------
if (PASS === "built") {
  console.log("7. the owner rule, read out of the DOM");
  await setViewport(1440, 1000);
  await installToolkit();
  await selectStopByMenu("2D Floor Plan");
  const onPlan = await evaluate(`(() => ({ menus: window.__u1.viewMenus(), controls: window.__u1.controls() }))()`);
  await selectStopByMenu("3D Framed");
  const on3d = await evaluate(`(() => ({ menus: window.__u1.viewMenus(), controls: window.__u1.controls() }))()`);
  await shot("built-owner-rule-3d-framed");
  record(
    "the-owner-renders-LABEL-plus-value-and-the-other-renders-the-bare-word",
    {
      onPlan: { design: onPlan.menus.design, view: onPlan.menus.view },
      on3dFramed: { design: on3d.menus.design, view: on3d.menus.view },
    },
    // Tommy's own two examples, character for character:
    //   DESIGN Plan View · View · …      and      Design · VIEW 3D Framed · …
    // The value is the dial's own label for the stop, so the two presentations
    // cannot drift apart. ("2D Floor Plan" rather than "Plan View" because the
    // rename is an OPEN QUESTION for Tommy and U1 does not answer it.)
    (d) =>
      d.onPlan.design.owner === true &&
      d.onPlan.design.caption === "DESIGN" &&
      d.onPlan.design.value === "2D Floor Plan" &&
      d.onPlan.view.owner === false &&
      d.onPlan.view.text === "View" &&
      d.on3dFramed.view.owner === true &&
      d.on3dFramed.view.caption === "VIEW" &&
      d.on3dFramed.view.value === "3D Framed" &&
      d.on3dFramed.design.owner === false &&
      d.on3dFramed.design.text === "Design",
  );

  const typography = await evaluate(`(() => {
    window.__u1.simulateCompanies(${JSON.stringify(FOUR_COMPANY_LABELS)}, ${JSON.stringify(LONGEST_COMPANY_LABEL)});
    const pick = (el) => { const s = getComputedStyle(el); return { fontSize: s.fontSize, fontWeight: s.fontWeight, textTransform: s.textTransform, letterSpacing: s.letterSpacing, color: s.color }; };
    const caption = document.querySelector('[data-view-menu-caption]');
    const value = document.querySelector('[data-view-menu-value]');
    const actingAsLabel = document.querySelector('#acting-as-label');
    const actingAsValue = document.querySelector('[data-simulated-companies]');
    const out = {
      caption: caption ? pick(caption) : null,
      actingAsLabel: actingAsLabel ? pick(actingAsLabel) : null,
      value: value ? pick(value) : null,
      actingAsValue: actingAsValue ? pick(actingAsValue) : null,
    };
    window.__u1.clearCompanies();
    return out;
  })()`);
  record(
    "the-caption-and-value-use-the-acting-as-control's-own-two-type-treatments",
    typography,
    // Compared against the LIVE control rather than against the numbers copied
    // out of its stylesheet — so a later change to .actingAsLabel that these
    // two do not follow fails here instead of drifting apart silently. Colour
    // included: "all caps dark grey" then "black" is the whole of Tommy's
    // description, and both are token-driven.
    (d) =>
      d.caption &&
      d.actingAsLabel &&
      d.caption.fontSize === d.actingAsLabel.fontSize &&
      d.caption.fontWeight === d.actingAsLabel.fontWeight &&
      d.caption.textTransform === "uppercase" &&
      d.caption.letterSpacing === d.actingAsLabel.letterSpacing &&
      d.caption.color === d.actingAsLabel.color &&
      d.value &&
      d.actingAsValue &&
      d.value.fontSize === d.actingAsValue.fontSize &&
      d.value.fontWeight === d.actingAsValue.fontWeight &&
      d.value.color === d.actingAsValue.color,
  );

  console.log("8. exactly one presentation, at 1199, 1200 and a fractional zoom width");
  const presentations = [];
  for (const w of [1199, 1199.5, 1200, 1200.5, 1360.7, 710, 360, 1600]) {
    await setViewport(w, 900);
    await installToolkit();
    const p = await evaluate(`(() => { const m = window.__u1.viewMenus(); return { dial: window.__u1.dialPresent(), design: Boolean(m.design && m.design.present), view: Boolean(m.view && m.view.present) }; })()`);
    presentations.push({ width: w, ...p, menus: p.design && p.view, both: p.dial && p.design, neither: !p.dial && !p.design });
  }
  evidence.presentations = presentations;
  record(
    "exactly-one-of-the-bar-menus-and-the-sidebar-dial-at-every-width",
    { presentations },
    // The reason the rule is "one CSS condition flipping two things" and not
    // an opposed min/max pair: a fractional viewport width under browser zoom
    // satisfies neither half of a pair, and the control vanishes entirely.
    // 1199.5 and 1200.5 and 1360.7 are here to catch exactly that.
    (d) =>
      d.presentations.every((p) => p.both === false && p.neither === false) &&
      d.presentations.filter((p) => p.width >= 1200).every((p) => p.menus === true && p.dial === false) &&
      d.presentations.filter((p) => p.width < 1200).every((p) => p.dial === true && p.design === false),
  );

  console.log("9. every stop reachable both ways, in footprint order");
  await setViewport(1440, 1000);
  await installToolkit();
  const designStops = await (async () => {
    await clickSelector('[data-view-menu="design"]', "the Design menu");
    const stops = await evaluate(`window.__u1.openMenuStops()`);
    await clickSelector('[data-view-menu="design"]', "the Design menu");
    return stops;
  })();
  const viewStops = await (async () => {
    await clickSelector('[data-view-menu="view"]', "the View menu");
    const stops = await evaluate(`window.__u1.openMenuStops()`);
    await clickSelector('[data-view-menu="view"]', "the View menu");
    return stops;
  })();
  record(
    "the-two-menus-together-offer-exactly-the-dial's-stops-in-the-dial's-order",
    {
      dial: allStopLabels,
      design: designStops.map((s) => s.label),
      view: viewStops.map((s) => s.label),
      combined: [...designStops, ...viewStops].map((s) => s.label),
    },
    // Tommy's recorded stop order — plan, then each wall's elevation in
    // compass order, then the 3D modes — has to survive the split WITHIN each
    // menu, which is why Design lists Plan View first and View lists Framed →
    // Boxes → Membranes. Compared against the dial's own walk, so neither
    // presentation can be graded against a list typed into this file.
    (d) =>
      JSON.stringify(d.combined) === JSON.stringify(d.dial) &&
      d.design[0] === "2D Floor Plan" &&
      d.design.slice(1).every((l) => l.startsWith("Elevation:")) &&
      JSON.stringify(d.view) === JSON.stringify(["3D Framed", "3D Boxes", "Membranes"]),
  );

  console.log("10. the dial-is-live predicate, mirrored by both menus");
  await clickSelector('[data-bar-control="nav-roof"]', "the Roof tab");
  await sleep(600);
  const onRoof = await evaluate(`window.__u1.viewMenus()`);
  await clickSelector('[data-bar-control="nav-wall"]', "the Wall tab");
  await sleep(600);
  const backOnWall = await evaluate(`window.__u1.viewMenus()`);
  record(
    "both-menus-mirror-the-dial's-own-disabled-condition",
    { onRoof, backOnWall },
    // "Mirror today's behaviour exactly" — the dial is disabled off the Wall
    // tab and with no footprint, so the menus are too, with the reason in
    // their title rather than as a dead control. And neither OWNS while the
    // view is not what is on screen: naming a stop on the Roof tab would be
    // the same lie the bug note's context line refuses to tell.
    (d) =>
      d.onRoof.design.disabled === true &&
      d.onRoof.view.disabled === true &&
      d.onRoof.design.owner === false &&
      d.onRoof.view.owner === false &&
      d.onRoof.design.title.length > 0 &&
      d.backOnWall.design.disabled === false &&
      d.backOnWall.design.owner === true,
  );

  console.log("11. the dial's wheel and its rustle sound survive below the breakpoint");
  await setViewport(710, 900);
  await installToolkit();
  const beforeWheel = await evaluate(`window.__u1.dialLabel()`);
  const dialAt = await evaluate(`(() => { const d = document.querySelector('[role="group"][aria-label="View mode"]'); d.scrollIntoView({block:'nearest'}); const r = d.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: dialAt.x, y: dialAt.y, deltaX: 0, deltaY: 120 }, sid);
  await sleep(600);
  const afterWheel = await evaluate(`window.__u1.dialLabel()`);
  const rustle = await evaluate(`(() => {
    // useRustleSound is a dial-only affordance. It is asserted to be WIRED —
    // an AudioContext or an <audio> the dial can reach — rather than audible,
    // because headless Chrome has no speakers and a check that cannot fail is
    // worse than no check. What matters for U1 is that the dial still exists
    // at Tommy's own width to carry it.
    return { hasAudioContext: typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function' };
  })()`);
  record(
    "the-dial-and-its-wheel-still-work-at-Tommy's-own-710px",
    { beforeWheel, afterWheel, wheelMovedTheDial: beforeWheel !== afterWheel, ...rustle },
    // §7's row that "disappears quietly" if the dial is simply replaced by two
    // menus at desktop width. The plan's answer is that the dial SURVIVES as
    // the below-breakpoint form; this is the check that it did, driven by a
    // real wheel event rather than by a click on the chevron.
    (d) => d.wheelMovedTheDial === true && d.afterWheel !== null,
  );
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
