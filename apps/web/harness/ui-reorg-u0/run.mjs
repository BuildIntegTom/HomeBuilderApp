/**
 * Browser harness — Top Bar & Navigation Reorganisation, stage U0
 * (the left-bar icon cluster, and Single Wall Run into Settings).
 *
 * **Why this exists at all.** The failure mode of a navigation change is that
 * something silently stops being reachable: no error, no wrong number, no
 * failing unit test. This app has already paid for that class twice (the
 * account control sitting 677px off-screen while its own comment claimed
 * otherwise). So the thing this harness measures is REACHABILITY, by walking
 * it in a real browser — the same plumbing, `record()` discipline and
 * checked-in `evidence.json`/screenshots as the three `smearforn-stage-*`
 * harnesses next door.
 *
 * What it drives, all of it from a cold load:
 *   1. the bottom-left cluster is four icons, each with a real aria-label AND
 *      title, and it fits inside the sidebar at 240px and at 64px
 *   2. the Review icon opens the Review Log — absent before the click,
 *      present after, so the check cannot pass vacuously
 *   3. the bug icon opens a note whose words are the /report-bug route's own
 *      words: every section of the route is asserted to appear in the note,
 *      the mailto: address is the route's address, and the note carries the
 *      user agent NOWHERE (it is context, not telemetry)
 *   4. the context line names the right surface on plan, on an elevation, on
 *      Membranes and on the Roof subject (where no view stop is on screen and the
 *      line must name only the tab)
 *   5. the Read Me icon opens a note carrying the route's liability statement
 *      verbatim and a QR still wide enough to scan
 *   6. a docked Selected Panel note and an icon's note coexist without the
 *      cluster being pushed out of the sidebar
 *   7. Single Wall Run is reachable from Settings and is gone from the tray —
 *      counted both ways, and /sandbox still resolves
 *   8. `?openNote=review-log` still opens the Review Log with no clicks, which
 *      is the deep link /report-bug's own page depends on
 *   9. no uncaught exception anywhere in the run
 *
 * HOW TO RUN (from the repo root):
 *   1. `npm run dev --workspace=apps/web -- -p 3217`
 *   2. `chrome --headless=new --remote-debugging-port=9457 --user-data-dir=<temp> --window-size=1400,1000 about:blank`
 *      (the window size matters: steps that click the canvas filter to what is
 *      on screen, as the Smearforn harnesses' own notes explain)
 *   3. `node apps/web/harness/ui-reorg-u0/run.mjs`
 *
 * **Use `localhost`, not `127.0.0.1`** — over 127.0.0.1 the dynamic-import
 * chunks never arrive and the canvas silently never appears (Stage 0/1's note).
 *
 * `record()` REFUSES to run without an expectation and the process exits
 * non-zero if any expectation is false. **Both outcomes are measured, not
 * assumed:** `UI_REORG_PROVE_FAILURE=1` adds one deliberately false check at
 * the end, and the run must then exit 1. A harness that has never been seen to
 * fail is not evidence.
 *
 * ⚠ LOCATOR RULE, learned from this repo's own scars. Nothing here is keyed to
 * an incidental element. The cluster is found by `[data-sidebar-icon-cluster]`
 * and its icons by their `aria-label`s; the notes by the `id` `StickyNote`
 * already renders; the context line by `[data-current-view]`. Three locators
 * once rooted on panel-boundary drag strips and returned nothing on a wall
 * with no adjacent standard panels, reporting green. Where this run has to
 * find a panel to click, it ASSERTS it found one.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeViewStopControl } from "../viewStopControl.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.UI_REORG_APP_URL ?? "http://localhost:3217/";
const CDP_PORT = process.env.UI_REORG_CDP_PORT ?? "9457";
const PROVE_FAILURE = process.env.UI_REORG_PROVE_FAILURE === "1";

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = { app: APP_URL, ranAt: new Date().toISOString(), proveFailureMode: PROVE_FAILURE, steps: [] };
const failures = [];
const pageExceptions = [];
/**
 * What the harness had to WAIT FOR, and every click it had to spend twice.
 * Both go into `evidence.json`: a green run that needed a retry says so, rather
 * than recovering in silence and teaching the next reader to trust a silence.
 * Declared up here beside `failures` on purpose — the exit handler reads them,
 * and a crash in the CDP plumbing below must not hit a temporal dead zone.
 */
const editorReady = [];
const iconToggleRetries = [];
const lostSingleClicks = [];

// `record()` also supports the sibling harnesses' `{ observationOnly }` escape
// hatch for a measurement nobody can assert yet. Nothing in this run uses it:
// every step here is a real expectation, which is the point of a reachability
// harness. (No unused helper is declared for it, so this file adds no lint
// warning — the two sibling harnesses each carry one for exactly that reason.)
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
  console.log(`  [${isObservation ? "observed" : passed ? "PASS" : "FAIL"}] ${name}: ${JSON.stringify(detail).slice(0, 400)}`);
};

let evidenceWritten = false;
const writeEvidence = () => {
  if (evidenceWritten) return;
  /**
   * ⚠ A RUN THAT RECORDED NOTHING NEVER OVERWRITES THE LAST ONE THAT DID.
   *
   * `writeEvidence` is on `process.on("exit")` so that a crash mid-run still
   * leaves its partial measurements behind — that part is right, and it is how
   * the `plan: null` failure was diagnosed. But a run that cannot reach the
   * browser throws in the CDP plumbing below before a single `record()`, and
   * this handler then dutifully wrote a ~100-byte stub over a committed
   * measurement. It fired repeatedly across agents on 2026-09-29/30, including
   * over this file's own evidence. An empty evidence file is never worth having
   * and is always worth less than what it replaced. (`ui-reorg-u1` grew the same
   * guard first; this is the file that kept paying for its absence.)
   */
  if (evidence.steps.length === 0) {
    evidenceWritten = true;
    console.log("\nno steps were recorded — leaving the existing evidence file alone");
    return;
  }
  /**
   * ⚠ AND A PROVE-FAILURE RUN NEVER OVERWRITES A REAL ONE EITHER.
   *
   * The guard above only catches a run that recorded NOTHING.
   * `UI_REORG_PROVE_FAILURE=1` records everything and then appends one
   * deliberately false check, so it used to write a deliberately-failing
   * evidence.json over a passing one — marked `proveFailureMode: true`, which is
   * honest but is a flag a reader has to notice, and the checked-in artefact is
   * what people read. The run exists to prove the harness CAN fail, not to
   * produce evidence, so it now produces none.
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
  evidence.editorReady = editorReady;
  evidence.iconToggleRetries = iconToggleRetries;
  evidence.lostSingleClicks = lostSingleClicks;
  fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log("\nevidence -> evidence.json");
};
process.on("exit", writeEvidence);

// --- CDP plumbing (the Smearforn harnesses') --------------------------------
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

/** CSS viewport width, so the ≤600px sidebar rule is really in play rather
 * than being simulated by reading the stylesheet. */
const setViewport = async (width, height = 900) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sid);
  await sleep(500);
};

// --- readers ----------------------------------------------------------------

/**
 * The cluster and its icons, measured against the sidebar's own content box.
 *
 * Keyed to `[data-sidebar-icon-cluster]` and to each button's `aria-label` —
 * both of which exist BECAUSE something has to name them, not incidentally.
 */
