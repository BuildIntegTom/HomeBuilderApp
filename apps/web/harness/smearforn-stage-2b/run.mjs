/**
 * Browser harness — Project Smearforn, Stage 2b (the spanning "triple"
 * header).
 *
 * **In the repo on purpose**, like the Stage 0/1, Stage 2 and Stage 3
 * harnesses next door, and the CDP plumbing below is theirs.
 *
 * Stage 2b's headline claim cannot be seen from a unit test: **a header sits
 * ON TOP of two or more panels, shortens them, and adds NO width to the
 * wall.** That is three separate systems agreeing (the elevation, the named
 * instance list, the 3D scene), and the only place they are all true at once
 * is a running app.
 *
 * ### The trick that makes the 3D assertions exact
 *
 * Borrowed from Stage 3's harness, because it is the right one: the 3D view
 * is WebGL, so there is no DOM and a pixel diff cannot tell "the header is
 * drawn" from "a panel is tall". But `Export as OBJ` builds its geometry
 * from **the same memos the scene renders**, so intercepting that blob gives
 * a precise textual model — every member as world-space vertices, grouped by
 * label.
 *
 * ⚠ **Two traps inherited from the harnesses before this one, both of which
 * produced VACUOUS PASSES rather than failures:**
 *
 * 1. Ground-floor wall panels carry **no prefix** in the OBJ — their group is
 *    `${wallId}_${slotIndex}_${memberId}`, while everything else is prefixed
 *    (`story2_`, `gable_`, `roofbearing_`, `midwallbeam_`, and now
 *    `spanningheader_`). Assuming a `wall_` prefix once made every 3D check
 *    match nothing while reporting green. So every 3D step here asserts it
 *    FOUND something, not only that what it found is right.
 * 2. Stage 2's harness rooted three locators on drag strips, which a wall
 *    with no two adjacent standard panels simply does not have — the readers
 *    returned nothing and said nothing. Nothing here is keyed to an
 *    incidental element: panels come from the OBJ by slot index, and the
 *    header's own controls come from their `aria-label`s, which exist because
 *    the control exists.
 *
 * What it drives:
 *   1. draw a footprint, read the baseline 3D scene and pick the longest wall
 *   2. open that wall's elevation and measure it
 *   3. add a spanning header over two real panels — its span is exactly those
 *      two panels' combined width, measured off the 3D model, and the wall's
 *      own total does NOT move
 *   4. add one on a DIFFERENT wall: the two names are distinct and are H1/H2
 *      from one building-wide series (a per-wall counter would give H1/H1)
 *   5. a one-panel span is REFUSED, in words, and changes nothing
 *   6. a span past the catalog maximum is REFUSED with the number quoted and
 *      the range named as unconfirmed — it is not widened to fit the drawing
 *   7. deleting a panel to the LEFT of the header moves its range so it still
 *      covers the same two panels at the same span (Stage 2's shift machinery)
 *   8. a wall-run stop under the header is REFUSED BY NAME (Stage 3)
 *   9. in 3D: the header exists as real geometry over exactly the panels it
 *      spans, and those panels stop where it starts while their neighbour
 *      does not
 *  10. the header's own fabrication sheet states its wall IN WORDS, and a
 *      panel beneath it names the header above it
 *  11. no uncaught exception anywhere in the run
 *
 * HOW TO RUN (from the repo root):
 *   1. `npm run dev --workspace=apps/web -- -p 3215`
 *   2. `chrome --headless=new --remote-debugging-port=9449
 *      --window-size=1578,902 --user-data-dir=<temp> about:blank`
 *   3. `node apps/web/harness/smearforn-stage-2b/run.mjs`
 *
 * **`--window-size=1578,902` is required, not cosmetic** — it is the size of
 * the checked-in screenshots, and at the default headless window the viewer
 * dial never reaches "3D Framed": the run then dies looking like a broken
 * locator. Same reason the Stage 0/1 harness carries its own size note.
 *
 * **Use `localhost`, not `127.0.0.1`** — see the Stage 0/1 harness's note:
 * the dynamic-import chunks never arrive over 127.0.0.1 and the canvas
 * silently never appears.
 *
 * Knobs, both inherited and both used:
 *   - `SMEARFORN_CPU_THROTTLE=8` slows the page by that factor — a spanning
 *     header commits state AND re-tiles zones in one gesture, which is
 *     exactly the shape of edit that hides a race on a loaded machine.
 *   - `SMEARFORN_FOOTPRINT_PX=WxH` draws a smaller footprint. **A small one
 *     is a real fixture here, not just a faster run:** a wall with few, wide
 *     panels is where the 48in-144in span limits actually bite.
 *
 * `record()` REFUSES to run without an expectation, and the process exits
 * non-zero if any of them is false. A clean run exits 0 from the LAST TWO
 * LINES of this file, and they have to be there: the CDP WebSocket keeps the
 * event loop alive, so a passing run without them printed its tally and then
 * hung until the browser was killed, which made its only reachable exit code
 * non-zero. The `process.exit(0)` is reached only after the failure branch
 * above it has been tested.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeViewStopControl } from "../viewStopControl.mjs";
import { makeElevationZoomControl } from "../elevationZoom.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const APP_URL = process.env.SMEARFORN_APP_URL ?? "http://localhost:3215/";
const CDP_PORT = process.env.SMEARFORN_CDP_PORT ?? "9449";
/** Deliberately inverts ONE expectation, to prove this script can fail.
 * Measured rather than asserted in prose — see the README. */
const SELF_TEST_INVERT = process.env.SMEARFORN_SELF_TEST_INVERT === "1";

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
  evidence.failures = failures;
  fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log("\nevidence -> evidence.json");
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

const CPU_THROTTLE = Number(process.env.SMEARFORN_CPU_THROTTLE ?? "1");
if (CPU_THROTTLE > 1) {
  await send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE }, sid);
  console.log(`  (CPU throttled ${CPU_THROTTLE}x — reproducing a loaded machine)`);
  evidence.cpuThrottle = CPU_THROTTLE;
}

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

/** Click the first visible element whose trimmed text STARTS WITH `label` —
 * prefix, not equality, because the top bar's menu buttons append a caret. */
