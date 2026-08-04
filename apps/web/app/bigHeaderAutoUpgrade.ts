import { computeTrussWebAngleDeg, headerWebRiseIn, HEADER_MAX_ANGLE_DEG, TRUSS_WEB_MIN_ANGLE_DEG } from "@building-integrity/panel-catalog";

/**
 * Tommy: "big headers are spawned... when a window header exceeds its
 * allowance for having only 1 V shape." Every header is now capped at 1
 * peak (see headerMembers.ts's own doc comment) — a width/height combo
 * whose resulting single-peak brace angle falls outside
 * [TRUSS_WEB_MIN_ANGLE_DEG, HEADER_MAX_ANGLE_DEG] no longer gets more
 * peaks added; the caller (page.tsx's own applyBigHeaderAutoUpgrade)
 * upgrades that whole slot to "big-header" instead.
 */
export function shouldAutoUpgradeToBigHeader(widthIn: number, headerHeightIn: number): boolean {
  const angleDeg = computeTrussWebAngleDeg(widthIn, headerWebRiseIn(headerHeightIn), 1);
  return !Number.isFinite(angleDeg) || angleDeg < TRUSS_WEB_MIN_ANGLE_DEG || angleDeg > HEADER_MAX_ANGLE_DEG;
}