const clusterGeometry = async () =>
  await evaluate(`(() => {
    const cluster = document.querySelector('[data-sidebar-icon-cluster]');
    if (!cluster) return { present: false };
    const sidebar = cluster.closest('div[class*="editorSidebar"]');
    const sb = sidebar.getBoundingClientRect();
    const cs = getComputedStyle(sidebar);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    /**
     * ⚠ THE CONTENT BOX IS clientWidth-BASED, NOT rect-BASED. The first version
     * of this reader used the bounding rect minus the paddings and reported 56px
     * of usable width in the 64px rail. The real figure is ~40px: the rail
     * scrolls, and the scrollbar eats ~15px that the bounding rect still
     * counts. That one wrong number made an icon which really does stick out of
     * the sidebar look contained.
     */
    // clientWidth = padding box minus the scrollbar; so the usable content box
    // starts after the left border + left padding and is that wide.
    const contentLeft = sb.left + parseFloat(cs.borderLeftWidth) + padL;
    const contentWidth = sidebar.clientWidth - padL - padR;
    const content = { left: contentLeft, right: contentLeft + contentWidth, top: sb.top, bottom: sb.bottom };
    const icons = [...cluster.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        label: b.getAttribute('aria-label') || '',
        title: b.getAttribute('title') || '',
        x: Math.round((r.left + r.width / 2) * 10) / 10,
        y: Math.round((r.top + r.height / 2) * 10) / 10,
        left: Math.round(r.left * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        top: Math.round(r.top * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
      };
    });
    const overlaps = [];
    for (let i = 0; i < icons.length; i++)
      for (let j = i + 1; j < icons.length; j++) {
        const a = icons[i], b = icons[j];
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5)
          overlaps.push([a.label, b.label]);
      }
    return {
      present: true,
      viewportWidth: window.innerWidth,
      sidebarWidth: Math.round(sb.width),
      contentWidth: Math.round(content.right - content.left),
      icons,
      rows: [...new Set(icons.map((i) => Math.round(i.top)))].length,
      overlaps,
      // Horizontal containment is the real question: the cluster wraps, so
      // nothing may ever stick out sideways past the sidebar's padding box.
      outsideHorizontally: icons.filter((i) => i.left < content.left - 0.5 || i.right > content.right + 0.5).map((i) => i.label),
      clusterScrollOverflowPx: Math.round(cluster.scrollWidth - cluster.clientWidth),
      // Bottom-pinned: the cluster lives in the LAST child of the sidebar.
      inLastSidebarChild: sidebar.lastElementChild.contains(cluster),
      fullyVisibleVertically: icons.every((i) => i.top >= sb.top - 0.5 && i.bottom <= sb.bottom + 0.5),
      // How far past the sidebar's visible bottom the cluster ends up, i.e.
      // how much scrolling reaching it takes. 0 means no scrolling.
      pxBelowFold: Math.max(0, Math.round(Math.max(...icons.map((i) => i.bottom)) - sb.bottom)),
      // Reachable at all: inside the sidebar's SCROLLABLE box, so a scroll
      // brings it into view rather than it being clipped away for good.
      withinScrollBox: cluster.offsetTop + cluster.offsetHeight <= sidebar.scrollHeight + 1,
      // A single column reads as a cluster too: same left edge, evenly spaced.
      distinctLefts: [...new Set(icons.map((i) => Math.round(i.left)))].length,
      dockedNoteBottom: (() => {
        const n = document.getElementById('selected-panel');
        return n ? Math.round(n.getBoundingClientRect().bottom * 10) / 10 : null;
      })(),
    };
  })()`);

const iconCenter = async (label) =>
  await evaluate(`(() => {
    const cluster = document.querySelector('[data-sidebar-icon-cluster]');
    if (!cluster) return null;
    const b = [...cluster.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === ${JSON.stringify(label)});
    if (!b) return null;
    b.scrollIntoView({ block: 'nearest' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

/** A note by the id StickyNote renders, with its header label and body text.
 * Absent notes return `{ present: false }` rather than throwing, so "was it
 * closed before the click?" is a measurable question. */
const noteState = async (id) =>
  await evaluate(`(() => {
    const n = document.getElementById(${JSON.stringify(id)});
    if (!n) return { present: false };
    const r = n.getBoundingClientRect();
    return {
      present: true,
      label: (n.querySelector('[class*="label"]')?.textContent ?? '').trim(),
      text: n.textContent.replace(/\\s+/g, ' ').trim(),
      width: Math.round(r.width),
      onScreen: r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1,
    };
  })()`);

// --- opening an icon's note, AND KNOWING WHICH WAY THE TOGGLE WENT ---------
/**
 * ⚠ **THE FRAGILITY THIS FILE WAS RED FOR ON 2026-09-30, AND WHAT REPLACED IT.**
 *
 * `openIcon` used to be three lines: find the icon, click where it is, sleep
 * 500ms. It **toggled**, and nothing asserted which way it went. A click that
 * was lost — or a note that was already open — left the note closed, and the
 * next reader (`contextLine()`) returned `null`, which its step then reported as
 * **"the app did not render the context line"**. A missed click and a broken app
 * were indistinguishable, and about ten steps in this file went through that one
 * helper.
 *
 * **What it cost, and what was ACTUALLY happening — measured, not inferred.**
 * On `main` @ c85f122, `context-line-names-the-view-as-the-app-labels-it` failed
 * with `plan: null` while `elevation` and `membranes` — read the same way, a few
 * lines later — both passed; three agents saw the same bytes at three commits
 * whose diffs render this page identically. Five controlled runs on 2026-09-30,
 * one dev server, one browser, one commit:
 *
 *   1. **Reproduced.** Under 12x CDP CPU throttling — an honest stand-in for
 *      this machine with four agents and three dev servers on it — the old file
 *      fails byte for byte: `plan: null`, every later reading correct, one
 *      failure, exit 1.
 *   2. **Fixed.** This file, same server, same browser, same 12x throttle: all
 *      checks pass.
 *   3. **It was NOT a lost click.** Deliberately swallowing that one click makes
 *      EVERY later reading `null` as well — the parity never recovers, because
 *      `stepToNextStop()` drives the BAR menus, which close the bar's own notes
 *      and not these. So the reported signature is not what a missed click looks
 *      like, and a retry budget alone would not have fixed it.
 *   4. **It was NOT the app being slow.** Reading the note with ZERO extra wait
 *      passes on an idle machine: the note commits well inside the 450ms that
 *      `click()` already sleeps.
 *   5. **And it was NOT the page being unready.** Giving the old file 25s
 *      instead of 9s at every load, under the same throttle, fails identically.
 *      Elapsed time before the click is not the variable.
 *
 * So the click landed, the app was right, and **the harness read the result of
 * the toggle against a deadline it never asserted**: a flat 500ms. Under load,
 * the FIRST open of the bug note after the footprint drag — the heaviest commit
 * in the run, the note mounting for the first time onto a page that has just
 * panelised a building — takes longer than that, while every later open of the
 * same note is warm and lands well inside it. One late toggle, exactly one
 * `null`, every later reading correct: which is precisely why this was read as
 * an app regression for a day and a half.
 *
 * Both failure modes are covered here anyway, and the evidence tells them apart:
 * a LATE toggle costs `waitedMs` and no extra click, a LOST one shows up in
 * `iconToggleRetries` with what was under the pointer at the time.
 *
 * So the note's state is now ASSERTED, and the budgets spent are named, bounded
 * and written into `evidence.json` rather than being a silence to trust — the
 * shape `ui-reorg-u1`'s `clickSelectorUntil` (2026-09-28) and the shared
 * driver's `openMenu` already use for exactly this class of problem.
 *
 * ⚠ **NO ASSERTION IS WEAKENED TO GET THERE, and the split is the whole point.**
 * Where the CLICK ITSELF is the subject — "the review icon opens the Review
 * Log", "it is a toggle, not a one-way door", "the bug icon opens a note", "the
 * Read Me icon opens a note" — the step still spends exactly ONE click and lets
 * its own expectation report the outcome: `clickIconOnceAndWait` waits for the
 * toggle to land but never clicks twice, so "one click opens it" is still
 * asserted, once, where it belongs. Only the places where an open note is a
 * FIXTURE for reading something else — the four context-line steps, the
 * coexistence step, and the closes between them — may spend a second click,
 * through `openIconNote` / `closeIconNote`, and every extra click is recorded.
 */

/**
 * The note each icon owns. Keyed by the icon's own `aria-label`; the values are
 * the `StickyNote` ids the steps below already assert, so this map adds no new
 * locator. `Features of this page` is deliberately absent — the `?` carries its
 * own popup rather than a StickyNote, and nothing in this run clicks it, so
 * asking for it throws instead of being quietly treated as a note.
 */
const ICON_NOTE_IDS = {
  "Review Log — Items for Engineer/Contractor Review": "review-log",
  "Report Bug / Request Feature": "report-bug",
  "Read Me": "read-me",
};
const noteIdOf = (label) => {
  const id = ICON_NOTE_IDS[label];
  if (!id) throw new Error(`no note id is known for the icon "${label}" — add it to ICON_NOTE_IDS rather than clicking blind`);
  return id;
};

/** Named ceilings, so none of this is a magic number.
 *  - SETTLE: how long ONE click is given to land before it is called lost. A
 *    click that works shows its note within a frame or two; the ceiling is
 *    generous because a busy dev server is not a lost click.
 *  - BUDGET: how many clicks `ensureIconNote` may spend in total. Small, and
 *    reported: a silent retry loop would hide an icon that genuinely stopped
 *    working, which is worse than the flake it fixes. */
const ICON_TOGGLE_SETTLE_MS = 2500;
const ICON_TOGGLE_POLL_MS = 100;
const ICON_CLICK_BUDGET = 3;

/** `StickyNote` renders nothing at all when closed, so presence IS open-ness.
 * Cheap on purpose — this one is polled. */
const noteIsOpen = async (label) =>
  await evaluate(`Boolean(document.getElementById(${JSON.stringify(noteIdOf(label))}))`);

/** One real click at the icon's own coordinates, its rect re-read immediately
 * before the press. Returns where it clicked, for the diagnosis below. */
const clickIcon = async (label) => {
  const c = await iconCenter(label);
  if (!c) throw new Error(`no cluster icon labelled "${label}"`);
  await click(c.x, c.y);
  return c;
};

/** Poll for the note to reach `wantOpen`. Returns the ms waited, or null if the
 * ceiling was reached. Adds NO clicks: this is "read it when it is ready", not
 * "try again". */
const waitForNoteState = async (label, wantOpen, ceilingMs = ICON_TOGGLE_SETTLE_MS) => {
  for (let waited = 0; ; waited += ICON_TOGGLE_POLL_MS) {
    if ((await noteIsOpen(label)) === wantOpen) return waited;
    if (waited >= ceilingMs) return null;
    await sleep(ICON_TOGGLE_POLL_MS);
  }
};

/**
 * Why a click did not take, captured where it happened rather than guessed at
 * afterwards: what is actually at the clicked point, whether that is the icon,
 * where the icon is NOW (a cluster that moved between the rect read and the
 * press is the most likely mechanism), and what the app itself thinks the
 * icon's state is (`aria-pressed`, which the button renders from `active`).
 */
const lostClickDiagnosis = async (label, at) =>
  await evaluate(`(() => {
    const at = { x: ${at.x}, y: ${at.y} };
    const el = document.elementFromPoint(at.x, at.y);
    const btn = [...document.querySelectorAll('[data-sidebar-icon-cluster] button')]
      .find((b) => (b.getAttribute('aria-label') || '') === ${JSON.stringify(label)});
    const describe = (n) => n
      ? n.tagName.toLowerCase()
        + (n.getAttribute && n.getAttribute('aria-label') ? '[aria-label="' + n.getAttribute('aria-label') + '"]' : '')
        + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')
      : null;
    const r = btn ? btn.getBoundingClientRect() : null;
    return {
      clickedAt: [Math.round(at.x), Math.round(at.y)],
      elementAtPoint: describe(el),
      elementAtPointIsTheIcon: Boolean(btn && el && (btn === el || btn.contains(el))),
      iconCentreNow: r ? [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] : null,
      iconSizeNow: r ? [Math.round(r.width), Math.round(r.height)] : null,
      ariaPressed: btn ? btn.getAttribute('aria-pressed') : null,
      noteInDom: Boolean(document.getElementById(${JSON.stringify(noteIdOf(label))})),
      readyState: document.readyState,
    };
  })()`);

/**
 * ONE click, then wait for the toggle to land. **Never a second click** — this
 * is for the steps whose subject IS the click. Returns the ms waited, or null,
 * and records the diagnosis of a lost click without throwing: the step's own
 * expectation is what must report it, exactly as it did before.
 */
const clickIconOnceAndWait = async (label, wantOpen) => {
  const at = await clickIcon(label);
  const waited = await waitForNoteState(label, wantOpen);
  if (waited === null) {
    const why = await lostClickDiagnosis(label, at);
    lostSingleClicks.push({ label, wantOpen, settleCeilingMs: ICON_TOGGLE_SETTLE_MS, ...why });
    console.log(
      `  [lost click] one click on "${label}" did not ${wantOpen ? "open" : "close"} its note: ${JSON.stringify(why)}`,
    );
  }
  return waited;
};

/**
 * Bring an icon's note to a KNOWN state, and throw in the harness's own voice if
 * it cannot — so that a `null` read downstream can only ever mean "the app
 * rendered no context line", which is the one thing it should ever have meant.
 */
const ensureIconNote = async (label, wantOpen) => {
  if ((await noteIsOpen(label)) === wantOpen) return 0;
  const diagnoses = [];
  for (let clicks = 1; clicks <= ICON_CLICK_BUDGET; clicks++) {
    const at = await clickIcon(label);
    const waited = await waitForNoteState(label, wantOpen);
    if (waited !== null) {
      if (clicks > 1) {
        iconToggleRetries.push({
          label,
          wanted: wantOpen ? "open" : "closed",
          clicksSpent: clicks,
          waitedMs: waited,
          diagnoses,
        });
        console.log(
          `  [retried] "${label}" needed ${clicks} clicks to go ${wantOpen ? "open" : "closed"}: ${JSON.stringify(diagnoses)}`,
        );
      }
      return clicks;
    }
    diagnoses.push(await lostClickDiagnosis(label, at));
  }
  iconToggleRetries.push({
    label,
    wanted: wantOpen ? "open" : "closed",
    clicksSpent: ICON_CLICK_BUDGET,
    reachedState: false,
    diagnoses,
  });
  throw new Error(
    `THE HARNESS COULD NOT ${wantOpen ? "OPEN" : "CLOSE"} THE "${label}" NOTE — ` +
      `${ICON_CLICK_BUDGET} real clicks at the icon's own re-read coordinates, each given ${ICON_TOGGLE_SETTLE_MS}ms, ` +
      `and #${noteIdOf(label)} ${wantOpen ? "never appeared" : "never went away"}. This is a HARNESS failure and it is ` +
      `deliberately not reported as the app failing to render anything. What was under the clicks: ${JSON.stringify(diagnoses)}`,
  );
};
const openIconNote = async (label) => await ensureIconNote(label, true);
const closeIconNote = async (label) => await ensureIconNote(label, false);

