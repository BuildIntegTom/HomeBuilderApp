/** How duplicate ("sistered") trusses get added on top of the base
 * evenly-spaced run (Tommy: "spacing and doubles at the ends, or every
 * member is a double stud") — "single" places one truss per position,
 * "doubled-ends" sisters just the first and last position (typically the
 * gable-adjacent trusses, which often carry extra load), "doubled-all"
 * sisters every position. */
export type TrussDoublingStrategy = "single" | "doubled-ends" | "doubled-all";

export interface TrussPosition {
  id: string;
  /** Distance along the run from the first truss, 0..runIn. */
  positionIn: number;
  /** 1 = a single truss at this position, 2 = a sistered pair — mirrors
   * StudConfigSpec's own `studCount` naming (squareBalePanelMembers.ts). */
  count: 1 | 2;
}

/**
 * Truss centerline positions along a roof's ridge run, evenly spaced no
 * farther apart than `spacingIn` — same "ceil to whole bays, then evenly
 * redistribute" rule computeJoistLayout already uses (packages/geometry/src/
 * joistLayout.ts), so a run that doesn't divide evenly by the spacing still
 * gets a uniform pitch, not one short leftover bay at the end. Doubling
 * (see TrussDoublingStrategy) is a pure post-process over these base
 * positions — it never changes where a position sits, only how many trusses
 * occupy it.
 */
export function computeTrussLayout(runIn: number, spacingIn: number, doubling: TrussDoublingStrategy): TrussPosition[] {
  const segments = Math.max(1, Math.ceil(runIn / spacingIn));
  const step = runIn / segments;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const isEnd = i === 0 || i === segments;
    const count: 1 | 2 = doubling === "doubled-all" || (doubling === "doubled-ends" && isEnd) ? 2 : 1;
    return { id: `truss-${i}`, positionIn: i * step, count };
  });
}
