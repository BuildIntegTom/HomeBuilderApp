import { describe, expect, it } from "vitest";
import { computeInstallSequence } from "@building-integrity/panel-catalog";
import {
  INSTALL_PHASE_BY_FAMILY,
  UNKNOWN_FAMILY_PHASE,
  buildInstallSequenceItems,
  installSlotIndex,
  type InstallSequenceItemsInput,
} from "./installSequenceItems";

/* ──────────────────────────────────────────────────────────────────────────
   B35 — THE FOUR ORDERING FAULTS, PINNED

   ⚠ Every one of these was found by reading 86 chips off a shop packet in the
   BROWSER, while this logic lived inside a `useMemo` where no test could see
   it. Three are the same shape, and it is the shape that matters:

     A fabrication group gathers physically IDENTICAL panels, so an export's
     own order is SHAPE order, not building order.

   Which is why a family that HAS positional data must use it, and a family
   that has none must say so rather than defaulting to zero.
   ────────────────────────────────────────────────────────────────────────── */

const EMPTY: InstallSequenceItemsInput = {
  assemblies: [],
  wallPositionByName: new Map(),
  roofPanelNames: new Set(),
  roofBearingPositionByName: new Map(),
  runPositionByFamilyAndName: new Map(),
};

/** The names in numbering order. */
function order(input: Partial<InstallSequenceItemsInput>): string[] {
  const items = buildInstallSequenceItems({ ...EMPTY, ...input });
  const sequence = computeInstallSequence(items);
  return [...sequence.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key.split("|")[1]!);
}

describe("⚠ fault 1 — a roof panel and a floor panel share ONE export family", () => {
  /* Measured: R1-R8 came out 0011-0018, in among the floor deck and ahead of
     every wall panel, against his own packet order (floor, walls, truss
     plate, ROOF LAST). Both are `"Deck panel"`. */
  const assemblies = [
    { panelType: "Deck panel", instanceNames: ["F1", "R1", "F2", "R2"] },
    { panelType: "Wall panel", instanceNames: ["N1"] },
  ];
  const wallPositionByName = new Map([
    ["N1", { storyIndex: 0, ringIndex: 0, wallIndex: 0, slotIndex: 0, bandIndex: 0 }],
  ]);

  it("without the roof set, every deck panel numbers before the walls — the fault", () => {
    expect(order({ assemblies, wallPositionByName })).toEqual(["F1", "R1", "F2", "R2", "N1"]);
  });

  it("⚠ told apart by the pipeline's own `kind`, the roof goes LAST", () => {
    expect(
      order({ assemblies, wallPositionByName, roofPanelNames: new Set(["R1", "R2"]) }),
    ).toEqual(["F1", "F2", "N1", "R1", "R2"]);
  });

  it("⚠ never by the `R` on the front of the name", () => {
    /* `PanelInstance.name` is a display string. Parsing it is what broke
       `combinedPanelLabel` the moment a hyphen changed — so a floor panel
       that happens to be called `R1` is still a floor panel here. */
    expect(
      order({
        assemblies: [{ panelType: "Deck panel", instanceNames: ["R1", "F1"] }],
        roofPanelNames: new Set(),
      }),
    ).toEqual(["R1", "F1"]);
  });
});

describe("⚠ fault 2 — a gable tile's slot index is NEGATIVE and counts down", () => {
  it("unfolds `-(tileIndex + 1)` back to the tile index", () => {
    /* Measured: the gable row numbered backwards, NE8 first and NE5 last,
       against a name series assigned in true along-wall order. */
    expect([-1, -2, -3, -4].map(installSlotIndex)).toEqual([0, 1, 2, 3]);
  });

  it("leaves an ordinary wall slot alone", () => {
    expect([0, 1, 7].map(installSlotIndex)).toEqual([0, 1, 7]);
  });

  it("so a gable row numbers along the wall, not against it", () => {
    const names = ["NE5", "NE6", "NE7", "NE8"];
    expect(
      order({
        assemblies: [{ panelType: "Wall panel", instanceNames: [...names].reverse() }],
        wallPositionByName: new Map(
          names.map((name, tileIndex) => [
            name,
            {
              storyIndex: 1,
              ringIndex: 0,
              wallIndex: 1,
              slotIndex: installSlotIndex(-(tileIndex + 1)),
              bandIndex: 0,
            },
          ]),
        ),
      }),
    ).toEqual(names);
  });
});

describe("⚠ fault 3 — a family with a real position must use it", () => {
  /* Measured: the truss plates came out N, E, S, W and only then NE, SE, SW,
     NW — the four square facets ahead of the four diagonals, because those
     shapes group together on a fabrication sheet. */
  const assemblies = [{ panelType: "Roof bearing", instanceNames: ["plate-N", "plate-E", "plate-NE"] }];

  it("without the wall lookup it keeps the fabrication groups' order — the fault", () => {
    expect(order({ assemblies })).toEqual(["plate-N", "plate-E", "plate-NE"]);
  });

  it("⚠ given each plate's own wall, it runs clockwise", () => {
    expect(
      order({
        assemblies,
        roofBearingPositionByName: new Map([
          ["plate-N", { ringIndex: 0, wallIndex: 0 }],
          ["plate-NE", { ringIndex: 0, wallIndex: 1 }],
          ["plate-E", { ringIndex: 0, wallIndex: 2 }],
        ]),
      }),
    ).toEqual(["plate-N", "plate-NE", "plate-E"]);
  });
});