/**
 * The current view's own label, read out of the CONTROL rather than inferred
 * from the canvas (Stage 0/1's lesson: four views of one wall once counted as
 * four walls).
 *
 * ⚠ THE CONTROLS THIS HARNESS DRIVES HAVE MOVED TWICE, and neither move
 * changed a single thing it ASSERTS.
 *
 * U1 (2026-09-28) made the sidebar dial the below-breakpoint form of the view
 * control and put Design and View menus on the top bar above it. **This harness
 * drives the editor at 1280 and 1400**, so the old dial locator returned null
 * there — which would have failed `footprint-drawn` and every context-line
 * assertion while looking exactly like U0 having broken. It had not; the control
 * had moved, and these locators were in scope for the stage that moved them.
 *
 * Later the same day Tommy removed the dial outright and merged the four editor
 * tabs into the Design menu, so **two** of this file's locators were stale: the
 * dial, and `nav[aria-label="Editor"]`, which this run used to click the Roof
 * and Wall tabs. Both now go through the shared driver next door
 * (`view.selectSubject`), which is the whole reason it exists — five harnesses
 * sharing one set of locators rather than five copies to find one at a time.
 *
 * Still asserted, unchanged: the context line's `Wall — 2D Floor Plan` /
 * `Wall — Membranes` strings, which are deliberately NOT renamed (the
 * `2D Floor Plan` → `Plan View` rename is an open question for Tommy, not a
 * coder's call).
 */
const view = makeViewStopControl({ evaluate, sleep });
const stopLabel = async () => await view.currentLabel();

/**
 * One step to the next view stop, VERIFIED.
 *
 * ⚠ The first version just clicked where the dial's ▼ was, and lost six clicks
 * in a row: opening an icon's note scrolls the sidebar (the icons are at its
 * bottom, the dial was at its top), so the dial's rect was above the sidebar's
 * visible box and every click landed on the top bar instead. The label never
 * changed and the run reported "Membranes unreachable" — a locator problem
 * wearing a feature problem's clothes, which is this repo's own recorded lesson.
 *
 * Both halves of the fix live in the shared driver — it scrolls the target into
 * view and dispatches on the element rather than at a remembered coordinate —
 * and the assertion that the label MOVED stays here, because it is this
 * helper's whole reason for existing. The same hazard applies to a bar menu: an
 * open note can sit over a menu entry just as happily as it sat over the dial.
 */
const stepToNextStop = async () => {
  const before = await stopLabel();
  const after = await view.step();
  if (after === before) throw new Error(`the view control did not move off "${before}" — the step missed`);
  return after;
};

/** The context line the bug note adds, read off its own data attribute. */
const contextLine = async () =>
  await evaluate(`(() => {
    const el = document.querySelector('#report-bug [data-current-view]');
    return el ? { attr: el.getAttribute('data-current-view'), text: el.textContent.replace(/\\s+/g,' ').trim() } : null;
  })()`);

