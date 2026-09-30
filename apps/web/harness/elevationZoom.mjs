/**
 * Shared harness helper: get a whole wall elevation on screen at once.
 *
 * ⚠ **Why this exists.** Until 2026-09-29 a wall elevation rendered a few
 * hundred pixels wide whatever the window, so every panel on every wall was
 * always on screen and every harness could locate one by reading the DOM and
 * filtering to the viewport. Tommy's fix made the elevation fit the editor's
 * HEIGHT and scroll its length, which is what he asked for — and which means
 * a 48ft wall is now wider than the window and most of its panels are off
 * screen at the default view.
 *
 * That breaks locators by returning FEWER elements rather than by raising
 * anything, which is the failure mode these harnesses have been burned by
 * repeatedly. So rather than each harness quietly getting a smaller sample,
 * a step that needs to see the whole wall says so, out loud, by calling this.
 *
 * It drives the app's own Zoom out button rather than reaching into React
 * state or setting a scroll position: if zooming out stops working, a
 * harness that depends on it should fail.
 *
 * Lives in its own file, next to `viewStopControl.mjs`, for the reason that
 * one does — three harnesses need it and a fourth copy would drift.
 */
export function makeElevationZoomControl({ evaluate, sleep, click }) {
  /** The on-screen copy of a view button, by the start of its title. */
  const buttonXY = async (titlePrefix) =>
    await evaluate(`(() => {
      const bs = [...document.querySelectorAll('button')].filter((x) => (x.title || '').startsWith(${JSON.stringify(titlePrefix)}));
      for (const b of bs) {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth) {
          return [r.left + r.width / 2, r.top + r.height / 2];
        }
      }
      return null;
    })()`);

  /**
   * Is the whole drawing inside its scrolling viewport right now?
   *
   * `true` / `false` are answers; **`null` means the question could not be
   * asked** — no elevation SVG, or no scrolling ancestor above it — and every
   * caller asserts `=== true`, so a `null` goes RED.
   *
   * ⚠ **The walk that fails to find the scrolling ancestor used to `return
   * true`, and that was this helper's own failure mode inverted.** If anyone
   * restructures the viewport div out from under this walk, "the whole wall is
   * visible" would have come back `true` for a wall that was mostly off
   * screen, `whole-wall-on-screen` would have passed, and every harness that
   * depends on it would have gone back to sampling a WINDOW onto the wall
   * while reporting that it had all of it — fewer elements, not an exception,
   * which is the one failure mode this file exists to prevent.
   * `viewportState` in `smearforn-stage-0-1` already gets this right by
   * returning `null` when it cannot find the scroller; so does this now.
   */
  const wholeWallVisible = async () =>
    await evaluate(`(() => {
      const svg = document.querySelector('svg[aria-label^="Elevation view of wall"]');
      if (!svg) return null;
      let el = svg.parentElement;
      while (el && !(el.scrollWidth > el.clientWidth + 1) && getComputedStyle(el).overflowX !== 'auto') el = el.parentElement;
      if (!el) return null;
      return el.scrollWidth <= el.clientWidth + 1;
    })()`);

  return {
    wholeWallVisible,
    /**
     * Zooms out until the whole wall fits, or until the zoom bottoms out.
     * Returns what it ended up with, so a caller can record it instead of
     * assuming it worked.
     */
    async fitWholeWall(maxClicks = 10) {
      let clicks = 0;
      for (; clicks < maxClicks; clicks++) {
        if ((await wholeWallVisible()) === true) break;
        const xy = await buttonXY("Zoom out");
        if (!xy) throw new Error("no on-screen Zoom out button on the elevation");
        await click(xy[0], xy[1]);
        await sleep(200);
      }
      await sleep(300);
      return { clicks, wholeWallVisible: await wholeWallVisible() };
    },
  };
}