const clickByText = async (selector, label, what) => {
  const box = await evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.textContent.trim().startsWith(${JSON.stringify(label)}));
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        e.scrollIntoView({ block: 'center' });
        const r2 = e.getBoundingClientRect();
        if (r2.top < 0 || r2.left < 0) continue;
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
    const gs = [...document.querySelectorAll('svg g[data-panel-body]')];
    return gs
      .flatMap((g) => [...g.querySelectorAll('text')])
      .map((t) => t.textContent.trim())
      .filter((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t))
      .map((t) => Number(t.slice(0, -1)));
  })()`);

const sumEighths = (widths) => widths.reduce((sum, w) => sum + Math.round(w * 8), 0);

/**
 * Every spanning header the left bar is showing, read off its own controls.
 *
 * Keyed to the `aria-label`s, which exist because the control exists — not
 * to a CSS-module class (hashed) and not to an incidental neighbour element,
 * which is the locator mistake Stage 2's harness paid for.
 *
 * `spanText` is the app's own rendering (`77½"`); `spanIn` is that parsed
 * back to a number, since the imperial formatter uses fraction GLYPHS.
 */
const spanningHeaderRows = async () =>
  await evaluate(`(() => {
    const GLYPHS = { '\\u215B': 0.125, '\\u00BC': 0.25, '\\u215C': 0.375, '\\u00BD': 0.5, '\\u215D': 0.625, '\\u00BE': 0.75, '\\u215E': 0.875 };
    const parseIn = (text) => {
      if (!text) return null;
      const m = /^([0-9]*)([\\u215B\\u00BC\\u215C\\u00BD\\u215D\\u00BE\\u215E]?)"$/.exec(text.trim());
      if (!m) return null;
      const whole = m[1] === '' ? 0 : Number(m[1]);
      return whole + (m[2] ? GLYPHS[m[2]] : 0);
    };
    const byName = new Map();
    for (const el of document.querySelectorAll('input[aria-label^="Spanning header "]')) {
      const m = /^Spanning header (H[0-9]+) (.+)$/.exec(el.getAttribute('aria-label') || '');
      if (!m) continue;
      const name = m[1];
      const which = m[2];
      let row = byName.get(name);
      if (!row) {
        row = { name, startSlotIndex: null, endSlotIndex: null, spanText: null, spanIn: null, location: null };
        byName.set(name, row);
      }
      if (which === 'first panel') row.startSlotIndex = Number(el.value);
      if (which.startsWith('last panel')) row.endSlotIndex = Number(el.value);
      if (row.spanText === null) {
        // Climb to the row container: the first ancestor that holds a
        // <strong> naming this header. Its own value cell carries the span.
        let node = el.parentElement;
        for (let i = 0; i < 6 && node; i++) {
          const strong = node.querySelector('strong');
          if (strong && strong.textContent.trim() === name) {
            const texts = [...node.querySelectorAll('span')].map((s) => s.textContent.trim());
            row.spanText = texts.find((t) => /^[0-9]*[\\u215B\\u00BC\\u215C\\u00BD\\u215D\\u00BE\\u215E]?"$/.test(t)) ?? null;
            row.spanIn = parseIn(row.spanText);
            const p = [...node.querySelectorAll('p')].map((x) => x.textContent.trim()).find((t) => t.includes('spans'));
            row.location = p ?? null;
            break;
          }
          node = node.parentElement;
        }
      }
    }
    return [...byName.values()];
  })()`);

/**
 * Sets one of a header's slot-range fields the way a user does.
 *
 * **Typed, then Enter** — the same gesture `commitStop` below uses on the
 * wall-run-stop field, and for the same reason: these fields now commit on
 * blur/Enter rather than per keystroke (`SlotIndexInput`), because committing
 * per keystroke meant clearing the field sent `Number("") === 0` and quietly
 * moved the header to slot 0. A harness that only dispatched `input` would
 * type into the draft and never commit it, so this is deliberately the full
 * gesture and not an `input` shortcut.
 */
const setHeaderSlot = async (name, which, value) => {
  await evaluate(`(() => {
    const label = ${JSON.stringify(`Spanning header ${name} `)} + ${JSON.stringify(which)};
    const el = [...document.querySelectorAll('input[aria-label^="Spanning header "]')]
      .find((x) => (x.getAttribute('aria-label') || '').startsWith(label));
    if (!el) throw new Error('no such spanning header field: ' + label);
    el.scrollIntoView({ block: 'center' });
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);
  await sleep(900);
};

/**
 * The elevation's own notice line — the placement tool's and the spanning
 * header's share it — or `null` when the app is showing none.
 *
 * ⚠ **THIS USED TO BE A REGEX OVER EVERY `<p>` IN THE DOCUMENT, AND IT WAS A
 * STALE-VALUE READER.** It matched `/^(Placed|Inserted|Replaced|Deleted|
 * Refused)/`, and **three real refusal sentences begin with none of those**
 * (`apps/web/app/placementNotice.ts`):
 *
 *   - `rule-placed-slot`: "Corner and safety-gap panels are placed by rule,
 *     not by hand — …"
 *   - `refuse-not-placeable` otherwise: "There is nowhere on this wall to put
 *     a panel there. Nothing was changed."
 *   - `no-change`: "That panel is already what the tool is set to, so nothing
 *     changed."
 *
 * The app's notice is ONE paragraph that lingers for 8s and is replaced in
 * place, so a gesture refused with one of those sentences did not read back
 * as nothing — it read back as **the previous step's notice**. Measured:
 * arming Delete and clicking the 0.75in safety gap leaves the widths and the
 * header untouched and returns `null` from a clean line, but with step 7's
 * refusal still on screen the old reader returned *that* instead, verbatim,
 * including its `span 160"` — which is exactly how a harness problem got read
 * as a spanning-header regression. (The 0.75in gap is drawn at a minimum
 * legible width of about 60px rather than to scale, so it always clears the
 * `p.w > 4` filter in `panelBodies` and is always a clickable entry.)
 *
 * So the notice is now located STRUCTURALLY rather than by sentence: it is
 * the one optional `<p>` that follows the tool's permanent help text inside
 * the "Place a panel" section header (`{panelPlacementNotice && <p …>}` in
 * `page.tsx`). It returns whatever the app wrote — every sentence above
 * included — and it **throws** rather than returning `null` when that section
 * is missing or holds a shape it does not recognise, because a locator that
 * has stopped working must go RED and not quiet.
 *
 * Pair it with `clearNotice()` below before any gesture whose notice is
 * asserted.
 */
const notice = async () => {
  const ps = await evaluate(`(() => {
    const group = document.querySelector('[aria-label="Panel placement tool"]');
    if (!group || !group.parentElement) return null;
    return [...group.parentElement.querySelectorAll('p')].map((p) => p.textContent.trim());
  })()`);
  if (ps === null) throw new Error('no "Place a panel" section on this view — the notice reader cannot even ask its question');
  // [0] is the tool's permanent help text, which is rendered unconditionally.
  if (ps.length === 1) return null;
  if (ps.length === 2) return ps[1];
  throw new Error(
    `the "Place a panel" section now holds ${ps.length} paragraphs, not the help text plus at most one notice — ` +
      `this locator no longer knows which one is the notice: ${JSON.stringify(ps)}`,
  );
};

/**
 * Waits for the app to put its notice away, so the next read of it cannot
 * return an older sentence.
 *
 * **Waits rather than blanking the DOM, deliberately.** The obvious "clear" —
 * setting the paragraph's `textContent` to "" — detaches the text node React
 * is holding, so the NEXT real notice would be written to a node that is no
 * longer on the page and `notice()` would return `null` for a sentence the
 * app really did show. That is the same false-green, inverted. The app
 * retires the notice itself after 8s (`showPanelPlacementNotice`), so this
 * polls for that and throws if it never happens.
 */
const clearNotice = async (budgetMs = 15000) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const current = await notice();
    if (current === null) return null;
    if (Date.now() > deadline) {
      throw new Error(`the notice line would not clear in ${budgetMs}ms — it still reads ${JSON.stringify(current)}`);
    }
    await sleep(500);
  }
};