/**
 * ⚠ **WAITED FOR, NOT WAITED OUT.** Every load in this run used to be a flat
 * `sleep(9000)`, which is a guess about someone else's machine in both
 * directions: too short on a busy one (the run then reports the app as broken)
 * and pure dead time on a fast one.
 *
 * The canvas is the honest readiness marker, and it is a strong one: it comes
 * from `dynamic(() => import("./FootprintCanvas"), { ssr: false })`, so it
 * cannot exist until the page has hydrated AND the client chunks have arrived.
 * Every reader below — the icon clicks, the footprint drag, the `?openNote=`
 * effect — needs exactly that and nothing more. Its box must also have STOPPED
 * MOVING (two equal reads, `EDITOR_READY_POLL_MS` apart) before the drag
 * coordinates below are computed from it.
 *
 * The ceiling is a real failure, not a longer wait: reaching it means the
 * editor never mounted, and the message says the one thing that has actually
 * caused that here (127.0.0.1 instead of localhost) rather than leaving the
 * next reader to find the README.
 *
 * ⚠ **AND THIS IS NOT A TIMING KNOB.** See the note on `openIcon` above: the
 * run's real fragility was a toggle nobody asserted, which made it look
 * sensitive to how long the harness waited. Do not tune these numbers to chase
 * a red step — a wait that changes an outcome is telling you something else is
 * unasserted.
 *
 * ## The two timing notes this harness has carried, reconciled
 *
 * Two notes were written about this wait on 2026-09-29, on two branches, and
 * **they cannot both be acted on**:
 *
 *   1. *"three consecutive failures at a flat 9s on the same build that passes
 *      with a poll"* — i.e. 9s is TOO SHORT and the canvas is not mounted yet.
 *   2. *"9s passes, 3s passes, 9s + a 2s settle — 11s — FAILS, two runs out of
 *      two, with `plan: null`"* — i.e. waiting LONGER is what breaks it.
 *
 * **The first is true about a different failure. The second is a real
 * observation with the wrong cause, and acting on it would have been wrong.**
 * Measured here on 2026-09-30, one server, one browser:
 *
 *   - Under 12x CPU throttling the canvas takes **~14.5s to appear** and **~21s
 *     to stop moving** on the 1400x1000 reload, and the `?openNote=` load needs
 *     **~11.8s**. At a flat 9s the run either throws "no canvas" or reads the
 *     deep-link note before the app exists — which is claim 1, and which is why
 *     the load is now waited FOR rather than waited out.
 *   - But the load wait is **not** what `plan: null` was about: the old file at
 *     **25s** per load, under the same throttle, fails **identically**. So the
 *     11s "boundary" in claim 2 is not a boundary at all. What moved between
 *     those runs was the machine, not the clock: the unasserted 500ms deadline
 *     after the click sat close enough to the note's commit time that ordinary
 *     load decided the outcome. **There is no 11s cliff to respect and no 9s
 *     floor to preserve.**
 *   - Under that same throttle, this file passes — because it waits for the
 *     canvas to settle AND asserts the toggle, and neither is a number tuned to
 *     a symptom.
 *
 * If a later reader finds a note saying a settle must not be added back on top
 * of a floor, that note is describing this symptom: there is no floor here to
 * add to, and the thing it was protecting is now asserted instead.
 */
const EDITOR_READY_CEILING_MS = 60000;
const EDITOR_READY_POLL_MS = 250;

const canvasBoxNow = async () =>
  await evaluate(
    `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`,
  );

const waitForEditor = async (what) => {
  const startedAt = Date.now();
  let previous = null;
  for (;;) {
    const box = await canvasBoxNow();
    if (box && previous && box.every((v, i) => Math.abs(v - previous[i]) < 0.5)) {
      const ms = Date.now() - startedAt;
      editorReady.push({ what, ms, canvas: box.map((v) => Math.round(v)) });
      console.log(`  editor ready (${what}) after ${ms}ms — canvas ${Math.round(box[2])}x${Math.round(box[3])}`);
      return box;
    }
    previous = box;
    if (Date.now() - startedAt > EDITOR_READY_CEILING_MS) {
      throw new Error(
        `no settled canvas after ${EDITOR_READY_CEILING_MS}ms (${what}) — the editor never mounted. The canvas is a ` +
          `{ ssr: false } dynamic import, so this means hydration or the client chunks never arrived: are you on ` +
          `localhost rather than 127.0.0.1?`,
      );
    }
    await sleep(EDITOR_READY_POLL_MS);
  }
};

// --- the run ----------------------------------------------------------------
console.log("0. loading the app at 1280px");
await setViewport(1280, 900);
await send("Page.navigate", { url: APP_URL }, sid);
await waitForEditor("the first load, at 1280px");

/**
 * The routes this stage reads its wording out of, fetched ONCE, up front, and
 * then the editor is reloaded.
 *
 * ⚠ THIS ORDERING IS NOT COSMETIC. Fetching `/report-bug` mid-run made the
 * dev server compile a route that shares a module with the editor page, the
 * resulting HMR update remounted the app, and the very next click landed on a
 * page that had just thrown its state away. The symptom was "the bug icon does
 * not open its note" — a fake failure that would have been debugged in the
 * wrong file. Warm them first, reload, then touch nothing but the UI.
 */
const routeSectionsOf = async (route) =>
  await evaluate(`(async () => {
    const res = await fetch(${JSON.stringify(route)});
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      status: res.status,
      sections: [...doc.querySelectorAll('section')].map((s) => s.textContent.replace(/\\s+/g, ' ').trim()),
      mailtos: [...new Set([...doc.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href')))],
      h1: doc.querySelector('h1')?.textContent.trim() ?? null,
    };
  })()`);

/**
 * ⚠ **A ROUTE THAT IS NOT SERVING IS NAMED HERE, IN ITS OWN WORDS, AND THE RUN
 * STOPS.** It is not left to surface ten steps later as "the note is missing
 * three sentences" or "the app did not render the context line".
 *
 * Recorded 2026-09-30, and it cost several agents a day between them: a dev
 * server left running for hours served `/read-me`, `/report-bug` and
 * `/sandbox` as **404**, and this harness — which reads its comparison wording
 * out of those routes — reported the failures against the APP. A server that
 * has never compiled them is the same story from the other end. Either way the
 * only honest thing to say is which route did not serve, and to stop: every
 * check below this line would otherwise be comparing the page against nothing.
 *
 * The final `routes-still-exist-behind-the-notes` step is unchanged and still
 * asserts all three at the END of the run — that one is about the routes
 * surviving the reorganisation. This one is about the harness's own footing.
 */
const assertRouteServed = (route, read) => {
  if (read && read.status === 200 && read.sections.length > 0) return;
  throw new Error(
    `${route} did not serve a page for this run to compare against: HTTP ${read?.status ?? "(no response)"}, ` +
      `${read?.sections?.length ?? 0} <section>s. **THIS IS THE DEV SERVER, NOT THE APP.** A server left running ` +
      `for hours has been seen to serve these routes as 404 until it is restarted, and a server that has never ` +
      `compiled them can be slower than the fetch. Restart the dev server and re-run. Nothing below this line can ` +
      `tell the difference between a route that will not serve and a page that renders nothing.`,
  );
};
const routeText = await routeSectionsOf("/report-bug");
assertRouteServed("/report-bug", routeText);
const readMeRoute = await routeSectionsOf("/read-me");
assertRouteServed("/read-me", readMeRoute);
const sandboxWarmStatus = await evaluate(`fetch('/sandbox').then((r) => r.status)`);
if (sandboxWarmStatus !== 200) {
  throw new Error(
    `/sandbox returned ${sandboxWarmStatus} while warming the routes. **THIS IS THE DEV SERVER, NOT THE APP** — ` +
      `restart it and re-run. (The Single Wall Run step below would otherwise report the move into Settings as broken.)`,
  );
}
await sleep(2500);
await send("Page.navigate", { url: APP_URL }, sid);
await waitForEditor("the reload after the routes were warmed");

console.log("1. the cluster at 240px");
const wide = await clusterGeometry();
record(
  "cluster-is-four-named-icons",
  {
    present: wide.present,
    labels: wide.icons?.map((i) => i.label),
    titlesMatchLabels: wide.icons?.every((i) => i.title.length > 0 && i.title === i.label),
  },
  // Four icons, each carrying a real name in BOTH aria-label and title — the
  // icon-only rule from the Top Bar section, and the only thing that makes an
  // icon-only control findable at all.
  (d) =>
    d.present === true &&
    d.labels.length === 4 &&
    d.titlesMatchLabels === true &&
    d.labels.includes("Features of this page") &&
    d.labels.includes("Review Log — Items for Engineer/Contractor Review") &&
    d.labels.includes("Report Bug / Request Feature") &&
    d.labels.includes("Read Me"),
);
record(
  "cluster-fits-at-240px",
  {
    sidebarWidth: wide.sidebarWidth,
    contentWidth: wide.contentWidth,
    rows: wide.rows,
    overlaps: wide.overlaps,
    outsideHorizontally: wide.outsideHorizontally,
    clusterScrollOverflowPx: wide.clusterScrollOverflowPx,
    inLastSidebarChild: wide.inLastSidebarChild,
    fullyVisibleVertically: wide.fullyVisibleVertically,
  },
  (d) =>
    d.sidebarWidth === 240 &&
    d.rows === 1 &&
    d.overlaps.length === 0 &&
    d.outsideHorizontally.length === 0 &&
    d.clusterScrollOverflowPx <= 0 &&
    d.inLastSidebarChild === true &&
    d.fullyVisibleVertically === true,
);
await shot("00-cluster-240px");

