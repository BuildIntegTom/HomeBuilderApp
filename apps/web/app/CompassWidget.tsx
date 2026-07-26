"use client";

import { forwardRef, useEffect, useRef } from "react";
import styles from "./CompassWidget.module.css";

// Tommy: "the compass gets in the way — can we make it invisible
// temporarily (with a 100 to 0 percent gradient change based on distance)
// as you hover the mouse over it so you are able to see and click the
// layer below it." Distance is measured to the housing's own nearest edge
// (not center) so the fade starts a little before the cursor actually
// reaches it, not just once directly overlapping.
const FADE_START_DISTANCE_PX = 60;
// Once opacity drops below this, pointer-events are dropped too, so the
// housing stops being the hit-test target and clicks/hover reach whatever
// is really underneath — re-enabled once the cursor moves back out.
const CLICK_THROUGH_OPACITY_THRESHOLD = 0.15;

/**
 * A compass face (Tommy: "spiffy the screen adjustment tools into a
 * compass widget. The compass should always be corresponding to the
 * camera angle, even rotating in 3D"). Purely a visual dial — the
 * forwarded ref points at the rotating inner face, which `Building3DView`
 * updates directly (imperative `style.transform`, not React state, so it
 * can track the orbit camera every frame without triggering a re-render)
 * whenever the 3D camera orbits. In 2D, page.tsx resets it to 0deg (up =
 * North, matching the app's existing 2D convention — there's no camera
 * rotation concept in the 2D plan view).
 *
 * The housing itself fades by cursor proximity (see FADE_START_DISTANCE_PX
 * above) via a plain `window` mousemove listener + imperative style writes,
 * the same no-re-render pattern the rotation ref already uses — a
 * continuous distance computation naturally covers "mouse far away" (fully
 * opaque) without any separate enter/leave handling.
 */
const CompassWidget = forwardRef<HTMLDivElement>(function CompassWidget(_props, ref) {
  const housingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const el = housingRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const distancePx = Math.hypot(dx, dy);
      const opacity = Math.min(Math.max(distancePx / FADE_START_DISTANCE_PX, 0), 1);
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = opacity < CLICK_THROUGH_OPACITY_THRESHOLD ? "none" : "auto";
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={housingRef}
      className={styles.housing}
      title="Compass — the letter under the fixed top marker is the direction currently facing you"
    >
      <div ref={ref} className={styles.face}>
        <span className={`${styles.tick} ${styles.tickN}`}>N</span>
        <span className={`${styles.tick} ${styles.tickE}`}>E</span>
        <span className={`${styles.tick} ${styles.tickS}`}>S</span>
        <span className={`${styles.tick} ${styles.tickW}`}>W</span>
      </div>
      <div className={styles.fixedMarker} />
    </div>
  );
});

export default CompassWidget;
