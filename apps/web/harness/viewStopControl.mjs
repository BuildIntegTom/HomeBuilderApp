/**
 * ONE way for a harness to drive the view stops, whichever control is on
 * screen.
 *
 * ## Why this exists
 *
 * Until U1 there was exactly one view control — `ViewerDial` in the editor
 * sidebar — and four harnesses each grew their own copy of the same two
 * locators: `[aria-label="View mode"]` for the dial, and a search for the
 * button whose text is `▼`. U1 makes the dial the **below-1454px** form and
 * puts `Design` and `View` menus on the top bar at 1454px and up. (They
 * shipped at 1200px and the breakpoint moved the same day, because at 1200 the
 * two menus consumed the whole acting-as company name. **THIS FILE DID NOT
 * NEED CHANGING FOR THAT MOVE** — it asks the page which form is live rather
 * than deciding from the width, which is exactly why it exists.) Stage 2
 * launches Chrome at 1600 and the U0 harness drives the editor at 1280 and
 * 1400 — all now BELOW the boundary, so a width-keyed locator would have
 * returned `null` — **and returned it silently**, which in this
 * repo's own words is how "a reader keyed to an incidental element fails on
 * legitimate data, by returning nothing rather than by raising anything".
 *
 * Fixing them is in scope for the stage that breaks them. Fixing them **four
 * times** would have re-created the problem one stage later, so the locators
 * live here once and every harness reads them from here.
 *
 * ## What it guarantees
 *
 * - It asks the PAGE which form is live rather than assuming from the
 *   viewport width: `dial` below the breakpoint, `menus` at or above it. A
 *   harness that changes its window size mid-run is therefore fine.
 * - It NEVER reports "not found" as "nothing to do". Every function here
 *   either returns a real answer or throws with the labels it actually saw —
 *   the Stage 3 harness's own rule, because a bare "could not reach X" sends
 *   the next person looking at the wrong thing.
 * - `reach()` is the one both presentations share, so a harness written
 *   against it does not care which control exists.
 *
 * ## Usage
 *
 *   import { makeViewStopControl } from "../viewStopControl.mjs";
 *   const view = makeViewStopControl({ evaluate, sleep });
 *   await view.reach((l) => l === "3D Framed", "3D Framed");
 *
 * `evaluate(expression) -> value` and `sleep(ms)` are each harness's own
 * plumbing, passed in rather than re-implemented. Clicks are dispatched in
 * the page on the element itself — see `clickEl` for the scar that is.
 */

/** Both presentations render the stop's label as its own text, so a label is
 * the portable way to name a stop across them. The KEYS (`3d-wraps` and so
 * on) are internal and deliberately unchanged; nothing here depends on them. */
const DIAL_SELECTOR = '[role="group"][aria-label="View mode"]';

