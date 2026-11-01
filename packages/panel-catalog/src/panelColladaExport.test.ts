import { describe, expect, it } from "vitest";
import { buildBuildingCollada } from "./panelColladaExport";
import { buildBuildingObj, type WorldPlacedPanel } from "./panelObjExport";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { memberFaceIndices, memberLocalCornersIn } from "./panelMemberHelpers";

/**
 * ⚠ **What a .dae has to be true about, and what an .obj never was.**
 *
 * The reason to add this format is the scene GRAPH: SketchUp reads it as a
 * tree of named groups, where an OBJ's `g` lines are face tags and the whole
 * import arrives as one lump. So these tests are about the tree — that each
 * panel is its own node, named, placed by a transform, holding its members —
 * and about the two numeric traps that make a file open and look wrong
 * rather than fail: the 1-based/0-based index shift, and the units.
 */

const IN_PER_FT = 12;
const METRES_PER_INCH = 0.0254;

const panel = (over: Partial<WorldPlacedPanel> = {}): WorldPlacedPanel => ({
  label: "N3",
  worldXIn: 0,
  worldZIn: 0,
  rotationRad: 0,
  members: buildStandardPanelMembers(48, 15.5, 96, false),
  ...over,
});

const NOW = "2026-11-01T00:00:00.000Z";

describe("the building arrives in SketchUp as a tree, not a lump", () => {
  it("every panel is its own named node, holding a node per member", () => {
    const dae = buildBuildingCollada([panel(), panel({ label: "N4", worldXIn: 48 })], "Building", NOW);
    expect(dae).toContain('<node id="panel0" name="N3" type="NODE">');
    expect(dae).toContain('<node id="panel1" name="N4" type="NODE">');
    // Member nodes carry the member's own id as their name, so the Outliner
    // reads like the cut list does.
    const members = buildStandardPanelMembers(48, 15.5, 96, false);
    expect(dae).toContain(`name="${members[0]!.memberId}"`);
    const nodeCount = (dae.match(/<instance_geometry /g) ?? []).length;
    expect(nodeCount).toBe(2 * members.length);
  });

  it("⚠ a panel's placement is on its NODE, not baked into its vertices", () => {
    /* This is what makes a panel a movable group in SketchUp rather than a
       cloud of triangles that happens to sit in the right place — and it is
       the one structural difference from the OBJ exporter, which transforms
       every vertex. */
    const placed = buildBuildingCollada([panel({ worldXIn: 120, worldZIn: 36 })], "Building", NOW);
    const bare = buildBuildingCollada([panel()], "Building", NOW);
    const geometryOf = (dae: string) => dae.slice(dae.indexOf("<library_geometries>"), dae.indexOf("</library_geometries>"));
    expect(geometryOf(placed)).toBe(geometryOf(bare));
    expect(placed).toContain(`${(120 * METRES_PER_INCH).toFixed(6)}`);
    expect(placed).toContain(`${(36 * METRES_PER_INCH).toFixed(6)}`);
  });

  it("⚠ the node transform rotates and translates exactly as the OBJ's vertex maths does", () => {
    /* Same building, two files. If these ever disagree the two downloads are
       two different buildings, which is the defect class this repo keeps
       paying for. */
    const rotationRad = Math.PI / 2;
    const p = panel({ rotationRad, worldXIn: 24, worldZIn: 60, worldYIn: 108 });
    const dae = buildBuildingCollada([p], "Building", NOW);
    const matrix = dae.match(/<matrix sid="transform">([^<]+)<\/matrix>/)![1]!.split(" ").map(Number);

    const [x, y, z] = memberLocalCornersIn(p.members![0]!)[0]!;
    const viaMatrix = [
      matrix[0]! * x * METRES_PER_INCH + matrix[1]! * y * METRES_PER_INCH + matrix[2]! * z * METRES_PER_INCH + matrix[3]!,
      matrix[4]! * x * METRES_PER_INCH + matrix[5]! * y * METRES_PER_INCH + matrix[6]! * z * METRES_PER_INCH + matrix[7]!,
      matrix[8]! * x * METRES_PER_INCH + matrix[9]! * y * METRES_PER_INCH + matrix[10]! * z * METRES_PER_INCH + matrix[11]!,
    ];

    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const viaObjMaths = [
      (x * cos - z * sin + 24) * METRES_PER_INCH,
      (y + 108) * METRES_PER_INCH,
      (x * sin + z * cos + 60) * METRES_PER_INCH,
    ];

    for (const [i, expected] of viaObjMaths.entries()) {
      expect(viaMatrix[i]!).toBeCloseTo(expected, 6);
    }
  });

  it("the bottom row of the transform is a real affine row, not left blank", () => {
    const dae = buildBuildingCollada([panel()], "Building", NOW);
    const matrix = dae.match(/<matrix sid="transform">([^<]+)<\/matrix>/)![1]!.split(" ").map(Number);
    expect(matrix).toHaveLength(16);
    expect(matrix.slice(12)).toEqual([0, 0, 0, 1]);
  });
});

