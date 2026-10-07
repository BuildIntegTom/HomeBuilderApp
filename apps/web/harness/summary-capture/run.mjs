/**
 * Stage 0 correctness: the capture is dormant while the Project Summary note
 * is CLOSED, and the image is CURRENT the moment it is re-opened.
 *
 * The second half is the one that matters. Gating the capture on "is anyone
 * looking" reintroduces the original stale-summary bug unless re-opening the
 * note forces a frame — `frameloop="demand"` renders none on its own, because
 * opening a note changes nothing in that hidden scene.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = process.env.SUMMARY_CAPTURE_APP_URL ?? "http://localhost:3304/";
const CDP = process.env.SUMMARY_CAPTURE_CDP_PORT ?? "9476";
const PROVE_FAILURE = process.env.SUMMARY_CAPTURE_PROVE_FAILURE === "1";
const EVIDENCE_FILE = fileURLToPath(new URL("./evidence.json", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}, sessionId) =>
  new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });

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
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: type === "mouseReleased" ? 0 : 1, ...extra }, sid);
const click = async (x, y) => { await mouse("mousePressed", x, y); await sleep(60); await mouse("mouseReleased", x, y); await sleep(400); };
const clickSel = async (sel) => {
  const at = await evaluate("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return null;" +
    " const r = e.getBoundingClientRect(); return r.width > 0 ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null; })()");
  if (!at) throw new Error("not clickable: " + sel);
  await click(at.x, at.y);
};
/** The enabled button whose trimmed label is exactly `text` — the bar carries
 * a DISABLED "Summary" placeholder with similar wording. */
const clickExact = async (text) => {
  const at = await evaluate("(() => { const b = [...document.querySelectorAll('button')]" +
    ".find(b => !b.disabled && b.textContent.replace(/\\s+/g,' ').trim() === " + JSON.stringify(text) + ");" +
    " if (!b) return null; const r = b.getBoundingClientRect(); return r.width > 0 ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null; })()");
  if (!at) throw new Error("no enabled button labelled exactly: " + text);
  await click(at.x, at.y);
};

const fingerprint = async () => evaluate(
  "(async () => {" +
  " const img = [...document.querySelectorAll('img')].find(i => (i.src||'').startsWith('data:image/png'));" +
  " let sha = null; if (img) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(img.src));" +
  "   sha = [...new Uint8Array(d)].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join(''); }" +
  " const t = document.body.innerText; " +
  " return { hasImg: !!img, sha, len: img ? img.src.length : 0," +
  "   weight: (t.match(/Total weight\\s*([\\d.,]+ lb)/)||[])[1] ?? null }; })()",
);

const failures = [];
const evidence = { app: APP, ranAt: new Date().toISOString(), proveFailureMode: PROVE_FAILURE, checks: [] };
let reachedTheRealWork = false;

/** Every step carries an expectation, as in the harnesses next door — a
 * record with nothing asserted is a note, not evidence. */
const check = (name, ok, detail) => {
  if (typeof ok !== "boolean") throw new Error("check() needs a boolean expectation: " + name);
  console.log((ok ? "  [PASS] " : "  [FAIL] ") + name + "  " + JSON.stringify(detail));
  evidence.checks.push({ name, ok, detail });
  if (!ok) failures.push(name);
};

/* ⚠ THE EVIDENCE-STUB HAZARD. A run that cannot reach the browser still
 * fires its exit handler, and an unguarded writer replaces a real record
 * with a ~100-byte stub — which has happened repeatedly in this repo. So
 * nothing is written until the run has got as far as having a building to
 * summarise, and nothing is written at all in prove-failure mode, whose
 * artefact would be a failing record of a passing app. */
process.on("exit", () => {
  if (PROVE_FAILURE) { console.log("prove-failure mode: NOT writing evidence"); return; }
  if (!reachedTheRealWork) { console.log("never reached the real work: NOT writing evidence"); return; }
  evidence.failures = failures;
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2));
  console.log("evidence -> evidence.json");
});

console.log("loading", APP);
await send("Page.navigate", { url: APP }, sid);
await sleep(9000);

