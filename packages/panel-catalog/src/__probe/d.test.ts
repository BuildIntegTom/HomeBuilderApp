import { describe, it } from "vitest";
import { buildFloorRoofPanelMembers } from "../floorRoofPanelMembers";
import { memberLocalCornersIn, memberFaceIndices } from "../panelMemberHelpers";
describe("probe", () => {
  it("prints", () => {
    const m = buildFloorRoofPanelMembers({ kind:"roof", widthIn:24, depthIn:15.5, lengthIn:166.5, structuralGirtEnds:[], pitchIn12:4, bearingSeatDepthIn:15.5 });
    console.log("members:", m.length);
    for (const mm of m) {
      const c = memberLocalCornersIn(mm);
      const f = memberFaceIndices(mm);
      const bad = c.some(([x,y,z]) => !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z));
      const maxIdx = Math.max(0, ...f.flat());
      if (bad || f.length === 0 || maxIdx > c.length) {
        console.log("BAD", mm.memberId, "corners", c.length, "faces", f.length, "maxIdx", maxIdx, "nonFinite", bad);
      }
    }
    console.log("check done");
  });
});
