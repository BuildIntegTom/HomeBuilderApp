"use client";

import styles from "./StrawWiggleBadge.module.css";

export interface StrawWiggleBadgeProps {
  /** True for the ~700ms following a 2D/3D toggle click — drives the CSS
   * wiggle + straw-wisp-flyaway animation. */
  isAnimating: boolean;
  onAnimationEnd: () => void;
}

/**
 * A small decorative straw bale next to the 2D/3D toggle (Tommy: "wiggle
 * the straw bale and make 2 or 3 pieces of yellow straw shake from under
 * the bale to off screen" on toggle) — purely decorative, no click
 * behavior of its own; EditorToolbar drives `isAnimating` from its 2D/3D
 * button clicks.
 */
export default function StrawWiggleBadge({ isAnimating, onAnimationEnd }: StrawWiggleBadgeProps) {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={isAnimating ? styles.baleAnimating : styles.bale} onAnimationEnd={onAnimationEnd} />
      {isAnimating && (
        <>
          <span className={`${styles.wisp} ${styles.wisp1}`} />
          <span className={`${styles.wisp} ${styles.wisp2}`} />
          <span className={`${styles.wisp} ${styles.wisp3}`} />
        </>
      )}
    </div>
  );
}