// --- a building -------------------------------------------------------------
let panels = 0;
for (let attempt = 1; attempt <= 4 && panels < 100; attempt++) {
  await clickExact("▭ Rectangle").catch(() => clickSel('button[aria-pressed]'));
  await sleep(300);
  if (attempt === 1) for (let i = 0; i < 5; i++) { await clickSel('button[title="Zoom out"]'); await sleep(120); }
  await sleep(500);
  const box = await evaluate("(() => { const k = window.Konva.stages[0].container().getBoundingClientRect(); return { l:k.left, t:k.top, r:k.right, b:k.bottom }; })()");
  await mouse("mousePressed", box.l + 25, box.t + 25);
  await sleep(90);
  await mouse("mouseMoved", (box.l + box.r) / 2, (box.t + box.b) / 2);
  await sleep(120);
  await mouse("mouseMoved", box.r - 25, box.b - 25);
  await sleep(140);
  await mouse("mouseReleased", box.r - 25, box.b - 25);
  await sleep(6000);
  panels = await evaluate("window.Konva.stages[0].find('Rect').length");
  console.log("  draw attempt " + attempt + ": " + panels + " panels");
}
check("a building exists to summarise", panels > 100, { panels });
if (panels > 100) reachedTheRealWork = true;

// Count every toDataURL from here on.
await evaluate(
  "(() => { if (window.__tduPatched) return; window.__tduPatched = true; window.__tdu = [];" +
  " const orig = HTMLCanvasElement.prototype.toDataURL;" +
  " HTMLCanvasElement.prototype.toDataURL = function (...a) { const t0 = performance.now();" +
  "   const r = orig.apply(this, a); window.__tdu.push(+(performance.now()-t0).toFixed(1)); return r; }; })()",
);

console.log("\n1. open the Project Summary");
await clickExact("Project Summary");
await sleep(5000);
const first = await fingerprint();
check("the note shows a rendering once opened", first.hasImg === true, first);
const capturesWhileOpening = await evaluate("window.__tdu.length");
check("opening it took at least one capture", capturesWhileOpening >= 1, { capturesWhileOpening });

console.log("\n2. close it, then edit the wall height with nobody looking");
await clickExact("Project Summary");
await sleep(1500);
await evaluate("window.__tdu.length = 0");

await clickSel('[data-bar-control="settings"]');
await sleep(1500);
const field = await evaluate(
  "(() => { const i = [...document.querySelectorAll('#settings-note input')]" +
  ".find(e => (e.closest('label')?.textContent||'').includes('Wall height'));" +
  " if (!i) return null; const r = i.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2, value:i.value }; })()",
);
if (!field) throw new Error("wall height field not found");
await mouse("mousePressed", field.x, field.y, { clickCount: 3 });
await mouse("mouseReleased", field.x, field.y, { clickCount: 3 });
await sleep(200);
await send("Input.insertText", { text: "16'-0\"" }, sid);
await sleep(200);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }, sid);
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }, sid);
await sleep(15000);

const capturesWhileClosed = await evaluate("({ n: window.__tdu.length, ms: Math.round(window.__tdu.reduce((s,d)=>s+d,0)) })");
check("THE STAGE 0 WIN: no capture at all while the note was closed", capturesWhileClosed.n === 0, capturesWhileClosed);

// Close Settings so it is not overlaying anything.
await clickSel('[data-bar-control="settings"]');
await sleep(1200);

console.log("\n3. re-open it — the image must be the building as it is NOW");
await clickExact("Project Summary");
await sleep(6000);
const second = await fingerprint();
check("re-opening took a capture", (await evaluate("window.__tdu.length")) >= 1, { calls: await evaluate("window.__tdu.length") });
check("the summary's own numbers moved, so the edit really landed", first.weight !== second.weight, { before: first.weight, after: second.weight });
check(
  "THE STALE-SUMMARY GUARD: the re-opened image is NOT the one from before the edit",
  second.hasImg && second.sha !== first.sha,
  { beforeSha: first.sha, afterSha: second.sha, beforeLen: first.len, afterLen: second.len },
);

if (PROVE_FAILURE) check("PROVE_FAILURE-this-check-is-deliberately-false", false, { deliberate: true });

console.log("\n" + (failures.length === 0 ? "ALL CHECKS PASSED" : failures.length + " FAILED: " + failures.join(", ")));
process.exit(failures.length === 0 ? 0 : 1);