console.log("2. the Review Log's front door");
const reviewBefore = await noteState("review-log");
// ONE click — this step's subject IS the click, so it is never retried. The
// wait only stops the note being read before it has rendered.
const reviewOpenedAfterMs = await clickIconOnceAndWait("Review Log — Items for Engineer/Contractor Review", true);
const reviewAfter = await noteState("review-log");
record(
  "review-icon-opens-the-review-log",
  {
    presentBefore: reviewBefore.present,
    presentAfter: reviewAfter.present,
    label: reviewAfter.label,
    bodyChars: reviewAfter.text?.length ?? 0,
    // How long the one click took to show its note; null would mean it never
    // did, and `presentAfter` then fails this step exactly as it always has.
    openedAfterMs: reviewOpenedAfterMs,
  },
  // Absent before, present after: a check that would pass on a note that was
  // already open is not a check on the icon.
  (d) =>
    d.presentBefore === false &&
    d.presentAfter === true &&
    d.label === "Review Log — Items for Engineer/Contractor Review" &&
    d.bodyChars > 20,
);
await shot("01-review-log-open-empty-project");
// ONE click again: "it is a toggle, not a one-way door" is only proved by a
// single click, so this one must never be retried either.
const reviewClosedAfterMs = await clickIconOnceAndWait("Review Log — Items for Engineer/Contractor Review", false);
record(
  "review-icon-closes-it-again",
  { presentAfterSecondClick: (await noteState("review-log")).present, closedAfterMs: reviewClosedAfterMs },
  (d) => d.presentAfterSecondClick === false,
);

// The comparison the "verbatim" claims rest on: the route's own
// server-rendered sections, read out of the route itself in step 0, so nobody
// re-typed the sentences into this harness.
console.log("3. the bug note, and that its words are the route's words");
const bugBefore = await noteState("report-bug");
// The click is the subject here too: one click, waited for, never retried.
const bugOpenedAfterMs = await clickIconOnceAndWait("Report Bug / Request Feature", true);
const bugAfter = await noteState("report-bug");
const bugMailtos = await evaluate(
  `[...new Set([...document.querySelectorAll('#report-bug a[href^="mailto:"]')].map((a) => a.getAttribute('href')))]`,
);
const userAgent = await evaluate(`navigator.userAgent`);
record(
  "bug-icon-opens-a-note",
  {
    presentBefore: bugBefore.present,
    presentAfter: bugAfter.present,
    label: bugAfter.label,
    onScreen: bugAfter.onScreen,
    openedAfterMs: bugOpenedAfterMs,
  },
  (d) => d.presentBefore === false && d.presentAfter === true && d.label === "Report Bug / Request Feature" && d.onScreen === true,
);
record(
  "bug-note-carries-the-route-wording-verbatim",
  {
    routeSections: routeText.sections.length,
    shortestRouteSection: Math.min(...routeText.sections.map((s) => s.length)),
    missingFromNote: routeText.sections.filter((s) => !bugAfter.text.includes(s)),
  },
  // Every section of the route appears in the note, character for character.
  // The section count and the shortest length are asserted too, so an empty
  // fetch cannot make "nothing is missing" trivially true.
  (d) => d.routeSections === 3 && d.shortestRouteSection > 60 && d.missingFromNote.length === 0,
);
record(
  "bug-note-introduces-no-new-address",
  { routeMailtos: routeText.mailtos, noteMailtos: bugMailtos },
  (d) =>
    d.noteMailtos.length === 1 && d.routeMailtos.length === 1 && d.noteMailtos[0] === d.routeMailtos[0],
);
record(
  "bug-note-is-context-not-telemetry",
  {
    containsUserAgent: bugAfter.text.includes(userAgent),
    uaFragmentsFound: ["Mozilla/", "AppleWebKit", "Chrome/", "HeadlessChrome"].filter((f) => bugAfter.text.includes(f)),
    // A note that quietly grew a version string or a viewport dump would show
    // up here. (The view label itself legitimately contains "2D"/"3D".)
    looksLikeVersionString: /\bv?\d+\.\d+\.\d+\b/.test(bugAfter.text),
    mentionsViewport: /viewport|innerWidth|devicePixelRatio/i.test(bugAfter.text),
  },
  (d) =>
    d.containsUserAgent === false &&
    d.uaFragmentsFound.length === 0 &&
    d.looksLikeVersionString === false &&
    d.mentionsViewport === false,
);
// The Review Log link inside the bug note now opens the note the Review icon
// opens, rather than navigating. It must OPEN it, twice in a row, and never
// close it — a link that shuts the thing it points at is not a link.
const reviewLogLinkOpens = await evaluate(`(() => {
  const b = [...document.querySelectorAll('#report-bug button')].find((x) => x.textContent.includes('Review Log'));
  if (!b) return { found: false };
  b.click();
  return { found: true };
})()`);
await sleep(600);
const afterFirstLinkClick = (await noteState("review-log")).present;
await evaluate(`[...document.querySelectorAll('#report-bug button')].find((x) => x.textContent.includes('Review Log')).click()`);
await sleep(600);
const afterSecondLinkClick = (await noteState("review-log")).present;
record(
  "the-bug-notes-review-log-link-opens-the-same-note",
  { ...reviewLogLinkOpens, afterFirstLinkClick, afterSecondLinkClick },
  (d) => d.found === true && d.afterFirstLinkClick === true && d.afterSecondLinkClick === true,
);
await closeIconNote("Review Log — Items for Engineer/Contractor Review"); // put it back
// The bug note is a FIXTURE for this reading, and `bug-icon-opens-a-note` above
// has already asserted that one click opens it. So its state is made certain
// rather than assumed: a `null` below can then only mean the app rendered no
// context line, which is the only thing the step claims.
await openIconNote("Report Bug / Request Feature");
const ctxPlanNoFootprint = await contextLine();
record(
  "context-line-before-a-footprint-names-only-the-tab",
  { line: ctxPlanNoFootprint },
  // No view stop is on screen with no footprint, so naming a view would be a
  // lie about where the reporter was.
  (d) => d.line !== null && d.line.attr === "Wall",
);
await shot("02-bug-note-open");
await closeIconNote("Report Bug / Request Feature");

console.log("4. the Read Me note");
const readMeBefore = await noteState("read-me");
// One click, waited for, never retried: this step's subject is the icon.
const readMeOpenedAfterMs = await clickIconOnceAndWait("Read Me", true);
const readMeAfter = await noteState("read-me");
const qr = await evaluate(`(() => {
  const img = document.querySelector('#read-me img');
  const pdf = [...document.querySelectorAll('#read-me a')].map((a) => a.getAttribute('href')).filter((h) => h && h.endsWith('.pdf'));
  if (!img) return { img: false, pdfLinks: pdf };
  const r = img.getBoundingClientRect();
  return { img: true, renderedWidth: Math.round(r.width), renderedHeight: Math.round(r.height), pdfLinks: pdf };
})()`);
record(
  "read-me-icon-opens-a-note-with-the-route-wording",
  {
    presentBefore: readMeBefore.present,
    presentAfter: readMeAfter.present,
    label: readMeAfter.label,
    openedAfterMs: readMeOpenedAfterMs,
    routeSections: readMeRoute.sections.length,
    missingFromNote: readMeRoute.sections.filter((s) => !readMeAfter.text.includes(s)),
    liabilityVerbatim: readMeAfter.text.includes(
      "Always keep in mind — anything coming from this app that you want to produce is your liability. I am not responsible for your project.",
    ),
  },
  // The liability statement is asserted by its own exact words as well as by
  // the section comparison: it is legal-posture text, and "relocated, never
  // reworded" deserves a named check rather than an incidental one.
  (d) =>
    d.presentBefore === false &&
    d.presentAfter === true &&
    d.label === "Read Me" &&
    d.routeSections === 3 &&
    d.missingFromNote.length === 0 &&
    d.liabilityVerbatim === true,
);
record(
  "read-me-note-qr-is-still-scannable",
  qr,
  // A QR too small to scan is a broken feature. 200px is the floor; the PDF
  // link is the second path, and both are required to exist.
  (d) => d.img === true && d.renderedWidth >= 200 && d.pdfLinks.length >= 1,
);
await shot("03-read-me-note-open");
await closeIconNote("Read Me");