export function makeViewStopControl({ evaluate, sleep }) {
  /** Which control is actually on screen. `null` means neither, which is a
   * real state (no editor loaded yet) and is always reported rather than
   * papered over. */
  const form = async () =>
    await evaluate(`(() => {
      const dial = document.querySelector('${DIAL_SELECTOR}');
      if (dial) { const r = dial.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return 'dial'; }
      const design = document.querySelector('[data-view-menu="design"]');
      if (design) { const r = design.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return 'menus'; }
      return null;
    })()`);

  /** Whether the control is live at all — the dial's own `disabled`, which
   * both bar menus mirror through the one `isViewerDialLive` predicate. */
  const isLive = async () =>
    await evaluate(`(() => {
      const dial = document.querySelector('${DIAL_SELECTOR}');
      if (dial) {
        const next = [...dial.querySelectorAll('button')].find((b) => b.textContent.trim() === '▼');
        return Boolean(next) && next.disabled !== true;
      }
      const design = document.querySelector('[data-view-menu="design"]');
      return Boolean(design) && design.disabled !== true;
    })()`);

  /**
   * The label of the stop currently on screen.
   *
   * On the dial that is the dial's own middle text. On the bar it is the
   * OWNING menu's value — `data-view-menu-owner="true"` — which is `null`
   * when neither owns, i.e. when the control is not live. Read out of the
   * control rather than inferred from the canvas: four views of one wall once
   * counted as four walls in this repo.
   */
  const currentLabel = async () =>
    await evaluate(`(() => {
      const dial = document.querySelector('${DIAL_SELECTOR}');
      if (dial && dial.getBoundingClientRect().width > 0) {
        return [...dial.querySelectorAll('div')].map((d) => d.textContent.trim()).find((t) => t && t !== '▲' && t !== '▼') ?? null;
      }
      const owner = document.querySelector('[data-view-menu-owner="true"] [data-view-menu-value]');
      return owner ? owner.textContent.trim() : null;
    })()`);

  /**
   * Dispatch a click ON THE ELEMENT, in the page — never at a remembered
   * coordinate. Returns false when there is nothing there to click; every
   * caller turns that into a thrown error with context rather than into a
   * quiet no-op.
   *
   * ⚠ The Stage 0/1 harness already paid for the other way. It measured the
   * dial's chevron ONCE, before any Selected Panel note existed; once one was
   * open it covered the dial, so every synthetic click at those coordinates
   * hit the note and the dial never moved — and the run still looked
   * plausible. The U0 harness lost six clicks in a row to the same shape when
   * opening an icon's note scrolled the sidebar.
   *
   * What this trades away: an element dispatch does not prove the control is
   * hit-testable where a user would actually click. That property IS worth
   * proving — and it is proved, with real mouse events either side of the
   * breakpoint and at 710, by `ui-reorg-u1`, whose subject is this control. It is not the
   * job of four harnesses that merely need to get to a view.
   */
  const clickEl = async (selector) =>
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      el.click();
      return true;
    })()`);

  const menuIsOpen = async (menu) =>
    await evaluate(`document.querySelector('[data-view-menu="${menu}"]')?.getAttribute('aria-expanded') === 'true'`);

  /** Opens one bar menu, leaving the other closed. Throws rather than
   * returning false: a menu that will not open is a finding. */
  const openMenu = async (menu) => {
    if (await menuIsOpen(menu)) return;
    if (!(await clickEl(`[data-view-menu="${menu}"]`))) throw new Error(`the ${menu} menu button is not on screen`);
    await sleep(320);
    if (!(await menuIsOpen(menu))) throw new Error(`the ${menu} menu did not open — is it disabled?`);
  };

  const closeMenus = async () => {
    for (const menu of ["design", "view"]) {
      if (await menuIsOpen(menu)) {
        await clickEl(`[data-view-menu="${menu}"]`);
        await sleep(240);
      }
    }
  };

  /** Every stop the whole control offers, in the dial's order: plan, then one
   * elevation per wall in footprint order, then the three 3D modes. On the bar
   * that is Design's items followed by View's, which is the same list by
   * construction (`viewerStopsForMenu` is a pure filter of one array). */
  const cycle = async () => {
    const which = await form();
    if (which === null) throw new Error("no view control on screen at all — is the editor loaded?");
    if (which === "menus") {
      const out = [];
      for (const menu of ["design", "view"]) {
        await openMenu(menu);
        // Only one top-bar note is ever open at a time — opening one closes
        // the last — so an unqualified `[data-view-stop]` is this menu's own
        // items and nobody else's. Asserted non-empty, because a selector
        // that matched nothing while reporting success is the exact shape
        // this whole module exists to stop.
        const stops = await evaluate(
          `[...document.querySelectorAll('[data-view-stop]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`,
        );
        if (!stops || stops.length === 0) throw new Error(`the ${menu} menu offered no stops`);
        out.push(...stops);
        await closeMenus();
      }
      return out;
    }
    // The dial cannot be enumerated without walking it, so walk it — and
    // return to where it started, so reading the cycle is not itself a change.
    const start = await currentLabel();
    const seen = [start];
    for (let i = 0; i < 20; i++) {
      const before = await currentLabel();
      await stepDial();
      const now = await currentLabel();
      if (now === before) throw new Error(`the dial did not move off "${before}" — the step missed`);
      if (now === start) return seen;
      seen.push(now);
    }
    throw new Error(`the dial never came back round to "${start}"; saw ${JSON.stringify(seen)}`);
  };

  const stepDial = async () => {
    if (!(await clickEl(`${DIAL_SELECTOR} button[title="Next view"]`))) throw new Error("the view dial is not on screen");
    await sleep(500);
  };

  /** Select a stop by its label, whichever control is showing. Returns false
   * only when the control genuinely does not offer that stop. */
  const select = async (label) => {
    const which = await form();
    if (which === null) throw new Error("no view control on screen at all");
    if (which === "dial") {
      const start = await currentLabel();
      if (start === label) return true;
      for (let i = 0; i < 20; i++) {
        const before = await currentLabel();
        await stepDial();
        const now = await currentLabel();
        if (now === before) throw new Error(`the dial did not move off "${before}" — the step missed`);
        if (now === label) return true;
        if (now === start) return false;
      }
      return false;
    }
    for (const menu of ["design", "view"]) {
      await openMenu(menu);
      const clicked = await evaluate(`(() => {
        const el = [...document.querySelectorAll('[data-view-stop]')].find((e) => e.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)});
        if (!el) return false;
        el.scrollIntoView({ block: 'nearest' });
        if (el.getBoundingClientRect().width <= 0) return false;
        el.click();
        return true;
      })()`);
      if (clicked) {
        await sleep(600);
        return true;
      }
      await closeMenus();
    }
    return false;
  };

  /** One stop forward, in the control's own order — the dial's ▼, or the next
   * item in the combined menu order. */
  const step = async () => {
    const which = await form();
    if (which === "dial") {
      await stepDial();
      return await currentLabel();
    }
    const order = await cycle();
    const now = await currentLabel();
    const index = order.indexOf(now);
    const next = order[(index + 1 + order.length) % order.length];
    if (!(await select(next))) throw new Error(`could not select "${next}" from the bar menus`);
    return await currentLabel();
  };

  /**
   * Reach whatever stop `predicate` accepts, and say what was walked past if
   * it is not there. The shape every harness already used, now working
   * against either control.
   */
  const reach = async (predicate, what) => {
    const which = await form();
    if (which === null) throw new Error(`cannot reach ${what}: no view control on screen at all`);
    if (!(await isLive())) {
      throw new Error(
        `cannot reach ${what}: the view control is disabled — that means the Wall tab is not active, or no footprint has been drawn yet`,
      );
    }
    const seen = [];
    for (let i = 0; i < 20; i++) {
      const label = await currentLabel();
      seen.push(label);
      if (label && predicate(label)) return label;
      const moved = await step();
      if (moved === label) throw new Error(`the view control did not move off "${label}" — the step missed`);
      if (seen.length > 1 && moved === seen[0]) break;
    }
    throw new Error(`could not reach ${what} on the ${which === "dial" ? "view dial" : "Design/View menus"}; saw: ${JSON.stringify(seen)}`);
  };

  return { form, isLive, currentLabel, cycle, select, step, reach, openMenu, closeMenus };
}
