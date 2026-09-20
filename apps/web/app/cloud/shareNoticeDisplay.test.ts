import { describe, expect, it } from "vitest";
import type { ShareNoticeRow } from "./cloudTypes";
import { grantDate } from "./sharingDisplay";
import {
  SHARE_NOTICE_DISMISS_FAILED_MESSAGE,
  SHARE_NOTICE_DURABLE_NOTE,
  SHARE_NOTICE_GOT_IT,
  SHARE_NOTICE_LABEL,
  SHARE_NOTICE_OPEN_SHARED,
  dismissFailureMessage,
  groupShareNotices,
  shareNoticeHeading,
  shareNoticeLine,
} from "./shareNoticeDisplay";
import { DISMISS_REFUSED_MESSAGE } from "./shareNoticeLogic";

// The exact timestamp text jsonb produced on local PostgreSQL 17.4.
const AT = "2026-09-20T12:13:28.972611-05:00";
const LATER = "2026-09-20T13:00:00.000000-05:00";
const P1 = "c2aba1e8-9393-44af-a9d0-872819a14263";
const P2 = "a9ff174a-21c6-4972-bced-7e92cab3f7ea";

const row = (over: Partial<ShareNoticeRow> & Pick<ShareNoticeRow, "grantId">): ShareNoticeRow => ({
  projectId: P1,
  projectName: "Smith House",
  ownerCompanyName: "Building Integrity",
  grantedByName: "Mia Member",
  granteeKind: "person",
  granteeName: "Rory Rare",
  createdAt: AT,
  ...over,
});

describe("the notice's words", () => {
  it("is headed 'Shared with you' for one project", () => {
    expect(SHARE_NOTICE_LABEL).toBe("Shared with you");
    expect(shareNoticeHeading(1)).toBe("Shared with you");
    expect(shareNoticeHeading(0)).toBe("Shared with you");
  });

  it("counts the projects when several arrive at once", () => {
    expect(shareNoticeHeading(3)).toBe("Shared with you: 3 projects");
  });

  it("names who shared which project, and when", () => {
    expect(shareNoticeLine(row({ grantId: "g1" }))).toBe(
      `Mia Member (Building Integrity) shared Smith House with you · ${grantDate(AT)}`,
    );
  });

  it("names the company for a company grant, not 'you'", () => {
    expect(shareNoticeLine(row({ grantId: "g2", granteeKind: "company", granteeName: "Rare Forms" }))).toBe(
      `Mia Member (Building Integrity) shared Smith House with Rare Forms · ${grantDate(AT)}`,
    );
  });

  it("shows a missing sharer name as a gap, never empty brackets", () => {
    expect(shareNoticeLine(row({ grantId: "g3", grantedByName: null }))).toContain("someone (Building Integrity)");
  });

  it("shows a missing owner name as the same visible gap the Shared tab uses", () => {
    expect(shareNoticeLine(row({ grantId: "g4", ownerCompanyName: "" }))).toContain("(owner name not available)");
  });

  it("shows an unnamed project as (untitled), never as an empty name", () => {
    expect(shareNoticeLine(row({ grantId: "g5", projectName: "" }))).toContain("shared (untitled) with you");
  });

  it("offers the two buttons the plan names", () => {
    expect(SHARE_NOTICE_OPEN_SHARED).toBe("Open Shared with us");
    expect(SHARE_NOTICE_GOT_IT).toBe("Got it");
  });

  it("says the Shared tab is the durable signal, so Got it costs nothing", () => {
    expect(SHARE_NOTICE_DURABLE_NOTE).toContain("Shared with us");
  });

  it("says a failed Got it left the notice showing, and claims nothing was cleared", () => {
    expect(SHARE_NOTICE_DISMISS_FAILED_MESSAGE).toContain("still here");
    expect(SHARE_NOTICE_DISMISS_FAILED_MESSAGE.toLowerCase()).not.toContain("cleared.");
  });
});

describe("what a failed Got it says", () => {
  it("uses the route's own words when the route refused for a reason we wrote", () => {
    expect(dismissFailureMessage(403, DISMISS_REFUSED_MESSAGE)).toBe(DISMISS_REFUSED_MESSAGE);
  });

  it("never shows the generic 500 envelope, which explains nothing", () => {
    // errorResponse()'s deliberately contentless answer. Showing it on a notice
    // told the person neither that it failed nor that the notice was still up.
    expect(dismissFailureMessage(500, "Something went wrong")).toBe(SHARE_NOTICE_DISMISS_FAILED_MESSAGE);
  });

  it("covers a network failure and an empty body too", () => {
    expect(dismissFailureMessage(0, "Couldn't reach the server. Nothing was saved or changed.")).toBe(SHARE_NOTICE_DISMISS_FAILED_MESSAGE);
    expect(dismissFailureMessage(403, "   ")).toBe(SHARE_NOTICE_DISMISS_FAILED_MESSAGE);
    expect(dismissFailureMessage(401, "Not signed in")).toBe(SHARE_NOTICE_DISMISS_FAILED_MESSAGE);
  });

  it("always says the notice is still there, whichever message is chosen", () => {
    for (const [status, message] of [[403, DISMISS_REFUSED_MESSAGE], [500, "Something went wrong"], [0, ""]] as const) {
      expect(dismissFailureMessage(status, message)).toContain("still here");
    }
  });
});

describe("grouping when several arrive at once", () => {
  it("has nothing to say about an empty list", () => {
    expect(groupShareNotices([])).toEqual([]);
  });

  it("makes one group per project, in first-appearance (oldest-first) order", () => {
    const groups = groupShareNotices([
      row({ grantId: "g1", projectId: P1, projectName: "Smith House" }),
      row({ grantId: "g2", projectId: P2, projectName: "Jones House", createdAt: LATER }),
    ]);
    expect(groups.map((g) => g.projectName)).toEqual(["Smith House", "Jones House"]);
    expect(groups.map((g) => g.firstCreatedAt)).toEqual([AT, LATER]);
  });

  it("lists ONE project reached two ways as one group with both reasons", () => {
    // Confirmed on local PostgreSQL 17.4: sharing one project with a person AND
    // with their company really does return two rows sharing a project_id.
    const groups = groupShareNotices([
      row({ grantId: "g1", granteeKind: "person", granteeName: "Rory Rare" }),
      row({ grantId: "g2", granteeKind: "company", granteeName: "Rare Forms" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].lines).toEqual([
      `Mia Member (Building Integrity) shared Smith House with you · ${grantDate(AT)}`,
      `Mia Member (Building Integrity) shared Smith House with Rare Forms · ${grantDate(AT)}`,
    ]);
    expect(groups[0].grantIds).toEqual(["g1", "g2"]);
  });

  it("collapses two grants that would print the same line, but keeps both ids", () => {
    const groups = groupShareNotices([row({ grantId: "g1" }), row({ grantId: "g2" })]);
    expect(groups[0].lines).toHaveLength(1);
    expect(groups[0].grantIds).toEqual(["g1", "g2"]);
  });

  it("shows an unnamed project as (untitled) in the group heading", () => {
    expect(groupShareNotices([row({ grantId: "g1", projectName: "   " })])[0].projectName).toBe("(untitled)");
  });

  it("keeps three separate projects separate", () => {
    const groups = groupShareNotices([
      row({ grantId: "g1", projectId: P1 }),
      row({ grantId: "g2", projectId: P2 }),
      row({ grantId: "g3", projectId: "7b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d5e" }),
    ]);
    expect(groups).toHaveLength(3);
    expect(shareNoticeHeading(groups.length)).toBe("Shared with you: 3 projects");
  });
});