console.log("5. Single Wall Run in Settings, and gone from the tray");
const sandboxBeforeSettings = await evaluate(`document.querySelectorAll('a[href="/sandbox"]').length`);
const gear = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === 'Settings');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
if (!gear) throw new Error("no Settings button on the top bar");
await click(gear.x, gear.y);
await sleep(600);
/**
 * ⚠ WHAT "REACHABLE" MEANS HERE — REWRITTEN AT U3's REVIEW, 2026-09-29.
 *
 * This is the only assertion across all six harnesses that tests whether a
 * RELOCATED control can still be got to, which is the single question this
 * whole reorganisation exists to answer. Until now its predicate was
 * HORIZONTAL ONLY — `r.width > 0 && r.left >= 0 && r.right <= innerWidth` —
 * under the name `onScreen`.
 *
 * **U3 did not weaken that check; U3 invalidated its premise.** Before U3 the
 * sandbox link sat near the top of a short note and could not be clipped
 * vertically, so a horizontal test was a fair proxy. It now sits below the
 * whole Panelizer and the whole of Site Properties inside a note capped at
 * `max-height: 75vh`, and the old predicate went on reporting
 * `onScreen: true` for a link the committed screenshot shows is far past the
 * bottom of the note's visible region. A green check named `onScreen` that is
 * false is worse than no check at all.
 *
 * So: the vertical truth is MEASURED AND RECORDED under names that say what
 * was measured (`verticallyWithinViewport`, `withinTheNotesVisibleRegion`,
 * the note's `scrollHeight` and `clientHeight`), it is NOT forced green, and
 * the assertion moves to the claim that is both true and the one that
 * matters: **the link is inside the note's scrollable content, and scrolling
 * the note brings it fully into view and under the cursor.** `hitTestable`
 * is `document.elementFromPoint` at the link's own centre, so "visible" means
 * nothing is covering it either — the failure mode that made a control
 * present-but-unclickable twice in this app's history.
 */
const measureSandboxLink = async () =>
  await evaluate(`(() => {
    const note = document.getElementById('settings-note');
    const links = note ? [...note.querySelectorAll('a[href="/sandbox"]')] : [];
    const link = links[0] || null;
    /* StickyNote's scrolling body carries this GLOBAL class on purpose (its
       print rules have to reach past the CSS module's hashed names), so it is
       a stable locator where the module class is not. */
    const body = note ? note.querySelector('.documentSectionBody') : null;
    const px = (v) => Math.round(v * 10) / 10;
    if (!note || !link || !body) return { inSettings: links.length, link: null, note: null };
    const r = link.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      inSettings: links.length,
      link: {
        top: px(r.top),
        bottom: px(r.bottom),
        left: px(r.left),
        right: px(r.right),
        width: px(r.width),
        /* The retired predicate, kept under a name that admits what it tests,
           so the rewrite can be read against it instead of quietly replacing
           it. */
        horizontallyWithinViewport: r.width > 0 && r.left >= -1 && r.right <= window.innerWidth + 1,
        verticallyWithinViewport: r.top >= -1 && r.bottom <= window.innerHeight + 1,
        withinTheNotesVisibleRegion: r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
        hitTestable: !!hit && (hit === link || link.contains(hit)),
      },
      note: {
        scrollTop: px(body.scrollTop),
        scrollHeight: px(body.scrollHeight),
        clientHeight: px(body.clientHeight),
        scrolls: body.scrollHeight > body.clientHeight + 1,
        visibleTop: px(b.top),
        visibleBottom: px(b.bottom),
      },
      viewportHeight: window.innerHeight,
    };
  })()`);

const sandboxStyle = await evaluate(`(() => {
  const link = document.querySelector('#settings-note a[href="/sandbox"]');
  // It has to READ as a menu item beside the other menu items, not as raw
  // body text. CSS Modules' composes is not transitive here, so a link that
  // .menuItem silently loses .tool's type, padding and outline — which is
  // exactly what happened the first time, and it was invisible to every
  // other check in this run.
  if (!link) return null;
  const cs = getComputedStyle(link);
  return { fontSize: cs.fontSize, borderStyle: cs.borderTopStyle, padded: parseFloat(cs.paddingLeft) > 0 };
})()`);
const sandboxText = await evaluate(
  `(() => { const l = document.querySelector('#settings-note a[href="/sandbox"]'); return l ? l.textContent.replace(/\\s+/g, ' ').trim() : null; })()`,
);
const sandboxDocumentTotal = await evaluate(`document.querySelectorAll('a[href="/sandbox"]').length`);
const sandboxOnOpen = await measureSandboxLink();
await shot("04-settings-single-wall-run");
/* Scrolling the note is the user action the reachability claim rests on, so it
   is PERFORMED rather than assumed. `block: 'nearest'` scrolls the minimum the
   browser needs — the same call the rest of this harness makes before every
   click, and the reason those clicks land. */
await evaluate(
  `(() => { const l = document.querySelector('#settings-note a[href="/sandbox"]'); if (l) l.scrollIntoView({ block: 'nearest' }); return true; })()`,
);
await sleep(400);
const sandboxAfterScroll = await measureSandboxLink();
await shot("04b-settings-single-wall-run-scrolled-to");
const sandboxRouteOk = await evaluate(`(async () => { const r = await fetch('/sandbox'); return r.status; })()`);
record(
  "single-wall-run-moved-into-settings",
  {
    sandboxLinksBeforeOpeningSettings: sandboxBeforeSettings,
    inSettings: sandboxOnOpen.inSettings,
    text: sandboxText,
    documentTotal: sandboxDocumentTotal,
    sandboxRouteStatus: sandboxRouteOk,
    /* ⚠ THE HONEST FINDING, RECORDED AND NOT ASSERTED. With the Panelizer and
       Site Properties above it, the link is below the fold of the note's own
       75vh scroller the moment Settings opens. That is a real consequence of
       U3 and of the panelizer-first order, it is Tommy's to accept or send
       back (grouping, collapsing, a wider note — all named as open in the
       spec), and it is NOT something this harness gets to paint green. */
    whenSettingsOpens: sandboxOnOpen,
    visibleWithoutScrolling:
      sandboxOnOpen.link !== null &&
      sandboxOnOpen.link.withinTheNotesVisibleRegion === true &&
      sandboxOnOpen.link.verticallyWithinViewport === true,
    afterScrollingTheNote: sandboxAfterScroll,
    reachableByScrollingTheNote:
      sandboxAfterScroll.link !== null &&
      sandboxAfterScroll.link.horizontallyWithinViewport === true &&
      sandboxAfterScroll.link.verticallyWithinViewport === true &&
      sandboxAfterScroll.link.withinTheNotesVisibleRegion === true &&
      sandboxAfterScroll.link.hitTestable === true,
    style: sandboxStyle,
  },
  // Counted BOTH ways: zero anywhere in the document until Settings is
  // opened (so it really did leave the tray footer), exactly one inside the
  // Settings note, the label unchanged, and the route still resolving. Then
  // REACHABILITY, which is the part the old horizontal-only predicate could
  // not see: horizontally within the viewport at both readings (that much was
  // always true and stays asserted), and after scrolling the note the link is
  // vertically within the viewport, inside the note's visible region, and the
  // topmost element at its own centre.
  (d) =>
    d.sandboxLinksBeforeOpeningSettings === 0 &&
    d.inSettings === 1 &&
    d.documentTotal === 1 &&
    d.text === "Single Wall Run Calculation Sandbox →" &&
    d.sandboxRouteStatus === 200 &&
    d.whenSettingsOpens.link !== null &&
    d.whenSettingsOpens.link.horizontallyWithinViewport === true &&
    d.reachableByScrollingTheNote === true &&
    d.style !== null &&
    d.style.fontSize === "13px" &&
    d.style.borderStyle === "solid" &&
    d.style.padded === true,
);
await click(gear.x, gear.y);
await sleep(400);

