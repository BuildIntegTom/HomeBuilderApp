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
  evidenceWritten = true;
  evidence.pageExceptions = pageExceptions;
  evidence.failures = failures;
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

const openIcon = async (label) => {
  const c = await iconCenter(label);
  if (!c) throw new Error(`no cluster icon labelled "${label}"`);
  await click(c.x, c.y);
  await sleep(500);
};

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

// --- the run ----------------------------------------------------------------
console.log("0. loading the app at 1280px");
await setViewport(1280, 900);
await send("Page.navigate", { url: APP_URL }, sid);
await sleep(9000);

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
    const html = await (await fetch(${JSON.stringify(route)})).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      sections: [...doc.querySelectorAll('section')].map((s) => s.textContent.replace(/\\s+/g, ' ').trim()),
      mailtos: [...new Set([...doc.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href')))],
      h1: doc.querySelector('h1')?.textContent.trim() ?? null,
    };
  })()`);
const routeText = await routeSectionsOf("/report-bug");
const readMeRoute = await routeSectionsOf("/read-me");
await evaluate(`fetch('/sandbox').then((r) => r.status)`);
await sleep(2500);
await send("Page.navigate", { url: APP_URL }, sid);
await sleep(9000);

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
await openIcon("Review Log — Items for Engineer/Contractor Review");
const reviewAfter = await noteState("review-log");
record(
  "review-icon-opens-the-review-log",
  {
    presentBefore: reviewBefore.present,
    presentAfter: reviewAfter.present,
    label: reviewAfter.label,
    bodyChars: reviewAfter.text?.length ?? 0,
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
await openIcon("Review Log — Items for Engineer/Contractor Review");
record(
  "review-icon-closes-it-again",
  { presentAfterSecondClick: (await noteState("review-log")).present },
  (d) => d.presentAfterSecondClick === false,
);

// The comparison the "verbatim" claims rest on: the route's own
// server-rendered sections, read out of the route itself in step 0, so nobody
// re-typed the sentences into this harness.
console.log("3. the bug note, and that its words are the route's words");
const bugBefore = await noteState("report-bug");
await openIcon("Report Bug / Request Feature");
const bugAfter = await noteState("report-bug");
const bugMailtos = await evaluate(
  `[...new Set([...document.querySelectorAll('#report-bug a[href^="mailto:"]')].map((a) => a.getAttribute('href')))]`,
);
const userAgent = await evaluate(`navigator.userAgent`);
record(
  "bug-icon-opens-a-note",
  { presentBefore: bugBefore.present, presentAfter: bugAfter.present, label: bugAfter.label, onScreen: bugAfter.onScreen },
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
await openIcon("Review Log — Items for Engineer/Contractor Review"); // put it back
const ctxPlanNoFootprint = await contextLine();
record(
  "context-line-before-a-footprint-names-only-the-tab",
  { line: ctxPlanNoFootprint },
  // No view stop is on screen with no footprint, so naming a view would be a
  // lie about where the reporter was.
  (d) => d.line !== null && d.line.attr === "Wall",
);
await shot("02-bug-note-open");
await openIcon("Report Bug / Request Feature");

console.log("4. the Read Me note");
const readMeBefore = await noteState("read-me");
await openIcon("Read Me");
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
await openIcon("Read Me");

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
const sandboxInSettings = await evaluate(`(() => {
  const note = document.getElementById('settings-note');
  const links = note ? [...note.querySelectorAll('a[href="/sandbox"]')] : [];
  return {
    inSettings: links.length,
    text: links[0] ? links[0].textContent.replace(/\\s+/g, ' ').trim() : null,
    documentTotal: document.querySelectorAll('a[href="/sandbox"]').length,
    onScreen: links[0] ? (() => { const r = links[0].getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth; })() : false,
    // It has to READ as a menu item beside the other menu items, not as raw
    // body text. CSS Modules' composes is not transitive here, so a link that
    // .menuItem silently loses .tool's type, padding and outline — which is
    // exactly what happened the first time, and it was invisible to every
    // other check in this run.
    style: links[0]
      ? (() => { const cs = getComputedStyle(links[0]); return { fontSize: cs.fontSize, borderStyle: cs.borderTopStyle, padded: parseFloat(cs.paddingLeft) > 0 }; })()
      : null,
  };
})()`);
const sandboxRouteOk = await evaluate(`(async () => { const r = await fetch('/sandbox'); return r.status; })()`);
record(
  "single-wall-run-moved-into-settings",
  {
    sandboxLinksBeforeOpeningSettings: sandboxBeforeSettings,
    ...sandboxInSettings,
    sandboxRouteStatus: sandboxRouteOk,
  },
  // Counted BOTH ways: zero anywhere in the document until Settings is
  // opened (so it really did leave the tray footer), exactly one inside the
  // Settings note, the label unchanged, and the route still resolving.
  (d) =>
    d.sandboxLinksBeforeOpeningSettings === 0 &&
    d.inSettings === 1 &&
    d.documentTotal === 1 &&
    d.text === "Single Wall Run Calculation Sandbox →" &&
    d.onScreen === true &&
    d.sandboxRouteStatus === 200 &&
    d.style !== null &&
    d.style.fontSize === "13px" &&
    d.style.borderStyle === "solid" &&
    d.style.padded === true,
);
await shot("04-settings-single-wall-run");
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
/**
 * ⚠ **Waited FOR, not waited OUT.** This used to be a flat `sleep(9000)`, and
 * on a busy machine the dev server's own compile of this reload lands a little
 * past that — the canvas mounted at about 6s on one run and past 9s on the
 * next three, and the harness died here with "no canvas — are you on localhost
 * rather than 127.0.0.1?", which sends the next person to look at the URL
 * scheme instead of at the clock. Measured 2026-09-29: three consecutive
 * failures at 9s on the same build that passes here.
 *
 * Polling changes no assertion — every check below still runs against the same
 * page — it only stops a slow reload being reported as a missing canvas. The
 * ceiling is still a real failure if it is reached.
 */
const readCanvasBox = async () =>
  await evaluate(
    `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`,
  );
//
// ⚠ **A FLOOR first, and the poll only EXTENDS it — and the floor REPLACES the
// settle rather than adding to it.** Three things were measured here on
// 2026-09-29 and all three matter:
//
// 1. Replacing the original flat `sleep(9000)` with a bare poll changed no
//    assertion but dropped the MINIMUM wait from 9s to 3s, so on a fast machine
//    the drag below started about six seconds earlier than the run these
//    coordinates were tuned at.
// 2. The original 9s passed, and 3s passes. **9s + the 2s settle — 11s — FAILS**,
//    reproducibly, two runs out of two: `context-line-names-the-view-as-the-app-
//    labels-it` comes back with `plan: null`, i.e. the FIRST
//    `openIcon("Report Bug / Request Feature")` after the drag does not leave
//    the note on screen, while every later one does. The same run at this
//    file’s previous commit is green.
// 3. So the wait is bounded on BOTH sides here, which nobody knew. 9s with no
//    settle is the timing this step was actually tuned at, and it is what this
//    restores; the poll is pure insurance above it.
//
// ⚠ **Do not add a settle back on top of this floor**, and if a floor ever has
// to move, re-run the whole file rather than this step — the failure lands two
// steps later and does not look like a timing failure. The real fragility is
// that `openIcon` TOGGLES and nothing asserts which way it went; making it
// assert the note’s resulting state would remove the upper bound entirely, and
// it is left alone here because that helper serves about ten steps in this file.
await sleep(9000);
let canvasBox = await readCanvasBox();
for (let waitedMs = 0; waitedMs < 40000 && !canvasBox; waitedMs += 1000) {
  await sleep(1000);
  canvasBox = await readCanvasBox();
}
if (!canvasBox) throw new Error("no canvas after 49s — are you on localhost rather than 127.0.0.1?");
const [cx, cy, cw, ch] = canvasBox;
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

