import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { wallCompassDirection } from "./wallCompassDirection";

describe("wallCompassDirection", () => {
  it("classifies a rectangle's 4 walls as N/E/S/W, treating screen-up as North", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
    const dirFor = (id: string) => wallCompassDirection(fp.walls.find((w) => w.id === id)!, fp);
    expect(dirFor("AB")).toBe("N"); // top wall, exterior faces up
    expect(dirFor("BC")).toBe("E"); // right wall, exterior faces right
    expect(dirFor("CD")).toBe("S"); // bottom wall, exterior faces down
    expect(dirFor("DA")).toBe("W"); // left wall, exterior faces left
  });

  it("classifies an octagon's 4 straight walls the same way as a rectangle's", () => {
    const fp = buildOctagonFootprint(40, 20);
    const dirFor = (id: string) => wallCompassDirection(fp.walls.find((w) => w.id === id)!, fp);
    expect(dirFor("01")).toBe("N"); // top straight wall
    expect(dirFor("23")).toBe("E"); // right straight wall
    expect(dirFor("45")).toBe("S"); // bottom straight wall
    expect(dirFor("67")).toBe("W"); // left straight wall
  });

  it("classifies an octagon's 4 mitered corner walls as the intercardinal between their 2 neighbors, going clockwise N, NE, E, SE, S, SW, W, NW", () => {
    const fp = buildOctagonFootprint(40, 20);
    const dirFor = (id: string) => wallCompassDirection(fp.walls.find((w) => w.id === id)!, fp);
    expect(dirFor("12")).toBe("NE"); // between the N (01) and E (23) walls
    expect(dirFor("34")).toBe("SE"); // between the E (23) and S (45) walls
    expect(dirFor("56")).toBe("SW"); // between the S (45) and W (67) walls
    expect(dirFor("70")).toBe("NW"); // between the W (67) and N (01) walls
  });
});
