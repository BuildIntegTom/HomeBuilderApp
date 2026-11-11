/**
 * Browser harness — **the printed sheet is not blank.**
 *
 * Launches a real headless Chrome, draws a real building, marks the Project
 * Summary for printing exactly the way `handlePrintNote` does, switches the
 * page into **print media**, and then asks for a real PDF over CDP.
 *
 * Every expectation carries a reason; `check()` throws without a boolean, and
 * the process exits non-zero if any expectation is false.
 *
 *   node apps/web/harness/print-export/run.mjs
 *
 * Env: PRINT_EXPORT_APP_URL (default http://localhost:3000/),
 *      PRINT_EXPORT_CDP_PORT (default 9334),
 *      PRINT_EXPORT_CHROME (default the Windows Chrome path).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = process.env.PRINT_EXPORT_APP_URL ?? "http://localhost:3000/";
const PORT = process.env.PRINT_EXPORT_CDP_PORT ?? "9334";
const CHROME = process.env.PRINT_EXPORT_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_FILE = path.join(HERE, "evidence.json");
const SHOTS = path.join(HERE, "screenshots");

/**
 * ⚠ **The floor a real printed sheet cannot be under.** Chrome emits a
 * valid, well-formed, completely EMPTY landscape PDF at about 1.2 KB — that
 * is what every export produced before 2026-11-10, and it is why "the export
 * succeeded" was never evidence of anything. A sheet with a title block, ten
 * table rows and a rendering on it came out at 183 KB in the same run.
 */
const EMPTY_PDF_CEILING_BYTES = 20000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failures = 0;
function check(label, ok, detail) {
  if (typeof ok !== "boolean") throw new Error(`check("${label}") needs a boolean, got ${typeof ok}`);
  results.push({ label, ok, detail: detail ?? null });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : "  — " + JSON.stringify(detail)}`);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "print-export-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1600,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function version() {
  for (let i = 0; i < 60; i++) {
    try {
      return await (await fetch("http://127.0.0.1:" + PORT + "/json/version")).json();
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Chrome never opened a debugger on " + PORT);
}

let msgId = 0;
const pending = new Map();
const ver = await version();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
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

const { targetId } = (await send("Target.createTarget", { url: APP })).result;
const { sessionId: sid } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;
await send("Page.enable", {}, sid);
await send("Runtime.enable", {}, sid);
await sleep(9000);

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text + " :: " + expression.slice(0, 200));
  return res.result.result?.value;
};

/* A real building, from the app's own starter templates — a gable running the
   long way, so the sheet has a rendering, a gable row and real totals on it. */
const drew = await evaluate(
  "(async () => { const b = [...document.querySelectorAll('button')].find(x => /The Tank/.test(x.textContent));" +
    " if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 9000)); return true; })()",
);
check("the starter template draws a building", drew === true, { template: "The Tank" });

const sections = await evaluate(
  "(async () => { const p = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Price');" +
    " p.click(); await new Promise(r => setTimeout(r, 6000));" +
    " return [...document.querySelectorAll('.documentSection')].map(s => s.id); })()",
);
check("the Price page mounts the Project Summary", sections.includes("detail-summary"), { sections });

/* Exactly what `handlePrintNote` does for the Summary — body attribute, then
   the one section marked as the print target. */
const marked = await evaluate(
  "(() => { document.body.setAttribute('data-print-mode','page');" +
    " const el = document.getElementById('detail-summary'); if (!el) return null;" +
    " el.setAttribute('data-print-target','true'); return true; })()",
);
check("the Summary can be marked as a print target", marked === true);

await send("Emulation.setEmulatedMedia", { media: "print" }, sid);
await sleep(1500);

/**
 * ⚠ **THE ASSERTION THE OLD CODE FAILED.** `.editorSection` carries
 * `print-hidden-chrome`, and U4.2 moved the printable sections INSIDE it.
 * `display: block !important` on the target cannot rescue a descendant of a
 * `display: none` ancestor, so the section measured 0 x 0 in print media
 * while still reporting `display: block` and `visibility: visible` on
 * itself. Measuring the BOX is the only way to see it.
 */
const box = await evaluate(
  "(() => { const el = document.getElementById('detail-summary'); const cs = getComputedStyle(el);" +
    " const r = el.getBoundingClientRect();" +
    " return { display: cs.display, visibility: cs.visibility, w: r.width, h: r.height," +
    " text: (el.innerText || '').trim().slice(0, 80) }; })()",
);
check("the printed section has a real WIDTH in print media", box.w > 200, box);
check("the printed section has a real HEIGHT in print media", box.h > 200, box);
check("and the price is the first thing on it", /PROJECT TOTALS\s*Price/.test(box.text), { text: box.text });

/**
 * Chrome is hidden, so nothing that is neither the document nor an ancestor
 * of it may still be painting. This catches chrome LEAKING the other way once
 * the wrapper is un-hidden — the `.editorPageIcons` cluster did exactly that.
 */
const leaked = await evaluate(
  "(() => { const target = document.querySelector('.documentSection[data-print-target]'); const out = [];" +
    " for (const el of document.querySelectorAll('body *')) {" +
    "   if (getComputedStyle(el).display === 'none') continue;" +
    "   if (target.contains(el) || el.contains(target)) continue;" +
    "   const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;" +
    "   out.push({ cls: String(el.className || '').slice(0, 60), txt: (el.innerText || '').trim().slice(0, 30) });" +
    " } return out.slice(0, 10); })()",
);
check("no editor chrome prints beside the document", leaked.length === 0, { leaked });

const shot = (await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sid)).result;
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(path.join(SHOTS, "print-media.png"), Buffer.from(shot.data, "base64"));

const pdf = (await send("Page.printToPDF", { landscape: true, printBackground: true, preferCSSPageSize: true }, sid)).result;
const bytes = Buffer.from(pdf.data, "base64").length;
check("the PDF is not an empty page", bytes > EMPTY_PDF_CEILING_BYTES, { bytes, emptyCeiling: EMPTY_PDF_CEILING_BYTES });

fs.writeFileSync(
  EVIDENCE_FILE,
  JSON.stringify({ ranAt: new Date().toISOString(), app: APP, pdfBytes: bytes, sectionBox: box, results }, null, 2) + "\n",
);
console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILED") + " — evidence written to " + EVIDENCE_FILE);

ws.close();
chrome.kill();
process.exit(failures === 0 ? 0 : 1);
