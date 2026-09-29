/**
 * ONE way for a harness to drive the view stops and the design subjects.
 *
 * ## Why this exists, and what it drives now
 *
 * Until U1 there was exactly one view control — `ViewerDial` in the editor
 * sidebar — and four harnesses each grew their own copy of the same two
 * locators: `[aria-label="View mode"]` for the dial, and a search for the
 * button whose text is `▼`. U1 put `Design` and `View` menus on the top bar
 * beside it and moved the shared locators here.
 *
 * ⚠ **THE DIAL WAS REMOVED ENTIRELY ON 2026-09-28** (Tommy: *"I would like to
 * not have the dial after these updates"*), **and the four `Wall / Foundation /
 * Floor / Roof` tab buttons left the bar in the same pass**, folded into the
 * Design menu as subject groups. So this module drives the bar menus and only
 * the bar menus — and it now drives BOTH axes, because they are one menu:
 *
 * - **A stop** — `2D Floor Plan`, `Elevation: CD`, `3D Framed`, `3D Boxes`,
 *   `Membranes` — reached with `reach()` / `select()` exactly as before.
 * - **A subject** — `Floor`, `Roof`, `Foundation` — reached with
 *   `selectSubject()`. `nav[aria-label="Editor"]` no longer exists and a
 *   harness that clicked a tab there has to come through here instead.
 *
 * Fixing them is in scope for the stage that breaks them. Fixing them **five
 * times** would have re-created the problem one stage later, so the locators
 * live here once and every harness reads them from here.
 *
 * ## What it guarantees
 *
 * - It asks the PAGE what is on screen rather than assuming from the viewport
 *   width. The menus carry every destination at every width now, but the habit
 *   is kept: a harness that changes its window size mid-run is fine.
 * - It NEVER reports "not found" as "nothing to do". Every function here
 *   either returns a real answer or throws with the labels it actually saw —
 *   the Stage 3 harness's own rule, because a bare "could not reach X" sends
 *   the next person looking at the wrong thing.
 * - `reach()` is the shape every harness already used and is unchanged.
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

/** Both the bar button and the menu entry render a stop's label as its own
 * text, so a label is the portable way to name a stop. The KEYS (`3d-wraps`
 * and so on) are internal and deliberately unchanged; nothing here depends on
 * them. */
const MENUS = ["design", "view"];