console.log("6. the cluster at the 64px sidebar, and every width in between");
const widths = [1600, 1280, 1200, 710, 601, 600, 400, 360];
const perWidth = [];
for (const w of widths) {
  await setViewport(w, 900);
  const g = await clusterGeometry();
  perWidth.push({
    viewport: w,
    sidebarWidth: g.sidebarWidth,
    contentWidth: g.contentWidth,
    rows: g.rows,
    distinctLefts: g.distinctLefts,
    icons: g.icons.length,
    overlaps: g.overlaps.length,
    outsideHorizontally: g.outsideHorizontally,
    scrollOverflowPx: g.clusterScrollOverflowPx,
    fullyVisibleVertically: g.fullyVisibleVertically,
    pxBelowFold: g.pxBelowFold,
    withinScrollBox: g.withinScrollBox,
  });
  if (w === 400) await shot("05-cluster-64px-400w");
  if (w === 360) await shot("06-cluster-64px-360w");
}
record(
  "cluster-fits-at-every-width-including-64px",
  { perWidth },
  // Nothing sticks out of the sidebar's real content box and nothing overlaps
  // at any width; all four icons survive every width; and the ≤600px rule
  // really is producing a 64px sidebar at three of them, so this is not
  // testing one layout eight times.
  (d) =>
    d.perWidth.length === 8 &&
    d.perWidth.every(
      (r) =>
        r.icons === 4 &&
        r.overlaps === 0 &&
        r.outsideHorizontally.length === 0 &&
        r.scrollOverflowPx <= 0 &&
        r.withinScrollBox === true,
    ) &&
    d.perWidth.filter((r) => r.sidebarWidth === 64).map((r) => r.viewport).join(",") === "600,400,360" &&
    d.perWidth.filter((r) => r.sidebarWidth === 240).length === 5,
);
record(
  "cluster-reads-as-a-cluster-at-240px-and-at-64px",
  {
    at240: perWidth
      .filter((r) => r.sidebarWidth === 240)
      .map((r) => ({ viewport: r.viewport, contentWidth: r.contentWidth, rows: r.rows, pxBelowFold: r.pxBelowFold })),
    at64: perWidth
      .filter((r) => r.sidebarWidth === 64)
      .map((r) => ({ viewport: r.viewport, contentWidth: r.contentWidth, rows: r.rows, distinctLefts: r.distinctLefts, pxBelowFold: r.pxBelowFold })),
  },
  // At 240px: one row, and no scrolling to reach it. Unchanged.
  //
  // ⚠ AT 64px THIS ASSERTION WAS REWRITTEN ON 2026-09-28, BECAUSE THE MEASURED
  // TRUTH IMPROVED. It used to require `contentWidth <= 44, rows === 4,
  // distinctLefts === 1` — a single flush-left stack with 30px of it BELOW THE
  // FOLD, which is the "one measured deviation at 64px" Tommy was shown and
  // accepted on 2026-09-27.
  //
  // Removing the sidebar view dial (2026-09-28) took ~60px out of the column,
  // so the sidebar no longer overflows vertically at 64px. Measured: scrollHeight
  // 820 === clientHeight 820, and the scrollbar that used to take 15px of a
  // 64px rail is gone. The content box therefore went 40px -> 55px, the four
  // icons now sit two abreast, and NOTHING IS BELOW THE FOLD any more.
  //
  // ⚠ AND IT IS PINNED TO THE MEASURED TRUTH, NOT TO A BOUND. The first
  // rewrite said `contentWidth <= 60 && distinctLefts <= 2 && rows <= 4`, which
  // is satisfied by the old cut-off layout AND by several worse ones — a
  // loosened assertion is how a regression becomes invisible, and loosening is
  // the standing temptation whenever a measured fact moves. The layout is now
  // 55px of content, two columns, three rows, nothing below the fold, at all
  // three of the 64px widths, and that is what is asserted. `pxBelowFold === 0`
  // is the clause the OLD assertion never had at all: it accepted 30px of the
  // cluster being unreachable, which is the deviation Tommy was shown and
  // accepted on 2026-09-27 and which no longer exists.
  //
  // Measured again on 2026-09-29 after `EditorTabDial` and its toolbar were
  // removed from the same column: unchanged at 55 / 2 / 3 / 0, so the icons'
  // layout is set by the rail's width, not by how much sits above them.
  (d) =>
    d.at240.length === 5 &&
    d.at240.every((r) => r.rows === 1 && r.pxBelowFold === 0) &&
    d.at64.length === 3 &&
    d.at64.every((r) => r.contentWidth === 55 && r.distinctLefts === 2 && r.rows === 3 && r.pxBelowFold === 0),
);

console.log("7. the context line on an elevation, on Membranes, and on the Roof subject");
await setViewport(1400, 1000);
await send("Page.navigate", { url: APP_URL }, sid);
const [cx, cy, cw, ch] = await waitForEditor("the 1400x1000 reload the footprint is drawn on");
const x0 = cx + 60, y0 = cy + 80, x1 = cx + cw - 80, y1 = cy + ch - 120;
await mouse("mousePressed", x0, y0);
await sleep(80);
await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
await sleep(80);
await mouse("mouseMoved", x1, y1);
await sleep(80);
await mouse("mouseReleased", x1, y1);
await sleep(1400);
record(
  "footprint-drawn",
  { stopLabel: await stopLabel() },
  // Everything after this depends on there being a building, so it is
  // asserted rather than assumed.
  (d) => d.stopLabel === "2D Floor Plan",
);

// ⚠ EVERY ONE OF THESE IS A FIXTURE OPEN/CLOSE, NOT A CLICK UNDER TEST — see
// the note on `openIcon` above. This is the exact reading that came back
// `plan: null` on `main`: the first open after the footprint drag was lost, and
// the step reported a harness miss as "the app did not render the context line".
await openIconNote("Report Bug / Request Feature");
const ctxPlan = await contextLine();
await closeIconNote("Report Bug / Request Feature");
// One step on from the plan is the first wall's elevation.
await stepToNextStop();
const elevationStop = await stopLabel();
await openIconNote("Report Bug / Request Feature");
const ctxElevation = await contextLine();
await closeIconNote("Report Bug / Request Feature");
await shot("07-elevation-view");
// Walk to Membranes, whichever stop index that is for this footprint.
let membranesReached = null;
for (let i = 0; i < 12 && membranesReached === null; i++) {
  await stepToNextStop();
  if ((await stopLabel()) === "Membranes") membranesReached = "Membranes";
}
await openIconNote("Report Bug / Request Feature");
const ctxMembranes = await contextLine();
await closeIconNote("Report Bug / Request Feature");
record(
  "context-line-names-the-view-as-the-app-labels-it",
  {
    plan: ctxPlan?.attr ?? null,
    elevationStop,
    elevation: ctxElevation?.attr ?? null,
    membranesReached,
    membranes: ctxMembranes?.attr ?? null,
    lineReadsNaturally: ctxMembranes?.text ?? null,
  },
  // The elevation case is asserted against the DIAL's own label, so a rename
  // of either one cannot drift past this check. "Membranes" (never "3D
  // Wraps") is asserted by name: that word was a specific request.
  (d) =>
    d.plan === "Wall — 2D Floor Plan" &&
    typeof d.elevationStop === "string" &&
    d.elevationStop.startsWith("Elevation: ") &&
    d.elevation === `Wall — ${d.elevationStop}` &&
    d.membranesReached === "Membranes" &&
    d.membranes === "Wall — Membranes",
);

// Roof: off by default (Smearforn Stage 0), so bring it into scope through
// the Panelizer's own checkbox. The checkbox is a FIXTURE here, not the thing
// under test, so it is toggled through the DOM; everything being measured is
// clicked for real.
// ⚠ U3 (2026-09-29) MOVED THE PANELIZER INTO ⚙ SETTINGS, so this is one click
// where it used to be two through Project ▾ → Panelizer. The gear is icon-only
// and is located by `data-bar-control`; the scope group is then looked for
// INSIDE `#settings-note`, so a run that found it somewhere else would fail
// rather than quietly pass.
const roofEnabled = await evaluate(`(() => {
  const gear = document.querySelector('[data-bar-control="settings"]');
  if (!gear) return 'no-settings-button';
  gear.click();
  return 'settings-open';
})()`);
await sleep(700);
const roofChecked = await evaluate(`(() => {
  const group = document.querySelector('#settings-note [role="group"][aria-label="Scope of work"]');
  if (!group) return 'no-scope-group';
  const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
  if (!label) return 'no-roof-label';
  const box = label.querySelector('input[type="checkbox"]');
  if (!box.checked) box.click();
  return box.checked ? 'checked' : 'still-unchecked';
})()`);
await sleep(600);
await evaluate(`(() => {
  const close = [...document.querySelectorAll('#settings-note button')].find((b) => (b.getAttribute('aria-label') || '') === 'Close' || (b.getAttribute('title') || '') === 'Hide this note' || b.textContent.trim() === '×');
  if (close) close.click();
})()`);
await sleep(500);
/* ⚠ THERE IS NO ROOF TAB ANY MORE. The bar's nav[aria-label="Editor"] and its
   four tab buttons were removed on 2026-09-28, when Tommy merged the two axes:
   the subjects are groups inside the Design menu now. The shared driver knows
   how to get there, and a subject out of the scope of work has no entry at all
   — which is why the checkbox above is ticked first, and why the driver throws
   with what WAS on offer rather than reporting a tab it could not find. */
