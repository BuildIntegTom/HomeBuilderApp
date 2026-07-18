import { describe, expect, it } from "vitest";
import { buildOpeningAssemblyMembers } from "./openingAssemblyMembers";
import { JACK_STUD_THICKNESS_IN } from "./jackStudMembers";
import { PLATE_2X4_THICKNESS_IN } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const SLOT_WIDTH_IN = 60;
const HEADER_HEIGHT_IN = 18;
const SILL_HEIGHT_IN = 32;

describe("buildOpeningAssemblyMembers", () => {
  describe("door (no sill)", () => {
    const doorRoHeightIn = 81;
    const members = buildOpeningAssemblyMembers(
      SLOT_WIDTH_IN,
      DEPTH_IN,
      "door",
      "plywood",
      0, // bottomZIn: floor
      doorRoHeightIn, // jackStudSpanIn: real RO height
      HEADER_HEIGHT_IN,
      SILL_HEIGHT_IN,
      [],
      false,
    );

    it("places the header directly on top of the real door RO height", () => {
      const headerMembers = members.filter((m) => m.memberId.startsWith("header_"));
      expect(headerMembers.length).toBeGreaterThan(0);
      const minZ = Math.min(...headerMembers.map((m) => m.position.zIn));
      expect(minZ).toBeCloseTo(doorRoHeightIn, 6);
    });

    it("spans jack studs from the floor to the header's bottom", () => {
      const leftJackStuds = members.filter((m) => m.memberId.startsWith("jack_left_"));
      expect(leftJackStuds.length).toBeGreaterThan(0);
      for (const m of leftJackStuds) {
        expect(m.position.zIn).toBeCloseTo(0, 6);
        expect(m.actualDimsIn.lengthIn).toBeCloseTo(doorRoHeightIn, 6);
      }
    });

    it("positions the right jack stud at the slot's far edge", () => {
      const rightJackStuds = members.filter((m) => m.memberId.startsWith("jack_right_"));
      for (const m of rightJackStuds) {
        expect(m.position.xIn).toBeCloseTo(SLOT_WIDTH_IN - JACK_STUD_THICKNESS_IN, 6);
      }
    });

    it("has no sill members", () => {
      expect(members.some((m) => m.memberId.startsWith("sill_"))).toBe(false);
    });
  });

  describe("window (with sill)", () => {
    const jackStudSpanIn = 60; // illustrative "fill remaining" span
    const members = buildOpeningAssemblyMembers(
      SLOT_WIDTH_IN,
      DEPTH_IN,
      "window",
      "plywood",
      SILL_HEIGHT_IN, // bottomZIn: sits on top of the sill
      jackStudSpanIn,
      HEADER_HEIGHT_IN,
      SILL_HEIGHT_IN,
      [SLOT_WIDTH_IN - 2 * JACK_STUD_THICKNESS_IN], // one sill spanning the whole RO
      true,
    );

    it("places the header above the sill + jack stud span", () => {
      const headerMembers = members.filter((m) => m.memberId.startsWith("header_"));
      const minZ = Math.min(...headerMembers.map((m) => m.position.zIn));
      expect(minZ).toBeCloseTo(SILL_HEIGHT_IN + jackStudSpanIn, 6);
    });

    it("shifts a header brace's own trapezoidCornersIn up with the rest of the assembly, not just position.zIn", () => {
      // Regression test: a brace's actual rendered geometry comes from
      // trapezoidCornersIn (absolute panel-space corners), not
      // position.xIn/zIn — shiftAndPrefix used to only move the latter,
      // leaving braces rendering at their original near-floor local Z
      // (Tommy: bracing "spawns awkwardly on the ground") while the rest
      // of the header assembly correctly moved up.
      const headerBraces = members.filter((m) => m.memberId.startsWith("header_") && m.position.trapezoidCornersIn);
      expect(headerBraces.length).toBeGreaterThan(0);
      const headerZIn = SILL_HEIGHT_IN + jackStudSpanIn;
      for (const brace of headerBraces) {
        const minCornerZ = Math.min(...brace.position.trapezoidCornersIn!.map((c) => c.zIn));
        expect(minCornerZ).toBeGreaterThanOrEqual(headerZIn - 1e-6);
      }
    });

    it("spans jack studs from the sill's top to the header's bottom", () => {
      const leftJackStuds = members.filter((m) => m.memberId.startsWith("jack_left_"));
      for (const m of leftJackStuds) {
        expect(m.position.zIn).toBeCloseTo(SILL_HEIGHT_IN, 6);
        expect(m.actualDimsIn.lengthIn).toBeCloseTo(jackStudSpanIn, 6);
      }
    });

    it("places the sill at the floor, inset by one jack stud thickness", () => {
      const sillMembers = members.filter((m) => m.memberId.startsWith("sill_0_"));
      expect(sillMembers.length).toBeGreaterThan(0);
      const minZ = Math.min(...sillMembers.map((m) => m.position.zIn));
      expect(minZ).toBeCloseTo(0, 6);
      // The sill's own bottom-plate member starts exactly at the jack stud's thickness.
      const bottomPlate = sillMembers.find((m) => m.memberId.includes("bottom_plate"));
      expect(bottomPlate!.position.xIn).toBeCloseTo(JACK_STUD_THICKNESS_IN, 6);
    });

    it("tiles multiple sills side by side when given multiple widths", () => {
      const twoSillMembers = buildOpeningAssemblyMembers(
        SLOT_WIDTH_IN,
        DEPTH_IN,
        "window",
        "plywood",
        SILL_HEIGHT_IN,
        jackStudSpanIn,
        HEADER_HEIGHT_IN,
        SILL_HEIGHT_IN,
        [20, 20],
        false,
      );
      const sill0 = twoSillMembers.filter((m) => m.memberId.startsWith("sill_0_"));
      const sill1 = twoSillMembers.filter((m) => m.memberId.startsWith("sill_1_"));
      const sill0MinX = Math.min(...sill0.map((m) => m.position.xIn));
      const sill1MinX = Math.min(...sill1.map((m) => m.position.xIn));
      expect(sill0MinX).toBeCloseTo(JACK_STUD_THICKNESS_IN, 6);
      expect(sill1MinX).toBeCloseTo(JACK_STUD_THICKNESS_IN + 20, 6);
    });
  });

  it("uses the 2x4-stud jack stud thickness/positions when that config is selected", () => {
    const members = buildOpeningAssemblyMembers(
      SLOT_WIDTH_IN,
      DEPTH_IN,
      "door",
      "2x4-stud",
      0,
      81,
      HEADER_HEIGHT_IN,
      SILL_HEIGHT_IN,
      [],
      false,
    );
    const rightJackStuds = members.filter((m) => m.memberId.startsWith("jack_right_"));
    for (const m of rightJackStuds) {
      expect(m.position.xIn).toBeCloseTo(SLOT_WIDTH_IN - PLATE_2X4_THICKNESS_IN, 6);
    }
  });

  it("omits jack studs entirely when the span is zero", () => {
    const members = buildOpeningAssemblyMembers(SLOT_WIDTH_IN, DEPTH_IN, "door", "plywood", 0, 0, HEADER_HEIGHT_IN, SILL_HEIGHT_IN, [], false);
    expect(members.some((m) => m.memberId.startsWith("jack_"))).toBe(false);
  });
});