await openIcon("Report Bug / Request Feature");
const ctxPlan = await contextLine();
await openIcon("Report Bug / Request Feature");
// One step on from the plan is the first wall's elevation.
await stepToNextStop();
const elevationStop = await stopLabel();
await openIcon("Report Bug / Request Feature");
const ctxElevation = await contextLine();
await openIcon("Report Bug / Request Feature");
await shot("07-elevation-view");
// Walk to Membranes, whichever stop index that is for this footprint.
let membranesReached = null;
for (let i = 0; i < 12 && membranesReached === null; i++) {
  await stepToNextStop();
  if ((await stopLabel()) === "Membranes") membranesReached = "Membranes";
}
await openIcon("Report Bug / Request Feature");
const ctxMembranes = await contextLine();
await openIcon("Report Bug / Request Feature");
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
const roofEnabled = await evaluate(`(() => {
  const openProject = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Project'));
  if (!openProject) return 'no-project-menu';
  openProject.click();
  return 'project-open';
})()`);
await sleep(500);
await evaluate(`(() => {
  const item = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Panelizer');
  if (item) item.click();
})()`);
await sleep(700);
const roofChecked = await evaluate(`(() => {
  const group = document.querySelector('[role="group"][aria-label="Scope of work"]');
  if (!group) return 'no-scope-group';
  const label = [...group.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Roof');
  if (!label) return 'no-roof-label';
  const box = label.querySelector('input[type="checkbox"]');
  if (!box.checked) box.click();
  return box.checked ? 'checked' : 'still-unchecked';
})()`);
await sleep(600);
await evaluate(`(() => {
  const close = [...document.querySelectorAll('#panelizer-note button')].find((b) => (b.getAttribute('aria-label') || '') === 'Close' || b.textContent.trim() === '×');
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
await openIcon("Report Bug / Request Feature");
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
await openIcon("Report Bug / Request Feature");

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
await openIcon("Review Log — Items for Engineer/Contractor Review");
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
await sleep(9000);
const deepLinked = await noteState("review-log");
record(
  "openNote-deep-link-still-opens-the-review-log",
  { present: deepLinked.present, label: deepLinked.label, clicksUsed: 0 },
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