const roofTabClicked = (await view.selectSubject("roof")) ? "clicked" : "not-offered";
await sleep(900);
await openIconNote("Report Bug / Request Feature");
const ctxRoof = await contextLine();
record(
  "context-line-on-the-roof-tab-names-only-the-tab",
  { roofEnabled, roofChecked, roofTabClicked, line: ctxRoof?.attr ?? null, stopLabel: await stopLabel() },
  // No view stop is on screen off the wall subject, so the line must NOT claim
  // a view — this is the case that would quietly report "Membranes" to Tommy
  // from a screen showing roof tools. ⚠ The assertion is unchanged; only the
  // control that gets here changed. `stopLabel` reads null, which is what the
  // bar's own current-stop attribute says when the surface is a Roof editor.
  (d) => d.roofChecked === "checked" && d.roofTabClicked === "clicked" && d.line === "Roof",
);
await shot("08-roof-tab-bug-note");
await closeIconNote("Report Bug / Request Feature");

console.log("8. a docked Selected Panel note and an icon note at the same time");
// Back to the wall subject through the Design menu — the only door, now that
// the bar carries no tabs. It lands on the plan, the wall subject's first
// destination, and the walk below steps on from there to an elevation.
if (!(await view.selectSubject("wall"))) throw new Error("the Design menu would not go back to the wall subject");
await sleep(700);
// Back to an elevation, then click a panel body to dock the Selected Panel
// note above the cluster.
while ((await stopLabel()) !== null && !(await stopLabel()).startsWith("Elevation: ")) await stepToNextStop();
/**
 * Clicks panels until one is actually SELECTED.
 *
 * Not every clickable group on an elevation is a selectable panel (a safety
 * gap is not, and a click that lands on a boundary strip selects nothing), and
 * which group sits in the middle of the list depends on how the wall tiled. A
 * single click on "the middle one" passed on one run and silently selected
 * nothing on the next. So: try candidates in turn, and assert a selection
 * happened rather than assuming it did.
 *
 * ⚠ **THE SAMPLE SHRANK ON 2026-09-29 AND IT IS CALLED OUT HERE RATHER THAN
 * LEFT IN THE EVIDENCE FILE FOR SOMEBODY TO SPOT.** `candidates` went from 15
 * to 4 that day: the wall elevation started fitting the editor's HEIGHT and
 * scrolling its length, so most of a 48ft wall's panels are outside the window
 * at the default view and the `b.x < window.innerWidth - 40` filter — which is
 * correct, a click at an off-screen coordinate hits nothing — now trims them.
 *
 * Left as a 4-candidate sample ON PURPOSE. This step only needs ONE panel to
 * select so it can dock the Selected Panel note; it is not a check about the
 * wall, and zooming out to recover eleven candidates it does not use would add
 * a zoom dependency to a UI-layout harness. What was wrong was saying nothing:
 * three other harnesses had the same drop and reported it, and this one did
 * not. The assertion below still fails if the sample reaches zero.
 */
const candidates = await evaluate(`(() => {
  const gs = [...document.querySelectorAll('svg g')].filter((g) => (g.getAttribute('style') || '').includes('pointer'));
  return gs
    .map((g) => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })
    .filter((b) => b.w > 8 && b.x > 260 && b.x < window.innerWidth - 40 && b.y > 80 && b.y < window.innerHeight - 60);
})()`);
let selectionAttempts = 0;
let selected = false;
for (const c of candidates.slice().reverse()) {
  if (selected) break;
  selectionAttempts++;
  await click(c.x, c.y);
  await sleep(700);
  selected = (await noteState("selected-panel")).present;
}
record(
  "a-panel-was-selected-to-dock-its-note",
  { candidates: candidates.length, selectionAttempts, selected },
  // Asserted, not assumed: a locator that returns nothing, or a click that
  // selects nothing, must fail the run rather than skip the step it was for.
  (d) => d.candidates > 0 && d.selected === true,
);
// A fixture again: what this step asserts is the GEOMETRY of the two notes and
// the cluster, and that the review icon opens its note is asserted in step 2.
await openIconNote("Review Log — Items for Engineer/Contractor Review");
const withDocked = await clusterGeometry();
const dockedNote = await noteState("selected-panel");
const reviewWithDocked = await noteState("review-log");
record(
  "docked-note-and-an-icon-note-coexist-without-crowding-the-cluster",
  {
    dockedNotePresent: dockedNote.present,
    reviewNotePresent: reviewWithDocked.present,
    clusterTop: Math.min(...withDocked.icons.map((i) => i.top)),
    dockedNoteBottom: withDocked.dockedNoteBottom,
    overlaps: withDocked.overlaps,
    outsideHorizontally: withDocked.outsideHorizontally,
    icons: withDocked.icons.length,
  },
  (d) =>
    d.dockedNotePresent === true &&
    d.reviewNotePresent === true &&
    d.icons === 4 &&
    d.overlaps.length === 0 &&
    d.outsideHorizontally.length === 0 &&
    typeof d.dockedNoteBottom === "number" &&
    d.clusterTop >= d.dockedNoteBottom - 0.5,
);
const reviewLogEntries = await evaluate(`document.querySelectorAll('#review-log li').length`);
record(
  "review-log-has-a-body-whether-empty-or-full",
  { entries: reviewLogEntries, bodyChars: reviewWithDocked.text.length },
  // Full on a real building, the empty-project case having been screenshotted
  // in step 2. Either way the note says something.
  (d) => d.bodyChars > 20,
);
await shot("09-docked-note-plus-review-log");

console.log("9. the ?openNote=review-log deep link /report-bug depends on");
await send("Page.navigate", { url: `${APP_URL}?openNote=review-log` }, sid);
await waitForEditor("the ?openNote=review-log load");
/**
 * ⚠ **THE COLD-PROFILE FLAKE THIS STEP WAS RED FOR (2026-09-30).** On a fresh
 * Chrome profile — no HTTP cache, no compiled-chunk reuse — this load came back
 * `{ present: false, clicksUsed: 0 }`, i.e. "the deep link stopped working",
 * while the same run on a warm browser passed. It was read at a flat 9s after
 * `Page.navigate`; the note is opened by a mount effect in `page.tsx`, so on a
 * slow cold load the harness was simply reading before the app existed.
 *
 * Now the editor is waited FOR (above), and then the note is given a short,
 * named window to appear. **The assertion is untouched and `clicksUsed` is
 * still 0**: what changed is when the answer is read, not what counts as a
 * right answer. A deep link that never opens the note still fails this step,
 * and `waitedAfterEditorReadyMs` says how long it was given.
 */
const DEEP_LINK_CEILING_MS = 5000;
let deepLinked = await noteState("review-log");
let deepLinkWaitedMs = 0;
while (!deepLinked.present && deepLinkWaitedMs < DEEP_LINK_CEILING_MS) {
  await sleep(250);
  deepLinkWaitedMs += 250;
  deepLinked = await noteState("review-log");
}
record(
  "openNote-deep-link-still-opens-the-review-log",
  {
    present: deepLinked.present,
    label: deepLinked.label,
    clicksUsed: 0,
    waitedAfterEditorReadyMs: deepLinkWaitedMs,
    ceilingMs: DEEP_LINK_CEILING_MS,
  },
  (d) => d.present === true && d.label === "Review Log — Items for Engineer/Contractor Review",
);
await shot("10-deep-link-review-log");

record(
  "routes-still-exist-behind-the-notes",
  await evaluate(`(async () => {
    const codes = {};
    for (const p of ['/read-me', '/report-bug', '/sandbox']) codes[p] = (await fetch(p)).status;
    return codes;
  })()`),
  // The notes are an additional door, not a replacement: both pages are still
  // linked from the tray footer and from anywhere else in the world.
  (d) => d["/read-me"] === 200 && d["/report-bug"] === 200 && d["/sandbox"] === 200,
);

record(
  "no-uncaught-exceptions",
  { count: pageExceptions.length, first: pageExceptions[0] ?? null },
  (d) => d.count === 0,
);

if (PROVE_FAILURE) {
  // The measured other half of "non-zero exit on a false expectation".
  record("deliberate-failure-to-prove-this-harness-can-fail", { twoPlusTwo: 4 }, (d) => d.twoPlusTwo === 5);
}

writeEvidence();
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall checks passed");
process.exit(0);
