import { describe, expect, it } from "vitest";
import {
  GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN,
  GABLE_PEAK_BOX_HEIGHT_IN,
  GABLE_PEAK_BOX_PLY_THICKNESS_IN,
  GABLE_PEAK_BOX_WIDTH_IN,
  GABLE_PEAK_SLOT_HEIGHT_IN,
  GABLE_PEAK_SLOT_WIDTH_IN,
  gablePeakSlotIn,
  buildGablePeakPanelMembers,
  buildGablePeakPanelSchema,
} from "./gablePeakPanelMembers";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";
import { ROOF_CATCHER_BEAM_DEPTH_IN, ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN } from "./roofCatcherBeamMembers";
import { memberBoxIn } from "./panelMemberHelpers";
import { overlappingPairsIn } from "./memberOverlap.test";

/**
 * ⚠ **The Gable Peak Panel, built entirely from Tommy's own numbers.**
 *
 * > *"a furred out slot inside the straw (3/4" plywood small box that is 1/4"
 * > bigger each sideways and taller to house the beam) and then the weight is
 * > ditributed down with a 2x6 stud pack on each wythe."* — 2026-11-10
 *
 * Four answers finished the spec: it REPLACES the ridge column, the beam
 * passes ALL THE WAY THROUGH, the panel runs FULL HEIGHT past the beam, and
 * the clearance is a quarter inch on EACH side (2026-11-10 and 2026-11-12).
 */

const DEPTH = 15.5;
const HEIGHT = 120;
const members = () => buildGablePeakPanelMembers(DEPTH, HEIGHT, true);