describe("⚠ the two ways a .dae opens and silently looks wrong", () => {
  it("face indices are 0-BASED, where the OBJ exporter's are 1-based", () => {
    /* `memberFaceIndices` was written for OBJ, whose `f` lines start at 1.
       Off by one here is not a crash: it is a mesh whose every face points at
       its neighbour's corner, which imports and looks shredded. */
    const members = buildStandardPanelMembers(48, 15.5, 96, false);
    const first = members[0]!;
    const dae = buildBuildingCollada([panel({ members: [first] })], "Building", NOW);
    const p = dae.match(/<p>([^<]+)<\/p>/)![1]!.split(" ").map(Number);
    expect(p).toEqual(memberFaceIndices(first).flat().map((i) => i - 1));
    expect(Math.min(...p)).toBe(0);
    expect(Math.max(...p)).toBeLessThan(memberLocalCornersIn(first).length);
  });

  it("⚠ geometry is in METRES and the asset says so, so SketchUp imports it at true size", () => {
    const dae = buildBuildingCollada([panel()], "Building", NOW);
    expect(dae).toContain('<unit meter="0.0254" name="inch"/>');
    expect(dae).toContain("<up_axis>Y_UP</up_axis>");
    // A 96in panel is 2.4384m tall, and nothing in the file should be near 96.
    const floats = dae.match(/<float_array[^>]*>([^<]+)<\/float_array>/g)!.flatMap((a) =>
      a.replace(/<[^>]+>/g, "").trim().split(" ").map(Number),
    );
    expect(Math.max(...floats.map(Math.abs))).toBeLessThan(96 * METRES_PER_INCH + 1e-6);
    expect(Math.max(...floats)).toBeGreaterThan(2);
  });

  it("⚠ the ROTATION is not scaled to metres, only the translation", () => {
    /* A rotation has no units. Scaling it would tilt nothing and move
       everything to a fortieth of where it belongs — a building that opens,
       at 1/39th size, with every panel in the wrong place. */
    const dae = buildBuildingCollada([panel({ rotationRad: Math.PI / 2, worldXIn: 100 })], "Building", NOW);
    const matrix = dae.match(/<matrix sid="transform">([^<]+)<\/matrix>/)![1]!.split(" ").map(Number);
    expect(matrix[0]!).toBeCloseTo(0, 9);
    expect(matrix[8]!).toBeCloseTo(1, 9);
    expect(matrix[3]!).toBeCloseTo(100 * METRES_PER_INCH, 9);
  });
});

describe("what it refuses to emit", () => {
  it("a panel with neither members nor a placeholder gets no node at all", () => {
    /* An empty group is a thing somebody finds in the Outliner and wonders
       about. Better that it is simply not there. */
    const dae = buildBuildingCollada([panel({ members: null, blobSizeIn: undefined })], "Building", NOW);
    expect(dae).not.toContain("<node");
    expect(dae).toContain("<library_geometries>");
  });

  it("a memberless panel falls back to the same placeholder box the OBJ does", () => {
    const blob = { widthIn: 36, heightIn: 96, depthIn: 15.5 };
    const dae = buildBuildingCollada([panel({ members: null, blobSizeIn: blob })], "Building", NOW);
    const obj = buildBuildingObj([panel({ members: null, blobSizeIn: blob })], "Building");
    expect(dae).toContain('name="N3_placeholder"');
    expect(obj).toContain("g N3_placeholder");
    // Six quads either way — the same box, described twice.
    expect(dae).toContain("<vcount>4 4 4 4 4 4</vcount>");
  });

  it("escapes a label that would otherwise break the XML", () => {
    const dae = buildBuildingCollada([panel({ label: 'wall "A" & <B>' })], "Building", NOW);
    expect(dae).toContain("name=\"wall &quot;A&quot; &amp; &lt;B&gt;\"");
    expect(dae).not.toContain('name="wall "A"');
  });

  it("⚠ ids never come from a label, because a label may not be a valid XML id", () => {
    /* `balefoundation_ring a` has a space in it, and a 2x4's id would start
       with a digit. An invalid or colliding id makes SketchUp instance the
       wrong geometry, which is far harder to spot than a file that fails. */
    const dae = buildBuildingCollada(
      [panel({ label: "2x4 ring a" }), panel({ label: "2x4 ring a" })],
      "Building",
      NOW,
    );
    for (const id of dae.match(/ id="([^"]+)"/g) ?? []) {
      const value = id.slice(5, -1);
      expect({ id: value, valid: /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) }).toEqual({ id: value, valid: true });
    }
    // Two panels with the same label still get two distinct node ids.
    expect(dae).toContain('id="panel0"');
    expect(dae).toContain('id="panel1"');
  });

  it("is a well-formed document with the sections SketchUp looks for", () => {
    const dae = buildBuildingCollada([panel({ worldXIn: 3 * IN_PER_FT })], "Building", NOW);
    expect(dae.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(dae).toContain('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');
    expect(dae).toContain("<library_visual_scenes>");
    expect(dae).toContain('<instance_visual_scene url="#scene"/>');
    expect(dae.trimEnd().endsWith("</COLLADA>")).toBe(true);
    // Every tag opened is closed: a crude but effective well-formedness check.
    const opens = (dae.match(/<([a-z_]+)(?=[ >])/g) ?? []).filter((t) => !dae.includes(`${t}/>`));
    expect(opens.length).toBeGreaterThan(0);
    for (const tag of new Set(opens)) {
      const name = tag.slice(1);
      const openCount = (dae.match(new RegExp(`<${name}(?=[ >])`, "g")) ?? []).length;
      const closeCount = (dae.match(new RegExp(`</${name}>`, "g")) ?? []).length;
      /* ⚠ The lookahead matters: without it `<p` also matches `<param .../>`,
         which counts every accessor param as a self-closing `<p>` and makes
         the tally go negative. */
      const selfClosing = (dae.match(new RegExp(`<${name}(?=[ >])[^>]*/>`, "g")) ?? []).length;
      expect({ name, open: openCount - selfClosing, close: closeCount }).toEqual({
        name,
        open: closeCount,
        close: closeCount,
      });
    }
  });

  it("⚠ says on its face that it is reference-only", () => {
    /* The OBJ header carries the same sentence. A model that leaves this app
       and loses it is a model somebody builds from. */
    const dae = buildBuildingCollada([panel()], "Building", NOW);
    expect(dae).toContain("not engineered, not for construction");
  });
});