export function makeViewStopControl({ evaluate, sleep }) {
  /** Which control is on screen. Only ever `menus` or `null` since the dial was
   * removed; `null` means no view control at all, which is a real state (no
   * editor loaded yet) and is always reported rather than papered over. The
   * function is kept — rather than being inlined away — because every harness
   * asserts on it and because "which control is this" is exactly the question
   * that was answered by assumption before. */
  const form = async () =>
    await evaluate(`(() => {
      const design = document.querySelector('[data-view-menu="design"]');
      if (design) { const r = design.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return 'menus'; }
      return null;
    })()`);

  /**
   * Whether the stops can actually be driven.
   *
   * ⚠ The two menus are no longer disabled together, and that is deliberate in
   * the app: **Design now holds the Floor / Roof / Foundation editors, so it is
   * the only way back to the drawing** and is never disabled, while **View is
   * disabled until a footprint exists**, exactly as the dial was. So "is it
   * live" for a harness that wants a VIEW STOP is the View menu's state, which
   * is what this reports.
   */
  const isLive = async () =>
    await evaluate(`(() => {
      const view = document.querySelector('[data-view-menu="view"]');
      return Boolean(view) && view.disabled !== true;
    })()`);

  /**
   * The label of the stop currently on screen.
   *
   * ⚠ **THE BAR NO LONGER SHOWS IT ANYWHERE — that is the point of Tommy's
   * bare words** — so this reads the owning menu's `data-view-menu-current-stop`
   * attribute, which the app renders from the same `viewerStopLabel(
   * currentViewerStop)` call the open menu marks with `aria-current`. Nothing
   * is displayed by it and it adds no width. The `ui-reorg-u1` harness asserts
   * the attribute and the marked menu entry agree, so this cannot quietly drift
   * away from what a user can see.
   *
   * `null` when no view stop is on screen — i.e. while a Floor, Roof or
   * Foundation editor is the surface. That is a true answer, not a failure, and
   * callers that need a stop say so by asking `reach()`.
   */
  const currentLabel = async () =>
    await evaluate(`(() => {
      const owner = document.querySelector('[data-view-menu-current-stop]');
      return owner ? owner.getAttribute('data-view-menu-current-stop') : null;
    })()`);

  /** Which subject is being edited, by the entry the open menu would mark. Read
   * off the Design menu's current entry rather than off a tab button, because
   * there are no tab buttons any more. */
  const currentSubject = async () => {
    await openMenu("design");
    const subject = await evaluate(
      `(() => { const el = document.querySelector('[data-design-subject][data-view-stop-current="true"]'); return el ? el.getAttribute('data-design-subject') : null; })()`,
    );
    // No marked subject entry means the wall subject, whose entries are the
    // stops. Reported as "wall" rather than as null so callers do not have to
    // know that.
    const anyStopMarked = await evaluate(
      `Boolean(document.querySelector('[data-view-stop][data-view-stop-current="true"]'))`,
    );
    await closeMenus();
    return subject ?? (anyStopMarked ? "wall" : null);
  };

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
   * proving — and it is proved, with real mouse events at several widths, by
   * `ui-reorg-u1`, whose subject is this control. It is not the job of four
   * harnesses that merely need to get to a view.
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

/**
   * Opens one bar menu, leaving the other closed. Throws rather than returning
   * false: a menu that will not open is a finding.
   *
   * ⚠ WHY THERE IS A RETRY BUDGET HERE, AND WHY IT IS SMALL AND REPORTED.
   * The first click after a cold load can land before React has attached its
   * handlers: the element is there, laid out and enabled, `el.click()` fires,
   * and nothing happens. Seen on 2026-09-28 in the Stage 0/1 harness, whose
   * very first action is to read this menu (it asks what is in the scope of
   * work), and in the U0 harness's first run after a server start — both passed
   * on the next run, which is the signature of a race rather than a defect.
   *
   * **A flaky check is worse than no check**, because it teaches whoever reads
   * it to discount a real failure — so this does not retry forever and it does
   * not retry silently: three attempts, and the error names how many were spent
   * and what the button's own state was. The same discipline the Stage 0/1
   * harness applies to its wall reads, where the budget is a number in the
   * evidence rather than a silence to trust.
   */
  const openMenu = async (menu) => {
    if (await menuIsOpen(menu)) return;
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (!(await clickEl(`[data-view-menu="${menu}"]`))) throw new Error(`the ${menu} menu button is not on screen`);
      await sleep(attempt === 1 ? 320 : 600);
      if (await menuIsOpen(menu)) return;
      const disabled = await evaluate(`document.querySelector('[data-view-menu="${menu}"]')?.disabled === true`);
      if (disabled) {
        const title = await evaluate(`document.querySelector('[data-view-menu="${menu}"]')?.title || '(no title)'`);
        throw new Error(`the ${menu} menu did not open — it is disabled: ${title}`);
      }
    }
    throw new Error(
      `the ${menu} menu did not open after ${attempts} clicks — the button is present, laid out and enabled, so the clicks are reaching nothing. Is something overlaying the bar, or did the page not finish hydrating?`,
    );
  };

  const closeMenus = async () => {
    for (const menu of MENUS) {
      if (await menuIsOpen(menu)) {
        await clickEl(`[data-view-menu="${menu}"]`);
        await sleep(240);
      }
    }
  };

  /** Every stop the control offers, in Tommy's order: plan, then one elevation
   * per wall in footprint order, then the three 3D modes. That is Design's
   * stop entries followed by View's, which is the whole cycle by construction
   * (`viewerMenuGroups` is a pure filter of one array). Subject entries are
   * deliberately NOT included — they are not stops, and a caller walking "the
   * cycle" must not land on the Roof editor. */
  const cycle = async () => {
    const which = await form();
    if (which === null) throw new Error("no view control on screen at all — is the editor loaded?");
    const out = [];
    for (const menu of MENUS) {
      const enabled = await evaluate(`document.querySelector('[data-view-menu="${menu}"]')?.disabled !== true`);
      if (!enabled) continue;
      await openMenu(menu);
      // Only one top-bar note is ever open at a time — opening one closes the
      // last — so an unqualified `[data-view-stop]` is this menu's own entries
      // and nobody else's.
      const stops = await evaluate(
        `[...document.querySelectorAll('[data-view-stop]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`,
      );
      if (!stops || stops.length === 0) throw new Error(`the ${menu} menu offered no stops`);
      out.push(...stops);
      await closeMenus();
    }
    // Asserted non-empty here too: a selector that matched nothing while
    // reporting success is the exact shape this whole module exists to stop.
    if (out.length === 0) throw new Error("neither menu offered a single view stop");
    return out;
  };

  /** Select a stop by its label. Returns false only when no menu offers that
   * stop — which is a finding for the caller, never a skip. */
  const select = async (label) => {
    const which = await form();
    if (which === null) throw new Error("no view control on screen at all");
    for (const menu of MENUS) {
      const enabled = await evaluate(`document.querySelector('[data-view-menu="${menu}"]')?.disabled !== true`);
      if (!enabled) continue;
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

  /**
   * Select a design subject — `wall`, `floor`, `roof` or `foundation` — from
   * the Design menu.
   *
   * ⚠ **THIS IS THE REPLACEMENT FOR CLICKING A TAB**, which is why it lives
   * here rather than in each harness: the bar's `nav[aria-label="Editor"]` and
   * its `[data-bar-control="nav-roof"]` buttons were removed on 2026-09-28 when
   * the two axes merged. A subject that is out of the scope of work has no
   * entry at all (Smearforn Stage 0 defaults Floor and Foundation off), so
   * `false` here means "not in scope", and it is reported with what WAS on
   * offer rather than as a bare failure.
   *
   * The wall subject has no entry of its own — its entries are the stops — so
   * asking for `wall` selects the plan, which is the wall subject's first
   * destination and the one the app opens on.
   */
  const selectSubject = async (subject) => {
    if (subject === "wall") return await select("2D Floor Plan");
    await openMenu("design");
    const clicked = await evaluate(`(() => {
      const el = document.querySelector('[data-design-subject=${JSON.stringify(subject)}]');
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
    const offered = await evaluate(
      `[...document.querySelectorAll('[data-design-subject]')].map((e) => e.getAttribute('data-design-subject'))`,
    );
    await closeMenus();
    throw new Error(
      `the Design menu offers no "${subject}" subject — it offered ${JSON.stringify(offered)}. A subject that is out of the scope of work has no entry.`,
    );
  };

  /**
   * Which design subjects the Design menu is offering, in its own order.
   *
   * The answer to "what is in the scope of work", read where a user reads it.
   * ⚠ The wall subject has no entry of its own — its entries are the stops — so
   * it is reported by the presence of those, not by an entry that does not
   * exist. A harness asserting Smearforn Stage 0's "Floor and Foundation are
   * off by default" asks this rather than counting bar tabs, which is what it
   * used to do and which the bar no longer has.
   */
  const subjectsOffered = async () => {
    await openMenu("design");
    const out = await evaluate(`(() => {
      const subjects = [...document.querySelectorAll('[data-design-subject]')].map((e) => e.getAttribute('data-design-subject'));
      const stops = [...document.querySelectorAll('[data-view-stop]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim());
      return { subjects, stops };
    })()`);
    await closeMenus();
    if (!out || (out.subjects.length === 0 && out.stops.length === 0)) {
      throw new Error("the Design menu offered neither a subject nor a stop — it cannot legitimately be empty");
    }
    return out.stops.length > 0 ? ["wall", ...out.subjects] : out.subjects;
  };

  /** One stop forward, in the control's own order. */
  const step = async () => {
    const order = await cycle();
    const now = await currentLabel();
    const index = order.indexOf(now);
    const next = order[(index + 1 + order.length) % order.length];
    if (!(await select(next))) throw new Error(`could not select "${next}" from the bar menus`);
    return await currentLabel();
  };

  /**
   * Reach whatever stop `predicate` accepts, and say what was walked past if
   * it is not there. The shape every harness already used.
   */
  const reach = async (predicate, what) => {
    const which = await form();
    if (which === null) throw new Error(`cannot reach ${what}: no view control on screen at all`);
    if (!(await isLive())) {
      const why = await evaluate(
        `document.querySelector('[data-view-menu="view"]')?.title ?? '(no reason given)'`,
      );
      throw new Error(`cannot reach ${what}: the View menu is disabled — ${why}`);
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
    throw new Error(`could not reach ${what} on the Design/View menus; saw: ${JSON.stringify(seen)}`);
  };

  return {
    form,
    isLive,
    currentLabel,
    currentSubject,
    subjectsOffered,
    cycle,
    select,
    selectSubject,
    step,
    reach,
    openMenu,
    closeMenus,
  };
}