/** Text drawn inside the elevation SVG — the header's own H label lives here. */
const svgTexts = async () =>
  await evaluate(`(() => [...document.querySelectorAll('svg text')].map((t) => t.textContent.trim()))()`);

/**
 * Walks a header's range to `(start, end)` ONE index at a time, alternating
 * ends so every intermediate state is itself legal.
 *
 * Not a nicety: the controls commit each field on its own, and the app
 * validates each commit. Setting the far end first turns a two-panel span
 * into a four-panel one, which on a wall of 40in panels is 160in — over the
 * 144in maximum, so it is refused and the move silently does not happen.
 * The first version of this script did exactly that and then measured the
 * header it had failed to move. Stepping keeps the span at two or three
 * panels throughout.
 */
const moveHeaderTo = async (name, targetStart, targetEnd) => {
  let rows = await spanningHeaderRows();
  let row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`no header ${name} to move`);
  let { startSlotIndex: start, endSlotIndex: end } = row;
  for (let guard = 0; guard < 24 && (start !== targetStart || end !== targetEnd); guard++) {
    if (end < targetEnd) {
      end += 1;
      await setHeaderSlot(name, "last panel", end);
    } else if (end > targetEnd && end - 1 - start >= 2) {
      end -= 1;
      await setHeaderSlot(name, "last panel", end);
    }
    if (start < targetStart && end - (start + 1) >= 2) {
      start += 1;
      await setHeaderSlot(name, "first panel", start);
    } else if (start > targetStart) {
      start -= 1;
      await setHeaderSlot(name, "first panel", start);
    }
    rows = await spanningHeaderRows();
    row = rows.find((r) => r.name === name);
    if (!row) throw new Error(`header ${name} disappeared while moving it`);
    start = row.startSlotIndex;
    end = row.endSlotIndex;
  }
  return { startSlotIndex: start, endSlotIndex: end };
};

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
 * Sets a placement tool to a wanted armed/disarmed state and CHECKS IT — a
 * click that misses silently tests the previous tool, which is Stage 2's own
 * recorded lesson.
 *
 * The button is driven with its own `click()` rather than a synthetic mouse
 * event at a measured coordinate, and deliberately: this sidebar is longer
 * than Stage 2's was (there is a Spanning Headers section above the tool
 * now), so the tool can sit below the fold even after `scrollIntoView`, and
 * a mouse event at an off-screen coordinate hits nothing while looking like
 * "the tool would not arm". Real mouse events are still used for everything
 * that needs hit-testing — every click on the elevation itself.
 */
