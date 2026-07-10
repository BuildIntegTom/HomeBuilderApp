import { memberBoxSizeIn, type PanelMember } from "@building-integrity/panel-catalog";

const IN3_PER_FT3 = 12 * 12 * 12;

export interface PanelStrawVolume {
  envelopeVolumeFt3: number;
  memberVolumeFt3: number;
  strawVolumeFt3: number;
}

/**
 * Straw volume = the panel's overall envelope (width x depth x height)
 * minus every modeled member's own box volume (skins, plates, studs,
 * girts, nailer — everything currently modeled is wood/plywood, never
 * straw). Illustrative, not a true CSG cutout: overlapping members (e.g.
 * a girt bar and the stud it's flush against) aren't de-duplicated, so
 * this slightly *underestimates* the real straw volume whenever members
 * touch/overlap — acceptable for a reference figure, not a fabrication
 * quantity.
 */
export function computeStandardPanelStrawVolume(
  members: PanelMember[],
  overallDimensions: { heightIn: number; widthIn: number; depthIn: number },
): PanelStrawVolume {
  const envelopeVolumeIn3 = overallDimensions.heightIn * overallDimensions.widthIn * overallDimensions.depthIn;
  const memberVolumeIn3 = members.reduce((sum, member) => {
    const size = memberBoxSizeIn(member);
    return sum + size.xIn * size.yIn * size.zIn;
  }, 0);
  return {
    envelopeVolumeFt3: envelopeVolumeIn3 / IN3_PER_FT3,
    memberVolumeFt3: memberVolumeIn3 / IN3_PER_FT3,
    strawVolumeFt3: (envelopeVolumeIn3 - memberVolumeIn3) / IN3_PER_FT3,
  };
}
