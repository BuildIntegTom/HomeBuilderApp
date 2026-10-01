import { formatPlySpecLabel, GIRT_WEB_PLY_SPEC, SKIN_PLY_SPEC } from "@building-integrity/panel-catalog";

/**
 * The two plywood row labels shared by the **Material Totals** detail page and
 * the **Project Summary** page, so the two cannot disagree about what is in
 * either row — they already did, having both said "1/2in plywood (girt webs)".
 *
 * Two things they get from living here rather than being typed twice:
 *
 * 1. **The spec comes from the catalog**, via `formatPlySpecLabel` over the
 *    very `plySpec` strings the members carry (`SKIN_PLY_SPEC`,
 *    `GIRT_WEB_PLY_SPEC`). So the row says "3/4in 5-ply CDX" / "1/2in 3-ply
 *    CDX" because that is what the parts are, not because somebody wrote it
 *    down. Tommy asked for the grade by name: *"1/2" CDX plywood should be a
 *    material that we calculate with all the totals and summary pages next to
 *    3/4" stats."* ⚠ Note the two differ in PLY COUNT as well as thickness —
 *    5-ply against 3-ply — which matters to whoever orders sheets.
 * 2. **The 1/2in row no longer claims to be only girt webs.** As of 2026-10-01
 *    a wall run of 144in or less reserves a **1/2in** safety gap instead of a
 *    3/4in one, and `computePlywoodAreaSqFt(allRealMembers, 0.5)` picks those
 *    sheets up by thickness — correctly and for free. The label was the only
 *    part that was wrong, and a row that names the wrong part is a row someone
 *    orders against.
 */
export const PLYWOOD_THREE_QUARTER_ROW_LABEL = `${formatPlySpecLabel(
  SKIN_PLY_SPEC,
)} plywood (skins, side plies, header caps, roof-bearing caps, long-run safety gaps)`;

export const PLYWOOD_HALF_ROW_LABEL = `${formatPlySpecLabel(
  GIRT_WEB_PLY_SPEC,
)} plywood (girt webs, short-run safety gaps)`;
