/**
 * Groups a panel type's instance widths into distinct sizes and assigns
 * each a share of the 3D-rendering space on its Shop Drawing page (Tommy:
 * panel instances of the same type can differ in size — already true for
 * window/header/sill panels via their per-instance `widthIn` — and every
 * distinct size in the current design should get its own 3D rendering,
 * not just the most common one).
 *
 * Layout rule (Tommy, verbatim): the most-recurring size always takes half
 * the space; with 2 distinct sizes total, the other takes the remaining
 * half; with 3, the other two each take a quarter; with 4 or more, every
 * size gets an equal share.
 *
 * Tie-break for "most recurring" when two sizes have equal counts isn't
 * specified by Tommy — this picks the larger width first (arbitrary but
 * deterministic); flag for confirmation if it ever matters in practice.
 */

export interface PanelSizeShare {
  widthIn: number;
  count: number;
  sharePercent: number;
}

export function computePanelSizeShares(widthsIn: number[]): PanelSizeShare[] {
  if (widthsIn.length === 0) return [];

  const counts = new Map<number, number>();
  const firstSeenOrder: number[] = [];
  for (const widthIn of widthsIn) {
    if (!counts.has(widthIn)) firstSeenOrder.push(widthIn);
    counts.set(widthIn, (counts.get(widthIn) ?? 0) + 1);
  }

  const distinct = [...counts.entries()].map(([widthIn, count]) => ({ widthIn, count }));
  distinct.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.widthIn !== a.widthIn) return b.widthIn - a.widthIn; // tie-break: larger width first (unconfirmed)
    return firstSeenOrder.indexOf(a.widthIn) - firstSeenOrder.indexOf(b.widthIn);
  });

  const n = distinct.length;
  const shares = n === 1 ? [100] : n === 2 ? [50, 50] : n === 3 ? [50, 25, 25] : Array(n).fill(100 / n);

  return distinct.map((d, i) => ({ ...d, sharePercent: shares[i] }));
}
