"use client";

import { forwardRef } from "react";
import styles from "./CompassWidget.module.css";

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
 */
const CompassWidget = forwardRef<HTMLDivElement>(function CompassWidget(_props, ref) {
  return (
    <div className={styles.housing} title="Compass — the letter under the fixed top marker is the direction currently facing you">
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
