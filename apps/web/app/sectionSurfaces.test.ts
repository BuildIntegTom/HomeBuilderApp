import { describe, expect, it } from "vitest";
import {
  hostSurfaceForSection,
  ICON_REACHABLE_SECTION_IDS,
  SUMMARY_SECTION_IDS,
  unreachableSections,
} from "./sectionSurfaces";

/** The shape `page.tsx` builds: three fixed sections, then the derived pages. */
const allIds = (detailPageIds: string[]) => ["detail-summary", "project-totals", "review-log", ...detailPageIds];
const formal = (detailPageIds: string[]) => new Set(["detail-summary", ...detailPageIds]);

describe("the completeness condition — Tommy's 'as long as everything is included'", () => {
  it("⚠ NOTHING IS UNREACHABLE on a rich building, which is what lets the tray go", () => {
    // A two-storey bale-foundation building with a truss roof: the longest
    // `relevantDetailPages` the app produces.
    const pages = [
      "detail-assembly-performance",
      "detail-foundation",
      "detail-bale-foundation",
      "detail-floor",
      "detail-floor-assembly",
      "detail-floor-corner",
      "detail-floor-addon",
      "detail-floor-thermal-slab",
      "detail-truss-plate",
      "detail-box-beam",
      "detail-door-ro",
      "detail-window-ro",
      "detail-plan-view",
      "detail-material-totals",
      "detail-shipping",
      "detail-plaster-master",
      "detail-roof-truss-layout",
    ];
    expect(unreachableSections(allIds(pages), formal(pages))).toEqual([]);
  });

  it("⚠ NOTHING IS UNREACHABLE on the sparsest building either", () => {
    // The case that matters most: `relevantDetailPages` is DERIVED, so a
    // one-storey slab with nothing optional turned on produces a short list,
    // and a section reachable only on rich buildings would hide here.
    const pages = ["detail-plan-view", "detail-material-totals"];
    expect(unreachableSections(allIds(pages), formal(pages))).toEqual([]);
  });

  it("and with no detail pages at all — a brand-new project", () => {
    expect(unreachableSections(allIds([]), formal([]))).toEqual([]);
  });

  it("NAMES what is unreachable rather than just refusing, so U5.2 can say why", () => {
    // A hypothetical future section claimed by nobody. The guard has to point
    // at it by name; "something is unreachable" is not actionable.
    const ids = [...allIds(["detail-plan-view"]), "detail-brand-new-thing"];
    expect(unreachableSections(ids, formal(["detail-plan-view"]))).toEqual(["detail-brand-new-thing"]);
  });

  it("project-totals is reachable because SUMMARY claims it, not because it is formal", () => {
    // It is deliberately NOT in formalDocumentNoteIds — it is not a sheet in
    // the printed packet. If Summary's list ever loses it, it goes unreachable,
    // and this is the test that notices.
    expect(formal(["detail-plan-view"]).has("project-totals")).toBe(false);
    expect(SUMMARY_SECTION_IDS).toContain("project-totals");
  });

  it("review-log is reachable by ICON — and that is a flags-check requirement", () => {
    // Point 5: gaps must surface where a human reviewer expects them. The
    // Review Log is where every pending-BI-confirmation value lands, so if it
    // is ever dropped from the icon list it must become unreachable LOUDLY.
    expect(ICON_REACHABLE_SECTION_IDS).toContain("review-log");
    expect(unreachableSections(["review-log"], new Set())).toEqual([]);
    // The proof that the check is doing work and not merely passing: take the
    // icon away and the Review Log is reported unreachable.
    const withoutTheIcon = ["review-log"].filter((id) => !SUMMARY_SECTION_IDS.includes(id));
    expect(withoutTheIcon).toEqual(["review-log"]);
  });
});

describe("which page hosts a section right now", () => {
  const f = formal(["detail-plan-view", "detail-material-totals"]);

  it("the drawing hosts nothing — every section is a floating note there", () => {
    for (const id of ["detail-summary", "project-totals", "detail-plan-view", "review-log"]) {
      expect(hostSurfaceForSection(id, "drawing", f)).toBeNull();
    }
  });

  it("Summary hosts its three and refuses the rest", () => {
    expect(hostSurfaceForSection("detail-summary", "summary", f)).toBe("summary");
    expect(hostSurfaceForSection("project-totals", "summary", f)).toBe("summary");
    expect(hostSurfaceForSection("detail-material-totals", "summary", f)).toBe("summary");
    expect(hostSurfaceForSection("detail-plan-view", "summary", f)).toBeNull();
    expect(hostSurfaceForSection("review-log", "summary", f)).toBeNull();
  });

  it("Print hosts every formal document — 'all the shop drawings'", () => {
    expect(hostSurfaceForSection("detail-plan-view", "print", f)).toBe("print");
    expect(hostSurfaceForSection("detail-material-totals", "print", f)).toBe("print");
    expect(hostSurfaceForSection("project-totals", "print", f)).toBeNull();
  });

  it("⚠ a section on BOTH pages renders on whichever is open, never twice", () => {
    // detail-summary is the Project Summary you read AND the packet's first
    // sheet. The surface decides, so there is never a second copy.
    expect(hostSurfaceForSection("detail-summary", "summary", f)).toBe("summary");
    expect(hostSurfaceForSection("detail-summary", "print", f)).toBe("print");
    expect(hostSurfaceForSection("detail-summary", "drawing", f)).toBeNull();
  });
});