describe("the Gable Peak Panel", () => {
  it("⚠ the slot is his quarter inch bigger than the beam on EACH side, and a quarter taller", () => {
    expect(GABLE_PEAK_SLOT_WIDTH_IN).toBe(ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN + 0.5);
    expect(GABLE_PEAK_SLOT_WIDTH_IN).toBe(5);
    expect(GABLE_PEAK_SLOT_HEIGHT_IN).toBe(ROOF_CATCHER_BEAM_DEPTH_IN + 0.25);
    expect(GABLE_PEAK_SLOT_HEIGHT_IN).toBe(11.5);
    /* 3/4in plywood all round, so the box outside is the slot plus two
       thicknesses each way. */
    expect(GABLE_PEAK_BOX_WIDTH_IN).toBe(6.5);
    expect(GABLE_PEAK_BOX_HEIGHT_IN).toBe(13);
  });

  it("⚠ the beam PASSES THROUGH — every box piece spans the full wall depth", () => {
    /* His answer, 2026-11-12: all the way through, not a blind pocket. So the
       box is open at both wall faces and only four pieces exist: a floor, a
       lid and two cheeks. A fifth piece closing an end would be the pocket he
       did not choose. */
    const box = members().filter((m) => m.memberId.startsWith("gable_peak_box_"));
    expect(box).toHaveLength(4);
    for (const piece of box) {
      expect({ id: piece.memberId, spansDepth: piece.actualDimsIn.widthIn }).toEqual({ id: piece.memberId, spansDepth: DEPTH });
      expect({ id: piece.memberId, ply: piece.actualDimsIn.thicknessIn }).toEqual({
        id: piece.memberId,
        ply: GABLE_PEAK_BOX_PLY_THICKNESS_IN,
      });
    }
    const ids = box.map((p) => p.memberId).sort();
    expect(ids).toEqual([
      "gable_peak_box_cheek_left",
      "gable_peak_box_cheek_right",
      "gable_peak_box_floor",
      "gable_peak_box_lid",
    ]);
  });

  it("⚠ the beam rests on the box floor, with the quarter inch ABOVE it", () => {
    /* A beam cannot bear and be centred in its clearance at the same time.
       The slack is at the top, which is the only place it can be. */
    const slot = gablePeakSlotIn(COLUMN_TOTAL_WIDTH_IN, HEIGHT);
    expect(slot.beamFromZIn).toBe(slot.slotFromZIn);
    expect(slot.beamToZIn - slot.beamFromZIn).toBe(ROOF_CATCHER_BEAM_DEPTH_IN);
    expect(+(slot.slotToZIn - slot.beamToZIn).toFixed(6)).toBe(0.25);
    /* And it is centred across the panel, because the ridge is. */
    expect((slot.slotFromXIn + slot.slotToXIn) / 2).toBe(COLUMN_TOTAL_WIDTH_IN / 2);
  });

  it("⚠ the box hangs from the ROOFLINE, so it meets the beam the 3D view draws", () => {
    /* ⚠ **A 16in MISS, found by opening the model and not by any test here.**
       A gable panel closing to the roof's TOP surface is built taller than
       the roofline by the roof's own plumb thickness. The box used to hang
       from the panel's top, which put it up inside the roof's thickness while
       the beam stayed under the deck where it belongs.

       Measured on The Tank, 2026-11-13, before the fix:
           panel top   186.588in
           box slot    183.34in
           beam drawn  167.00in     <- 16.338in away, exactly the lift

       Every test in this file passed throughout, because they all measured
       the panel against ITSELF. This one measures it against the building. */
    const EAVE_IN = 122.25;
    const ROOFLINE_IN = 170.25;
    const liftIn = DEPTH * Math.hypot(1, 4 / 12);
    const panelTopIn = ROOFLINE_IN + liftIn;
    const localHeightIn = panelTopIn - EAVE_IN;

    const slot = gablePeakSlotIn(COLUMN_TOTAL_WIDTH_IN, localHeightIn, liftIn);
    const boxBeamTopIn = EAVE_IN + slot.beamToZIn;
    /* Where Building3DView puts the beam: its own constant below the
       ROOFLINE, which is what `plane.highHeightFt` reports. */
    const drawnBeamTopIn = ROOFLINE_IN - GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN;
    expect(boxBeamTopIn).toBeCloseTo(drawnBeamTopIn, 6);
    expect(+boxBeamTopIn.toFixed(3)).toBe(167);

    /* And with no lift the two are still the same thing — a panel whose top
       IS the roofline needs no correction, which is what the default 0 says. */
    const flat = gablePeakSlotIn(COLUMN_TOTAL_WIDTH_IN, 48);
    expect(48 - flat.beamToZIn).toBeCloseTo(GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN, 6);
  });

  it("⚠ FOUR 2x6s — two per wythe, 5.5in along the wall", () => {
    /* > *"lets go with 5.5\" along the wall."* — Tommy, 2026-11-12, asked
       > directly which way a 5.5 x 3.0in pack stands. */
    const pack = members().filter((m) => m.memberId.startsWith("gable_peak_pack_"));
    expect(pack).toHaveLength(4);
    expect(pack.filter((m) => m.memberId.includes("exterior"))).toHaveLength(2);
    expect(pack.filter((m) => m.memberId.includes("interior"))).toHaveLength(2);
    for (const stud of pack) {
      expect({ id: stud.memberId, size: stud.nominalSize }).toEqual({ id: stud.memberId, size: "2x6" });
      const box = memberBoxIn(stud);
      expect({ id: stud.memberId, alongTheWall: +(box.xToIn - box.xFromIn).toFixed(4) }).toEqual({
        id: stud.memberId,
        alongTheWall: 5.5,
      });
      expect({ id: stud.memberId, throughTheWall: +(box.yToIn - box.yFromIn).toFixed(4) }).toEqual({
        id: stud.memberId,
        throughTheWall: 1.5,
      });
    }
    /* Each pack is tight against its own wythe's face. */
    const boxes = pack.map((m) => ({ id: m.memberId, ...memberBoxIn(m) }));
    expect(Math.min(...boxes.map((b) => b.yFromIn))).toBe(0);
    expect(Math.max(...boxes.map((b) => b.yToIn))).toBe(DEPTH);
  });

  it("⚠ the packs carry the box down to the bottom plate, with nothing floating", () => {
    const slot = gablePeakSlotIn(COLUMN_TOTAL_WIDTH_IN, HEIGHT);
    const pack = members().filter((m) => m.memberId.startsWith("gable_peak_pack_"));
    for (const stud of pack) {
      const box = memberBoxIn(stud);
      /* Its top meets the box's underside exactly — no gap to shim, no
         overlap to notch. */
      expect({ id: stud.memberId, topMeetsBox: +box.zToIn.toFixed(6) }).toEqual({
        id: stud.memberId,
        topMeetsBox: +slot.boxFromZIn.toFixed(6),
      });
      /* And its foot is on the bottom plate, not on the skin below it. */
      expect({ id: stud.memberId, foot: box.zFromIn }).toEqual({ id: stud.memberId, foot: 2.25 });
    }
    /* The pack sits under the box in plan, not beside it. */
    const packXs = pack.map((m) => memberBoxIn(m));
    expect(Math.min(...packXs.map((b) => b.xFromIn))).toBeGreaterThanOrEqual(slot.boxFromXIn);
    expect(Math.max(...packXs.map((b) => b.xToIn))).toBeLessThanOrEqual(slot.boxToXIn);
  });

  it("⚠ FULL HEIGHT — the plates and skins are untouched by the box", () => {
    /* His 2026-11-12 answer: the panel runs to the roofline like its
       neighbours and the beam is buried inside it. So nothing that makes it a
       full-height panel may be cut away for the box. */
    const all = members();
    for (const id of ["top_plate_skin", "bottom_plate_skin", "top_plate_2x4_ext", "top_plate_2x4_int"]) {
      expect({ id, present: all.some((m) => m.memberId === id) }).toEqual({ id, present: true });
    }
    const topSkin = all.find((m) => m.memberId === "top_plate_skin")!;
    expect(memberBoxIn(topSkin).zToIn).toBe(HEIGHT);
  });

  it("⚠ adds NO overlap the Column Panel did not already have — and that column has plenty", () => {
    /* ⚠ **A PRE-EXISTING DEFECT, FOUND HERE AND NOT CAUSED HERE.** Measured
       2026-11-12, overlapping pairs in a plain `buildColumnStyleMembers` at
       the project's own 15.5in depth:

         height  40  50  60  72  84  96  120
         pairs    2  14   7   4   9   9    7

       Mostly a girt BAR running through the 2x4 blocking at the same height,
       and on some heights a blocking row sitting above the top plate. It is a
       real breach of his 2026-10-23 standing rule and it belongs to the
       Column Panel, not to this panel.

       So the honest assertion is RELATIVE: cutting the column's rows around
       the box and the packs must not introduce a collision of its own. It
       does not — it removes several, because the segments it re-emits miss
       the girts as well as the obstacles it was cutting for. Asserting a flat
       zero here would have passed at 120in and quietly inherited the rest. */
    for (const heightIn of [40, 50, 60, 72, 84, 96, 120]) {
      const column = overlappingPairsIn(buildColumnStyleMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH, heightIn, true));
      const peak = overlappingPairsIn(buildGablePeakPanelMembers(DEPTH, heightIn, true));
      /* Compared by COUNT, because cutting a row renames it (`blocking_1_exterior`
         becomes `blocking_1_exterior_1`), so the same collision reads as a
         different pair. The count is what cannot be argued with. */
      expect({ heightIn, worseThanAPlainColumn: peak.length > column.length }).toEqual({
        heightIn,
        worseThanAPlainColumn: false,
      });
    }
  });

  it("⚠ and at the heights a gable peak actually gets built at, it is clean", () => {
    /* [[no_overlapping_members]], 2026-10-23. A box cut into the straw is
       only buildable if nothing else is already in that straw: the girts and
       the blocking rows that cross it are cut around it, and the centre
       nailer — which would stand exactly where the box is — is refused
       outright on this panel. */
    expect(overlappingPairsIn(members())).toEqual([]);
  });

  it("⚠ refuses a centre nailer, because it would stand in the slot", () => {
    const withNailer = buildGablePeakPanelMembers(DEPTH, HEIGHT, true);
    const without = buildGablePeakPanelMembers(DEPTH, HEIGHT, false);
    expect(withNailer.map((m) => m.memberId)).toEqual(without.map((m) => m.memberId));
    expect(withNailer.some((m) => m.memberId.includes("nailer"))).toBe(false);
  });

  it("carries both of its pending-confirmation deviations on the schema", () => {
    /* The unsupported plywood span under the beam, and the fact that housing
       the beam supersedes B9's "the column's top IS the beam's underside".
       Neither is quietly absorbed. */
    const schema = buildGablePeakPanelSchema(DEPTH, HEIGHT, false);
    expect(schema.displayName).toBe("Gable Peak Panel");
    expect(schema.notes.filter((n) => n.type === "deviation")).toHaveLength(2);
    expect(schema.notes.some((n) => /pending Building Integrity/i.test(n.text))).toBe(true);
  });

  it("is still a Column Panel underneath — same width, same depth, same height", () => {
    const schema = buildGablePeakPanelSchema(DEPTH, HEIGHT, false);
    expect(schema.derivedFrom).toBe("column_panel");
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn: DEPTH });
  });
});