describe("⚠ fault 4 — the deck and tilted-gable rows scrambled the same way", () => {
  it("both run along their own run, by `atIn`", () => {
    expect(
      order({
        assemblies: [{ panelType: "Tilted gable", instanceNames: ["T1", "T4", "T2", "T3"] }],
        runPositionByFamilyAndName: new Map([
          ["Tilted gable|T1", { wallIndex: 1, slotIndex: 0 }],
          ["Tilted gable|T2", { wallIndex: 1, slotIndex: 48 }],
          ["Tilted gable|T3", { wallIndex: 1, slotIndex: 96 }],
          ["Tilted gable|T4", { wallIndex: 1, slotIndex: 144 }],
        ]),
      }),
    ).toEqual(["T1", "T2", "T3", "T4"]);
  });

  it("⚠ `slotIndex` takes INCHES here, and fractions sort correctly", () => {
    /* Every field is only ever compared, so any number that increases along
       the run is a valid answer — and the distance along the run is the
       truest one that pipeline has. */
    expect(
      order({
        assemblies: [{ panelType: "Deck panel", instanceNames: ["b", "a"] }],
        runPositionByFamilyAndName: new Map([
          ["Deck panel|a", { wallIndex: 0, slotIndex: 0.125 }],
          ["Deck panel|b", { wallIndex: 0, slotIndex: 19.375 }],
        ]),
      }),
    ).toEqual(["a", "b"]);
  });
});

describe("the phase table is his packet order", () => {
  it("floor sheets first, walls, truss plate, roof last", () => {
    expect(INSTALL_PHASE_BY_FAMILY["Deck panel"]!.phase).toBe("floor");
    expect(INSTALL_PHASE_BY_FAMILY["Wall panel"]!.phase).toBe("wall");
    expect(INSTALL_PHASE_BY_FAMILY["Roof bearing"]!.phase).toBe("roof-bearing");
    expect(INSTALL_PHASE_BY_FAMILY["Ridge beam"]!.phase).toBe("roof");
  });

  it("⚠ the families with no position of their own follow the panels in their phase", () => {
    /* Left at the default they would score 0 on every positional field and
       take 0001 on the whole building. */
    for (const family of ["Spanning header", "Mid-wall beam", "Tilted gable", "Ridge post"]) {
      expect(INSTALL_PHASE_BY_FAMILY[family]!.groupRank, family).toBeGreaterThan(0);
    }
    expect(
      order({
        assemblies: [
          { panelType: "Mid-wall beam", instanceNames: ["beam"] },
          { panelType: "Wall panel", instanceNames: ["N1"] },
        ],
        wallPositionByName: new Map([
          ["N1", { storyIndex: 0, ringIndex: 0, wallIndex: 0, slotIndex: 0, bandIndex: 0 }],
        ]),
      }),
    ).toEqual(["N1", "beam"]);
  });

  it("⚠ an unknown family is numbered anyway, at the back of the wall phase", () => {
    /* A new pipeline arriving UNNUMBERED would be invisible to a crew. */
    expect(UNKNOWN_FAMILY_PHASE.phase).toBe("wall");
    expect(
      order({
        assemblies: [
          { panelType: "Something new", instanceNames: ["X1"] },
          { panelType: "Wall panel", instanceNames: ["N1"] },
        ],
        wallPositionByName: new Map([
          ["N1", { storyIndex: 0, ringIndex: 0, wallIndex: 0, slotIndex: 0, bandIndex: 0 }],
        ]),
      }),
    ).toEqual(["N1", "X1"]);
  });
});

describe("the whole building, in one pass", () => {
  it("⚠ reproduces the 16ft Octagon's shape: deck, walls, gable row, plates, roof", () => {
    const wallPositionByName = new Map([
      ["N1", { storyIndex: 0, ringIndex: 0, wallIndex: 0, slotIndex: 0, bandIndex: 0 }],
      ["NE1", { storyIndex: 0, ringIndex: 0, wallIndex: 1, slotIndex: 0, bandIndex: 0 }],
      ["NE5", { storyIndex: 1, ringIndex: 0, wallIndex: 1, slotIndex: installSlotIndex(-1), bandIndex: 0 }],
    ]);
    expect(
      order({
        /* Deliberately in the export seam's own order, which is not install
           order — that is the whole point. */
        assemblies: [
          { panelType: "Wall panel", instanceNames: ["NE5", "N1", "NE1"] },
          { panelType: "Roof bearing", instanceNames: ["plate-N"] },
          { panelType: "Deck panel", instanceNames: ["R1", "F1"] },
        ],
        wallPositionByName,
        roofPanelNames: new Set(["R1"]),
        roofBearingPositionByName: new Map([["plate-N", { ringIndex: 0, wallIndex: 0 }]]),
        runPositionByFamilyAndName: new Map([
          ["Deck panel|F1", { wallIndex: 0, slotIndex: 0 }],
          ["Deck panel|R1", { wallIndex: 1, slotIndex: 0 }],
        ]),
      }),
    ).toEqual(["F1", "N1", "NE1", "NE5", "plate-N", "R1"]);
  });
});