const setTool = async (label, wantArmed) => {
  const current = await toolButton(label);
  if (!current) throw new Error(`no "${label}" button in the placement group`);
  if (current.pressed !== wantArmed) {
    await evaluate(`(() => {
      const group = document.querySelector('[aria-label="Panel placement tool"]');
      const b = group && [...group.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
      if (!b) throw new Error('no such tool button');
      b.scrollIntoView({ block: 'center' });
      b.click();
    })()`);
    await sleep(600);
  }
  const after = await toolButton(label);
  if (!after || after.pressed !== wantArmed) throw new Error(`"${label}" is ${after?.pressed ? "armed" : "not armed"}, wanted ${wantArmed}`);
  await evaluate(`(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('g[style*="pointer"]'));
    if (svg) svg.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(400);
  return after;
};

/**
 * Panel bodies (the coloured rects), left to right, with their own boxes.
 *
 * ⚠ **VIEWPORT-CROPPED, AND `panelWidths` IS NOT.** The last filter keeps
 * only groups whose box is inside the window, because every coordinate here
 * is fed to a real mouse event and a click at an off-screen coordinate hits
 * nothing. Since the 2026-09-29 fit-height/scroll-width change a long wall is
 * wider than the window, so **the index of an entry here is the index of a
 * slot on the wall only when the whole wall is on screen.** Bring it on
 * screen with `makeElevationZoomControl(...).fitWholeWall()` and assert that
 * it worked before indexing into this — step 8 does both.
 *
 * `fill` is the colour of the largest filled rect in the group, which is how
 * this reader tells a hand-placeable panel from a rule-placed one without an
 * app change: `SLOT_COLORS` in `WallElevationDiagram.tsx` paints a standard
 * slot #d9c9a3 and a braced one #b06fc9, while corner (#8a8a8a),
 * safety-oct-corner (#5c4a2e) and safety-gap (#e08a3c) — exactly the types
 * `PLACEABLE_PANEL_TYPES` leaves out — get their own. Matched POSITIVELY
 * against the two placeable colours, so a palette change makes the pick fail
 * to find a target and throw, rather than silently picking a corner.
 */
const panelBodies = async () =>
  await evaluate(`(() => {
    return [...document.querySelectorAll('svg g[data-panel-body]')]
      .filter((g) => [...g.querySelectorAll('text')].some((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t.textContent.trim())))
      .map((g) => {
        const r = g.getBoundingClientRect();
        const label = [...g.querySelectorAll('text')].map((t) => t.textContent.trim()).find((t) => /^[0-9]+(\\.[0-9]+)?"$/.test(t));
        let fill = null;
        let bestArea = -1;
        for (const rect of g.querySelectorAll('rect')) {
          const f = rect.getAttribute('fill');
          if (!f || f === 'none') continue;
          const rb = rect.getBoundingClientRect();
          const area = rb.width * rb.height;
          if (area > bestArea) { bestArea = area; fill = f; }
        }
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, label, fill };
      })
      .filter((p) => p.w > 4 && p.x > 250 && p.x < window.innerWidth - 40 && p.y > 60 && p.y < window.innerHeight - 40)
      .sort((a, b) => a.x - b.x);
  })()`);

/**
 * The two `SLOT_COLORS` a hand tool is allowed to delete — the standard
 * family. Everything else on the wall is either an opening (which this step
 * has no business deleting) or rule-placed (which the app refuses by name).
 */
const FREE_SLOT_FILLS = { "#d9c9a3": "standard", "#b06fc9": "braced" };

/** The Stop Wall field for one end, plus whatever refusal it is showing. */
const stopField = async (end) =>
  await evaluate(`(() => {
    const el = document.querySelector('[id^="wall-run-stop-${end}-"]');
    if (!el) return null;
    const wrap = el.closest('label') || el.parentElement;
    const msg = wrap ? [...wrap.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.length > 0) ?? null : null;
    return { value: el.value, invalid: el.getAttribute('aria-invalid') === 'true', message: msg };
  })()`);

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
  await sleep(1000);
};

// --- the 3D scene, as the OBJ export describes it ---------------------------

const captureObj = async () => {
  await evaluate(`(() => {
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
  await sleep(600);
  const text = await evaluate(`(async () => {
    const t = window.__objBlob ? await window.__objBlob.text() : null;
    if (window.__objRestore) window.__objRestore();
    window.__objBlob = null;
    return t;
  })()`);
  if (!text) throw new Error("the OBJ export produced nothing — is the 3D view mounted?");
  return text;
};

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
 * one axis. Null when no such group exists — itself a meaningful answer, and
 * the reason every 3D step below checks for null explicitly rather than
 * letting a missing group read as a pass. */
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
/**
 * POLLED, not a fixed sleep. A cold `next dev` compiles this route on the
 * first request and can take well past any figure worth hard-coding — the
 * fixed 12s this used to wait meant a cold server failed at step 2 with
 * *"no canvas — are you on localhost rather than 127.0.0.1?"*, which names
 * the wrong cause entirely and sent a reader off checking the host.
 */
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

console.log("2. drawing a footprint");
const canvasBox = await waitForCanvas(120000);
if (!canvasBox) {
  throw new Error(
    "no canvas after 120s. Either the dev server is still compiling this route (watch its own log), or the page never " +
      "hydrated — and if the URL is 127.0.0.1 rather than localhost, the dynamic-import chunks never arrive and the " +
      "canvas silently never appears.",
  );
}
const [cx, cy, cw, ch] = canvasBox;
const FOOTPRINT_SPEC = process.env.SMEARFORN_FOOTPRINT_PX ?? "";
const [specW, specH] = FOOTPRINT_SPEC.split("x").map((n) => Number(n));
const footprintW = Number.isFinite(specW) && specW > 0 ? specW : 0;
const footprintH = Number.isFinite(specH) && specH > 0 ? specH : footprintW;
const x0 = cx + 60;
const y0 = cy + 80;
const x1 = footprintW > 0 ? x0 + footprintW : cx + cw - 80;
const y1 = footprintH > 0 ? y0 + footprintH : cy + ch - 120;
if (footprintW > 0) {
  console.log(`  (drawing a ${footprintW}x${footprintH}px footprint)`);
  evidence.footprintPx = `${footprintW}x${footprintH}`;
}
await mouse("mousePressed", x0, y0);
await sleep(80);
await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2);
await sleep(80);
await mouse("mouseMoved", x1, y1);
await sleep(80);
await mouse("mouseReleased", x1, y1);
await sleep(1800);

console.log("3. baseline 3D scene");
/**
 * ⚠ THIS HARNESS WAS BROKEN BY U1 AND NOBODY NOTICED — fixed 2026-09-28.
 *
 * It used to carry its own copy of the two view-dial locators
 * (`[aria-label="View mode"]`, and the button whose text is `▼`). U1 made the
 * dial the below-breakpoint form and put Design/View menus on the top bar
 * above it. This harness runs at **1578px**, which is above that boundary
 * however it has been set — 1200px as U1 shipped, 1454px since — so the dial
 * is `display: none` here and the private locator matched nothing.
 *
 * U1 fixed exactly this in "the three Smearforn locators" plus U0's. **There
 * are four Smearforn harnesses, not three**, and this is the fourth: it was
 * counted out, never re-run, and its checked-in `evidence.json` is dated
 * 2026-09-26 — before U1. The failure mode was the one `viewStopControl.mjs`
 * exists to prevent, and it is worth noting that it did NOT fail silently in
 * the end: `dialStep` threw "the viewer dial is not on screen" rather than
 * reporting a view it never reached. That throw is the only reason this was
 * found at all.
 *
 * So it now reads the shared control like the other four, and is width-
 * agnostic from here: the helper asks the page which form is live instead of
 * deciding from the window size.
 */
const view = makeViewStopControl({ evaluate, sleep });
const reachView = async (predicate, what) => await view.reach(predicate, what);
const closeOpenNotes = async () => {
  await evaluate(`(() => { for (const b of [...document.querySelectorAll('button[title="Hide this note"]')]) b.click(); })()`);
  await sleep(700);
};

await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objBaseline = parseObjGroups(await captureObj());
await shot("00-3d-baseline");

/** Ground-floor wall panels carry NO prefix — see this file's own header. */
const NON_WALL_PREFIXES = new Set(["story2", "gable", "roofbearing", "balefoundation", "midwallbeam", "trussplate", "boxbeam", "spanningheader"]);
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
const slotCountFor = (groups, wallId) => {
  let max = -1;
  for (const name of groups.keys()) {
    const m = new RegExp(`^${wallId}_(\\d+)_`).exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
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
const slotExtents = [];
if (targetWallId) {
  for (let i = 0; i < slotCountFor(objBaseline, targetWallId); i++) {
    slotExtents.push(extentAlong(objBaseline, `${targetWallId}_${i}_`, targetAxis));
  }
}
const secondWallId = wallIdsInObj.find((id) => id !== targetWallId) ?? null;
record(
  "baseline-3d-found-real-walls-and-slots",
  {
    wallIds: wallIdsInObj,
    targetWallId,
    targetAxis,
    slotCount: slotExtents.length,
    slotWidthsIn: slotExtents.map((e) => (e ? Number(e.lengthIn.toFixed(3)) : null)),
  },
  // Asserted, not assumed: every later 3D claim is vacuous if this reader
  // matched nothing, which is exactly how a `wall_` prefix assumption once
  // reported green while checking nothing at all.
  (d) => !!d.targetWallId && d.slotCount >= 5 && d.slotWidthsIn.every((w) => typeof w === "number" && w > 0),
);
if (!targetWallId) throw new Error("no wall geometry in the baseline OBJ — nothing later can mean anything");

console.log(`4. opening wall ${targetWallId}'s elevation`);
await reachView((l) => l.startsWith("Elevation") && l.includes(targetWallId), `Elevation: ${targetWallId}`);
await sleep(1400);
const widthsBefore = await panelWidths();
await shot("01-elevation-before-header");
record(
  "elevation-before-header",
  { panelCount: widthsBefore.length, totalEighths: sumEighths(widthsBefore) },
  (d) => d.panelCount >= 3 && d.totalEighths > 0,
);

/**
 * ⚠ IS THIS EVEN THE BUILD UNDER TEST?
 *
 * Recorded as its own named check because it already caught a real one: port
 * 3215 was ALREADY OCCUPIED by another checkout's dev server, `next dev`
 * failed with EADDRINUSE, and the harness happily drove a build with no
 * Stage 2b in it — drawing a footprint, measuring walls, passing its first
 * two checks — before dying on a missing button five steps later with a
 * message about a locator.
 *
 * A feature-presence check turns "wrong server" into one loud, named
 * failure instead of a puzzle. Same family as the `node_modules` junction
 * warning in the build notes: a green-looking run against the wrong code is
 * the most expensive kind of wrong.
 */
const addButtonPresent = await evaluate(
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('+ Add Spanning Header'))`,
);
record(
  "the-app-under-test-actually-has-stage-2b-in-it",
  { addButtonPresent, url: APP_URL },
  (d) => d.addButtonPresent === true,
);
if (!addButtonPresent) throw new Error(`no Stage 2b in the build at ${APP_URL} — is another checkout's dev server on that port?`);

console.log("5. adding a spanning header over two real panels");
// Slots 2 and 3: real standard panels, clear of the corner at either end.
const SPAN_START = 2;
const SPAN_END = 4;
const expectedSpanIn = slotExtents[SPAN_START] && slotExtents[SPAN_END - 1] ? slotExtents[SPAN_START].lengthIn + slotExtents[SPAN_END - 1].lengthIn : null;
// Snapshot-and-clear before every gesture whose notice is asserted — see
// `clearNotice`. Nothing has spoken yet here, so this is free; it is done
// anyway so the pattern is the same at all four sites rather than something
// a reader has to decide about.
const noticeBeforeAdd = await clearNotice();
await clickByText("button", "+ Add Spanning Header", "Add Spanning Header button");
await sleep(1000);
const addNotice = await notice();
let rows = await spanningHeaderRows();
if (rows.length === 1 && (rows[0].startSlotIndex !== SPAN_START || rows[0].endSlotIndex !== SPAN_END)) {
  await moveHeaderTo(rows[0].name, SPAN_START, SPAN_END);
  rows = await spanningHeaderRows();
}
const widthsAfter = await panelWidths();
await shot("02-elevation-with-header");
const headerName = rows[0]?.name ?? null;
const labelsInSvg = await svgTexts();
record(
  "header-spans-exactly-the-panels-beneath-it-and-adds-no-width",
  {
    noticeBeforeAdd,
    addNotice,
    // ⚠ `headerName`, NOT `name`: `record()` spreads a step's detail into the
    // step object, so a detail key called `name` silently OVERWRITES the
    // step's own name in `evidence.json` — the first run of this script
    // produced two steps both called "H1", which is a checked-in artefact
    // that cannot be read. Found by reading the artefact rather than the log.
    headerName,
    startSlotIndex: rows[0]?.startSlotIndex ?? null,
    endSlotIndex: rows[0]?.endSlotIndex ?? null,
    spanText: rows[0]?.spanText ?? null,
    spanIn: rows[0]?.spanIn ?? null,
    expectedSpanIn: expectedSpanIn === null ? null : Number(expectedSpanIn.toFixed(3)),
    totalEighthsBefore: sumEighths(widthsBefore),
    totalEighthsAfter: sumEighths(widthsAfter),
    drawnOnTheElevation: labelsInSvg.includes(headerName ?? " "),
  },
  // Three claims at once, and they are the stage: the span IS the panels
  // beneath (measured off the 3D model, not read back off the same field),
  // the wall's own total does not move by an eighth, and the header is
  // actually drawn.
  (d) =>
    d.noticeBeforeAdd === null &&
    d.headerName !== null &&
    d.startSlotIndex === SPAN_START &&
    d.endSlotIndex === SPAN_END &&
    d.spanIn !== null &&
    d.expectedSpanIn !== null &&
    Math.abs(d.spanIn - d.expectedSpanIn) < 0.2 &&
    d.totalEighthsAfter === d.totalEighthsBefore &&
    d.drawnOnTheElevation === true,
);
record(
  "the-name-carries-no-direction-at-all",
  { headerName, location: rows[0]?.location ?? null },
  // Tommy's decision, and the detail most likely to be assumed otherwise: a
  // header is named from ONE building-wide series, so its name says what it
  // is and nothing about where it is — which is why the wall has to be
  // stated in words beside it.
  (d) =>
    /^H[0-9]+$/.test(d.headerName ?? "") &&
    typeof d.location === "string" &&
    /\b(North|South|East|West)/.test(d.location) &&
    d.location.includes("spans"),
);

console.log("6. a header on a DIFFERENT wall joins the same series");
let secondName = null;
if (secondWallId) {
  await reachView((l) => l.startsWith("Elevation") && l.includes(secondWallId), `Elevation: ${secondWallId}`);
  await sleep(1200);
  await clickByText("button", "+ Add Spanning Header", "Add Spanning Header button");
  await sleep(1000);
  const rows2 = await spanningHeaderRows();
  secondName = rows2[0]?.name ?? null;
  await shot("03-second-wall-header");
}
record(
  "one-building-wide-H-series-across-two-walls",
  { firstWall: targetWallId, secondWall: secondWallId, firstName: headerName, secondName },
  // A per-wall counter is the natural thing to write by mistake, and it
  // would give H1 on both walls. Numbering follows the footprint's own wall
  // order, so which wall gets H1 is not asserted — only that there are two
  // distinct names from one series.
  (d) =>
    d.secondWall !== null &&
    /^H[0-9]+$/.test(d.secondName ?? "") &&
    d.secondName !== d.firstName &&
    new Set([d.firstName, d.secondName]).size === 2 &&
    [d.firstName, d.secondName].sort().join(",") === "H1,H2",
);

console.log("7. back to the first wall — the refusals");
await reachView((l) => l.startsWith("Elevation") && l.includes(targetWallId), `Elevation: ${targetWallId}`);
await sleep(1200);
rows = await spanningHeaderRows();
const firstRowName = rows[0]?.name ?? headerName;
const noticeBeforeSingleSlot = await clearNotice();
await setHeaderSlot(firstRowName, "last panel", SPAN_START + 1);
const singleSlotNotice = await notice();
const rowsAfterSingle = await spanningHeaderRows();
record(
  "a-one-panel-span-is-refused-and-changes-nothing",
  {
    noticeBeforeSingleSlot,
    notice: singleSlotNotice,
    startSlotIndex: rowsAfterSingle[0]?.startSlotIndex ?? null,
    endSlotIndex: rowsAfterSingle[0]?.endSlotIndex ?? null,
  },
  // A header above ONE panel is already expressible inside that column, so
  // this record refuses it rather than quietly duplicating the concept — and
  // a refusal writes nothing at all.
  (d) =>
    d.noticeBeforeSingleSlot === null &&
    typeof d.notice === "string" &&
    d.notice.startsWith("Refused") &&
    d.notice.includes("at least two panels") &&
    d.endSlotIndex === SPAN_END,
);

// A span past the catalog maximum. Widened one panel at a time off the REAL
// slot widths, so this is a genuine over-range span rather than a guess.
let overRangeEnd = null;
let overRangeSpanIn = 0;
for (let end = SPAN_START + 2; end <= slotExtents.length; end++) {
  let total = 0;
  for (let i = SPAN_START; i < end; i++) total += slotExtents[i]?.lengthIn ?? 0;
  if (total > 144) {
    overRangeEnd = end;
    overRangeSpanIn = total;
    break;
  }
}
if (overRangeEnd === null) {
  record(
    "a-span-past-12ft-is-refused-rather-than-the-range-widened",
    { reason: "this wall is not long enough to build an over-range span", slotCount: slotExtents.length },
    observationOnly("no run of panels on this wall exceeds the 144in maximum, so the refusal cannot be exercised here"),
  );
} else {
  const noticeBeforeOverRange = await clearNotice();
  await setHeaderSlot(firstRowName, "last panel", overRangeEnd);
  const overRangeNotice = await notice();
  const rowsAfterOver = await spanningHeaderRows();
  record(
    "a-span-past-12ft-is-refused-rather-than-the-range-widened",
    {
      noticeBeforeOverRange,
      attemptedEnd: overRangeEnd,
      attemptedSpanIn: Number(overRangeSpanIn.toFixed(3)),
      notice: overRangeNotice,
      endSlotIndex: rowsAfterOver[0]?.endSlotIndex ?? null,
    },
    // `bigHeaderWidthInRange` is Tommy's own stated range and is pending BI
    // confirmation. The rule is that it does NOT get widened to fit a
    // drawing — so the app refuses, quotes the numbers, and says the range
    // is not confirmed.
    (d) =>
      d.noticeBeforeOverRange === null &&
      typeof d.notice === "string" &&
      d.notice.startsWith("Refused") &&
      d.notice.includes("144") &&
      d.notice.includes("not confirmed") &&
      d.notice.includes("not widened") &&
      d.endSlotIndex === SPAN_END,
  );
}

console.log("8. deleting a panel to the LEFT — the header rides Stage 2's shift");
/**
 * ⚠ **`bodies[1]` USED TO BE THE TARGET, AND IT IS NOT SLOT 1.**
 *
 * The comment that stood here said *"Index 1: inside the run, left of the
 * span, and not the corner at index 0"*, which was false by construction from
 * the moment the elevation learned to scroll. `panelBodies()` is
 * viewport-cropped (see its own comment), so `bodies` is a WINDOW onto the
 * wall, not the wall: with 15 panels and 6 on screen, `bodies[1]` is slot 1
 * only because `scrollLeft` happens to default to 0. Forcing `scrollLeft` to
 * its maximum reproduces the other case exactly — `bodies` becomes slots
 * 8..14, `bodies[1]` is a panel to the RIGHT of the header, the delete
 * succeeds, the header's range correctly does NOT shift, and this step fails
 * on an app that did nothing wrong. It also cascades into step 9, which then
 * measures a stop that no longer runs under the header.
 *
 * Two changes, and both are needed:
 *
 * 1. **Fit the whole wall first** — `elevation-fit` added this to stage-3,
 *    `ui-reorg-u0` and `ui-reorg-u1` and never to stage-2b. With the whole
 *    wall on screen the crop takes nothing out, so an index here IS a slot
 *    index; that equality is asserted below rather than assumed.
 * 2. **Choose the target by what it is, not by where it sits in an array** —
 *    a slot LEFT of the header's first panel that is in the standard family,
 *    i.e. not the corner and not a rule-placed safety gap. The pick is
 *    recorded and asserted, so it can never silently drift again.
 */
// Step 7 scrolled a header's slot-index field into view, which can take the
// elevation and its Zoom out button off screen — and `fitWholeWall` presses
// that button by its screen coordinate. Same guard `setTool` carries.
await evaluate(`(() => {
  const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('g[style*="pointer"]'));
  if (svg) svg.scrollIntoView({ block: 'center' });
})()`);
await sleep(400);
const wholeWallForDelete = await makeElevationZoomControl({ evaluate, sleep, click }).fitWholeWall();
const spanBeforeDelete = (await spanningHeaderRows())[0];
await setTool("Delete", true);
const bodies = await panelBodies();
const widthsBeforeDelete = await panelWidths();
const startBeforeDelete = spanBeforeDelete?.startSlotIndex ?? null;
const deleteTarget = (() => {
  if (startBeforeDelete === null) return null;
  for (let i = 1; i < startBeforeDelete && i < bodies.length; i++) {
    const kind = FREE_SLOT_FILLS[bodies[i].fill];
    if (kind) return { index: i, kind, ...bodies[i] };
  }
  return null;
})();
if (!deleteTarget) {
  throw new Error(
    `no standard-family slot between the corner and the header's first panel (${startBeforeDelete}) to delete — ` +
      `fills left of it were ${JSON.stringify(bodies.slice(0, startBeforeDelete ?? 0).map((b) => b.fill))}`,
  );
}
// Snapshot-and-clear, so `deleteNotice` below is this click's own answer or
// nothing at all — never step 7's refusal read back as this step's result.
const noticeBeforeDelete = await clearNotice();
await click(deleteTarget.x, deleteTarget.y);
await sleep(900);
const deleteNotice = await notice();
await setTool("Delete", false); // stand the tool down so later steps behave normally
const rowsAfterDelete = await spanningHeaderRows();
record(
  "deleting-a-panel-left-of-the-header-moves-its-range-not-its-span",
  {
    wholeWallOnScreen: wholeWallForDelete.wholeWallVisible,
    zoomOutClicks: wholeWallForDelete.clicks,
    clickableBodies: bodies.length,
    panelsOnTheWall: widthsBeforeDelete.length,
    slotsInBaselineObj: slotExtents.length,
    deleteTargetIndex: deleteTarget.index,
    deleteTargetKind: deleteTarget.kind,
    deleteTargetLabel: deleteTarget.label,
    deleteTargetWidthLabelFromWidths: `${widthsBeforeDelete[deleteTarget.index]}"`,
    noticeBeforeDelete,
    deleteNotice,
    startBefore: spanBeforeDelete?.startSlotIndex ?? null,
    startAfter: rowsAfterDelete[0]?.startSlotIndex ?? null,
    endBefore: spanBeforeDelete?.endSlotIndex ?? null,
    endAfter: rowsAfterDelete[0]?.endSlotIndex ?? null,
    spanBeforeIn: spanBeforeDelete?.spanIn ?? null,
    spanAfterIn: rowsAfterDelete[0]?.spanIn ?? null,
  },
  // The header's range must move by one so it still covers the SAME panels
  // — that is `shiftSlotCoverage`, the machinery Stage 2 already wrote and
  // this stage reuses rather than copying.
  //
  // ⚠ And the free run re-tiles flat when a panel goes, so the header's own
  // fabricated WIDTH can change even though the right panels are still
  // underneath — the committed run measured 80in -> 85.75in. ⚠ That second
  // number is NOT reproducible: four runs of this script on the same checkout
  // and the same 549in wall gave 82.375in, 84.75in, 85.75in and 84.75in, because the
  // footprint is drawn in PIXELS so the baseline tiling lands differently and
  // the post-delete redistribution follows it. Read it off `evidence.json`,
  // never from memory. That is a part already on
  // a shop sheet being re-cut, so the notice has to SAY so: if the span moved,
  // the notice must name it. (Conditional on purpose — on a wall where the
  // re-tile happens to preserve the width there is nothing to report, and
  // demanding the clause anyway would be asserting an accident of the
  // fixture.)
  (d) =>
    // ⚠ FIRST: the target really was the slot this step meant. Every clause
    // below is about a panel LEFT of the header, so if the pick drifted the
    // rest of this check is measuring a different gesture. The whole wall is
    // on screen, the cropped reader therefore cropped nothing (three counts
    // agreeing: clickable bodies, width labels, slots in the 3D model), the
    // chosen index is between the corner and the header, it is a
    // standard-family panel rather than a rule-placed one, and the label on
    // the body matches the width label at that index.
    d.wholeWallOnScreen === true &&
    d.clickableBodies === d.panelsOnTheWall &&
    d.clickableBodies === d.slotsInBaselineObj &&
    d.deleteTargetIndex >= 1 &&
    d.deleteTargetIndex < d.startBefore &&
    (d.deleteTargetKind === "standard" || d.deleteTargetKind === "braced") &&
    d.deleteTargetLabel === d.deleteTargetWidthLabelFromWidths &&
    // …and the notice below is this gesture's, not a leftover.
    d.noticeBeforeDelete === null &&
    typeof d.deleteNotice === "string" &&
    d.deleteNotice.startsWith("Deleted") &&
    d.startAfter === d.startBefore - 1 &&
    d.endAfter === d.endBefore - 1 &&
    (d.spanAfterIn === d.spanBeforeIn || /still spans its panels, but those panels are now a different width/.test(d.deleteNotice)),
);

console.log("9. a wall-run stop under the header is refused by name");
/**
 * ⚠ **IF THIS STEP FAILS, LOOK AT STEP 8 BEFORE YOU LOOK AT THE APP.** It has
 * already produced one false alarm as a pure cascade.
 *
 * When step 8's `bodies[1]` picked a panel to the RIGHT of the header instead
 * of the left (see step 8's own comment), the wall going into this step was
 * not the one this step is about, and the app ACCEPTED the 60in stop. That
 * acceptance was **correct**, and it was measured across the stop rather than
 * argued: the header's covered slot count stayed at 2 and its span stayed
 * 80in. The 60in came entirely out of the tail — two tail panels went
 * 34.125in → 24.125in and one 40in panel was dropped — so not one of the
 * header's own panels was re-cut. **Refusing there would have been a FALSE
 * refusal**, and "make the app refuse" would have been the wrong fix.
 *
 * With step 8 deleting a panel left of the header, this step exercises its
 * real intent again: a 14-panel wall whose stop genuinely runs under H1.
 */
const widthsBeforeStop = await panelWidths();
await commitStop("start", 60);
const stopAfter = await stopField("start");
const widthsAfterStop = await panelWidths();
record(
  "a-stop-that-would-re-cut-a-header-is-refused-by-name",
  {
    message: stopAfter?.message ?? null,
    value: stopAfter?.value ?? null,
    totalEighthsBefore: sumEighths(widthsBeforeStop),
    totalEighthsAfter: sumEighths(widthsAfterStop),
  },
  // Stage 3 re-tiles a stopped wall wholesale, so a header's range would
  // come out over different panels of different widths — a real part, on a
  // real sheet, silently re-cut. Refusing loudly is the answer, and the
  // wall is left exactly as it was.
  (d) =>
    typeof d.message === "string" &&
    /\bH[0-9]+\b/.test(d.message) &&
    d.message.includes("Nothing was changed") &&
    d.totalEighthsAfter === d.totalEighthsBefore,
);

console.log("10. the 3D scene");
await reachView((l) => l === "3D Framed", "3D Framed");
await sleep(2500);
const objWithHeader = parseObjGroups(await captureObj());
await shot("04-3d-with-header");
const liveRows = rowsAfterDelete.length > 0 ? rowsAfterDelete : rows;
const liveName = liveRows[0]?.name ?? firstRowName;
const liveStart = liveRows[0]?.startSlotIndex ?? SPAN_START - 1;
const liveEnd = liveRows[0]?.endSlotIndex ?? SPAN_END - 1;
// The OBJ names a header group `spanningheader_<H name>_<story>_<wall>_…` —
// matched on the H name, which is the identity that reaches a sheet. Written
// as a PREFIX match against the real label, not a guess: assuming a prefix
// is what made a whole 3D pass vacuous in a previous harness.
const headerPrefix = `spanningheader_${liveName}_`;
const headerGroupNames = [...objWithHeader.keys()].filter((k) => k.startsWith(headerPrefix));
const headerExtentAll = (() => {
  let min = Infinity;
  let max = -Infinity;
  let minY = Infinity;
  let count = 0;
  for (const [name, verts] of objWithHeader) {
    if (!name.startsWith(headerPrefix)) continue;
    for (const v of verts) {
      min = Math.min(min, v[targetAxis]);
      max = Math.max(max, v[targetAxis]);
      minY = Math.min(minY, v[1]);
      count++;
    }
  }
  return count === 0 ? null : { minIn: min, maxIn: max, lengthIn: max - min, bottomYFt: minY, vertices: count };
})();
const coveredExtents = [];
for (let i = liveStart; i < liveEnd; i++) coveredExtents.push(extentAlong(objWithHeader, `${targetWallId}_${i}_`, targetAxis));
const coveredRun =
  coveredExtents.every((e) => e !== null) && coveredExtents.length > 0
    ? {
        minIn: Math.min(...coveredExtents.map((e) => e.minIn)),
        maxIn: Math.max(...coveredExtents.map((e) => e.maxIn)),
      }
    : null;
record(
  "3d-draws-the-header-over-exactly-the-panels-it-spans",
  {
    headerGroups: headerGroupNames.length,
    headerExtent: headerExtentAll
      ? { lengthIn: Number(headerExtentAll.lengthIn.toFixed(3)), vertices: headerExtentAll.vertices }
      : null,
    coveredRunLengthIn: coveredRun ? Number((coveredRun.maxIn - coveredRun.minIn).toFixed(3)) : null,
    alignmentIn: coveredRun && headerExtentAll ? Number(Math.abs(headerExtentAll.minIn - coveredRun.minIn).toFixed(3)) : null,
  },
  // Not "some geometry exists somewhere": a header group with real vertices,
  // spanning the same run as the panels beneath it, to within an eighth.
  (d) =>
    d.headerGroups > 0 &&
    d.headerExtent !== null &&
    d.headerExtent.vertices > 0 &&
    d.coveredRunLengthIn !== null &&
    Math.abs(d.headerExtent.lengthIn - d.coveredRunLengthIn) < 0.2 &&
    d.alignmentIn !== null &&
    d.alignmentIn < 0.2,
);

const topYOf = (groups, prefix) => {
  let max = -Infinity;
  let count = 0;
  for (const [name, verts] of groups) {
    if (!name.startsWith(prefix)) continue;
    for (const v of verts) {
      max = Math.max(max, v[1]);
      count++;
    }
  }
  return count === 0 ? null : max;
};
const coveredTopFt = topYOf(objWithHeader, `${targetWallId}_${liveStart}_`);
const neighbourIndex = liveEnd < slotExtents.length - 1 ? liveEnd : Math.max(0, liveStart - 1);
const neighbourTopFt = topYOf(objWithHeader, `${targetWallId}_${neighbourIndex}_`);
record(
  "the-panels-beneath-stop-where-the-header-starts",
  {
    coveredSlot: liveStart,
    coveredTopFt: coveredTopFt === null ? null : Number(coveredTopFt.toFixed(3)),
    neighbourSlot: neighbourIndex,
    neighbourTopFt: neighbourTopFt === null ? null : Number(neighbourTopFt.toFixed(3)),
    headerBottomFt: headerExtentAll ? Number(headerExtentAll.bottomYFt.toFixed(3)) : null,
  },
  // The shortening is the whole mechanism — the same band machinery a
  // Mid-Wall Bond Beam uses. A covered panel must stop at the header's own
  // bottom face, and an uncovered neighbour must not.
  (d) =>
    d.coveredTopFt !== null &&
    d.neighbourTopFt !== null &&
    d.headerBottomFt !== null &&
    Math.abs(d.coveredTopFt - d.headerBottomFt) < 0.05 &&
    d.neighbourTopFt > d.coveredTopFt + 0.5,
);

console.log("11. the fabrication sheets, both halves of the cross-reference");
await closeOpenNotes();
let headerSheetText = null;
let panelSheetText = null;
try {
  await clickByText("button", "Panel Fabrication: Spanning Header", "Spanning Header fabrication page");
  await sleep(1600);
  headerSheetText = await evaluate(`(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.textContent.includes('Panel Fabrication — Spanning Header'));
    return el ? el.textContent.replace(/\\s+/g, ' ').slice(0, 4000) : null;
  })()`);
  await shot("05-header-fabrication-sheet");
  await closeOpenNotes();
  // The reciprocal lives on a spanned panel's own sheet. Open the panel
  // fabrication pages until one names the header above it — there are only a
  // handful on a rectangle.
  const panelPages = await evaluate(`(() => [...document.querySelectorAll('button')]
    .map((b) => b.textContent.trim())
    .filter((t) => t.startsWith('Panel Fabrication:') && !t.includes('Spanning Header'))
    .slice(0, 8))()`);
  for (const label of panelPages) {
    await clickByText("button", label, label);
    await sleep(1200);
    const text = await evaluate(`(() => {
      const el = [...document.querySelectorAll('div')].find((d) => d.textContent.includes('Header above:'));
      return el ? el.textContent.replace(/\\s+/g, ' ').slice(0, 2000) : null;
    })()`);
    await closeOpenNotes();
    if (text) {
      panelSheetText = text;
      break;
    }
  }
} catch (err) {
  headerSheetText = `error: ${String(err.message ?? err)}`;
}
record(
  "both-halves-of-the-cross-reference-are-on-paper",
  {
    headerSheetStatesItsWall: typeof headerSheetText === "string" && /\b(North|South|East|West)[a-z]* wall — spans /.test(headerSheetText),
    panelSheetNamesTheHeader: typeof panelSheetText === "string" && /Header above: H[0-9]+\./.test(panelSheetText),
    headerSheetSample: typeof headerSheetText === "string" ? headerSheetText.slice(0, 320) : headerSheetText,
    panelSheetSample: typeof panelSheetText === "string" ? panelSheetText.slice(0, 320) : panelSheetText,
  },
  // With the wall stripped out of the name, `H1` alone says nothing about
  // where the panel goes — and a shop reading one sheet cannot see the
  // other. Both directions have to be printed, or the two-dimensional
  // relationship does not survive being printed as a stack of
  // one-dimensional pages.
  SELF_TEST_INVERT
    ? (d) => d.headerSheetStatesItsWall === false && d.panelSheetNamesTheHeader === false
    : (d) => d.headerSheetStatesItsWall === true && d.panelSheetNamesTheHeader === true,
);

record(
  "no-uncaught-exception-in-the-page",
  { pageExceptions: pageExceptions.length, first: pageExceptions[0] ?? null },
  (d) => d.pageExceptions === 0,
);

writeEvidence();
console.log(`\n${evidence.steps.filter((s) => s.asserted && s.passed).length} of ${evidence.steps.filter((s) => s.asserted).length} asserted checks passed`);
if (failures.length > 0) {
  console.error(`FAILURES: ${failures.join(", ")}`);
  process.exit(1);
}
// ⚠ A CLEAN RUN HAS TO EXIT DELIBERATELY. The open CDP WebSocket keeps the
// event loop alive forever, so without these two lines a passing run printed
// "14 of 14" and then sat there until the browser was killed — at which point
// it exited 1. So the only exit code a passing run could actually reach was
// non-zero, and the earlier claim that "the shell swallowed the code on the
// clean runs" was wrong about its own script.
ws.close();
process.exit(0);
