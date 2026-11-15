import type { PanelMember } from "./componentSchema";
import { memberBoxSizeIn } from "./panelMemberHelpers";
import type { ExportableAssembly } from "./projectCutListCsv";

/**
 * ⚠ **"THE PIECE'S LARGEST FACE" — Tommy, 2026-11-15, and it applies to SHOP
 * ITEMS ONLY.**
 *
 * > *"Square feet should be the piece's largest face. For a safety gap that
 * > is 15.5in x 120in = 12.9 sq ft, not the 3/4in x 120in = 0.63 the
 * > elevation gives."*
 *
 * Every other area in this app is a face chosen for a REASON: a wall panel's
 * standing face because that is the wall it makes, a deck panel's covered
 * face because that is the floor it carries, a roof panel's sloped face
 * because that is the material bought and hung. A shop item makes no wall and
 * carries no floor — it is a piece of stock a crew picks up — so the face
 * that describes it is simply its biggest one.
 *
 * ⚠ **This is the first number in this app where "area" means two different
 * things on purpose.** A Safety Gap reads 0.63 sq ft on the Project Summary's
 * coverage (it covers 3/4in of wall, which is the truth about the wall) and
 * 12.9 sq ft on the shop and crew exports (it is a 15.5in x 10ft sheet, which
 * is the truth about the piece). Both are right about their own question. The
 * previous invariant — that the two agreed by construction — is what has been
 * given up, and it was given up deliberately rather than broken.
 */

const SQ_IN_PER_SQ_FT = 144;

/** The largest of a box's three faces, in square feet. Order-independent. */
export function largestFaceSqFt(aIn: number, bIn: number, cIn: number): number {
  const a = Math.abs(aIn);
  const b = Math.abs(bIn);
  const c = Math.abs(cIn);
  return Math.max(a * b, a * c, b * c) / SQ_IN_PER_SQ_FT;
}

/**
 * One PIECE's largest face, from its dimensions as cut.
 *
 * ⚠ Reads `actualDimsIn` rather than `memberBoxSizeIn`, and the difference
 * matters. `memberBoxSizeIn` rotates the piece into the panel's axes, so a
 * plate laid flat and the same plate stood on edge come back as different
 * boxes. A piece's own three dimensions do not change when somebody turns it
 * over, and neither does its largest face — which is exactly the property
 * being priced.
 */
export function memberLargestFaceSqFt(member: PanelMember): number {
  const { thicknessIn, widthIn, lengthIn } = member.actualDimsIn;
  return largestFaceSqFt(thicknessIn, widthIn, lengthIn);
}

/**
 * How deep the assembled thing is, in the panel's own Y (through the wall) —
 * derived from where its pieces actually sit rather than taken on trust from
 * whichever pipeline built it.
 *
 * ⚠ **Derived, because six pipelines would otherwise each have to be asked,
 * and one of them would be wrong.** A Safety Gap's depth is the wall's
 * thickness, a Box Beam's is the wall's thickness, a floor panel's is its own
 * joist depth plus two lids — three different answers from three different
 * places, none of which is on the fabrication group. The pieces know.
 */
export function assemblyEnvelopeDepthIn(members: readonly PanelMember[]): number {
  let depthIn = 0;
  for (const member of members) {
    depthIn = Math.max(depthIn, member.position.yIn + memberBoxSizeIn(member).yIn);
  }
  return depthIn;
}

/**
 * ⚠ **THE ONE PLACE THAT DECIDES WHICH FACE AN EXPORTED ROW IS MEASURED BY.**
 *
 * A straw panel keeps the face it always had — *"Shop items only. Straw
 * panels keep their elevation face, unchanged."* A shop item takes its
 * largest. `countsAsPanel` is the switch, which is why that field was worth
 * having: one flag now answers "does a crew tally it", "does the Summary
 * count it" and "which face is it measured by", and those three answers can
 * never drift apart.
 *
 * ⚠ **Not a cosmetic difference for a SHORT panel either, which is why the
 * gate is not simply `max`.** A 48in-wide gable tile only 12in tall in a
 * 15.5in wall has its largest face through the wall (48 x 15.5), not standing
 * (48 x 12). It is a straw panel, it counts, and it is measured standing —
 * taking the max unconditionally would have quietly re-measured the top of
 * every gable row.
 */
export function assemblyFaceSqFt(assembly: Pick<ExportableAssembly, "widthIn" | "heightIn" | "depthIn" | "countsAsPanel">): number {
  const { widthIn, heightIn, depthIn, countsAsPanel } = assembly;
  if (countsAsPanel) return (Math.abs(widthIn) * Math.abs(heightIn)) / SQ_IN_PER_SQ_FT;
  return largestFaceSqFt(widthIn, heightIn, depthIn);
}
