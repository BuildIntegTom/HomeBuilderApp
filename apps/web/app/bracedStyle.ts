import type { BracePattern } from "@building-integrity/panel-catalog";

/**
 * Resolves the actual pattern/mirror a specific "braced" slot (or
 * instance — `PanelInstance` carries the same 2 fields under the same
 * names, see panelInstances.ts) should build with — its own
 * `bracedPattern`/`bracedMirrored` once decided (the normal case, set by
 * `reconcileBracedPlacement`/the click-cycle/the Selected Panel note's
 * quick-pick dropdown), falling back to the project's own global default
 * only for legacy data missing these fields (shouldn't happen
 * post-migration, but defensive) — see `PanelSlot.bracedPattern`'s own
 * doc comment for the "absent = default" convention this follows. Single
 * source of truth so page.tsx, Building3DView.tsx, and FootprintCanvas.tsx
 * never resolve a braced panel's geometry differently from each other.
 * Takes just the 2 relevant fields (not a full `PanelSlot`) so it works
 * for both a slot and a `PanelInstance` without an awkward cast.
 */
export function resolveBracedStyle(
  source: { bracedPattern?: BracePattern; bracedMirrored?: boolean },
  defaultPattern: BracePattern,
  defaultMirrored: boolean,
): { pattern: BracePattern; mirrored: boolean } {
  return {
    pattern: source.bracedPattern ?? defaultPattern,
    mirrored: source.bracedMirrored ?? defaultMirrored,
  };
}
