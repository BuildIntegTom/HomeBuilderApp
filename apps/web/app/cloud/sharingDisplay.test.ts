import { describe, expect, it } from "vitest";
import type { AccessGrantRow, SharedReach } from "./cloudTypes";
import {
  REMOVE_REFUSED_MESSAGE,
  SHARED_EMPTY_MESSAGE,
  SHARED_OTHER_COMPANIES_MESSAGE,
  SHARED_TAB_LABEL,
  SHARE_ACCESS_LINE,
  accessRowLine,
  cascadeOffer,
  companyShareLine,
  copyOwnedByLine,
  grantDate,
  ownerAccessLine,
  ownerFilingText,
  reachSummary,
  reachText,
  refileHeading,
  removedMessage,
  sharedEmptyLines,
  sharedRowDetail,
  showRemove,
} from "./sharingDisplay";

const AT = "2026-09-14T15:00:00.000000+00:00";
const person = (granteeName: string, grantedByName: string): SharedReach => ({ via: "person", granteeName, grantedByName, createdAt: AT });
const company = (granteeName: string, grantedByName: string): SharedReach => ({ via: "company", granteeName, grantedByName, createdAt: AT });
const creator = (granteeName: string): SharedReach => ({ via: "creator", granteeName, grantedByName: null, createdAt: AT });

const grant = (over: Partial<AccessGrantRow> & Pick<AccessGrantRow, "grantId" | "granteeName">): AccessGrantRow => ({
  kind: "shared",
  granteeKind: "person",
  granteeIsConsortium: false,
  grantedByName: "Bob",
  grantedByYou: false,
  isYou: false,
  createdAt: AT,
  canRemove: true,
  sharesMadeByGrantee: [],
  ...over,
});

describe("the Shared tab — labels", () => {
  it("is called Shared with us", () => {
    expect(SHARED_TAB_LABEL).toBe("Shared with us");
  });

  it("says how each grant reached you, in the plan's words", () => {
    expect(reachText(person("Rory", "Bob"))).toBe("shared with you by Bob");
    expect(reachText(company("Rare Forms", "Bob"))).toBe("shared with Rare Forms by Bob");
    expect(reachText(creator("Dave"))).toBe("you created it");
  });

  it("names the owner's filing, since a shared project has no folder of the viewer's own", () => {
    expect(ownerFilingText("Building Integrity", "proposals")).toBe("Owned by Building Integrity › Proposals");
    expect(ownerFilingText("Building Integrity", "current")).toBe("Owned by Building Integrity › Current Projects");
  });

  it("reads 'Owned by Building Integrity › Proposals · shared with you by Bob'", () => {
    expect(sharedRowDetail({ ownerCompanyName: "Building Integrity", folder: "proposals", reachedVia: [person("Rory", "Bob")] })).toBe(
      "Owned by Building Integrity › Proposals · shared with you by Bob",
    );
  });

  it("3D: a project you created in Seed's tree is listed as 'you created it', owned by Seed", () => {
    expect(sharedRowDetail({ ownerCompanyName: "The Seed Collaborative", folder: "current", reachedVia: [creator("Mia")] })).toBe(
      "Owned by The Seed Collaborative › Current Projects · you created it",
    );
  });

  it("shows a blank owner as a visible gap, never an empty 'Owned by  ›'", () => {
    expect(ownerFilingText("", "past")).toBe("Owned by (owner name not available) › Past Projects");
  });
});

describe("the Shared tab — grouping", () => {
  it("a project shared personally AND with your company is one row carrying both reasons, oldest first", () => {
    expect(reachSummary([person("Rory", "Mia"), company("Rare Forms", "Mia")])).toBe("shared with you by Mia · shared with Rare Forms by Mia");
  });

  it("identical wordings collapse, so one reason is never printed twice", () => {
    expect(reachSummary([person("Rory", "Mia"), person("Rory", "Mia")])).toBe("shared with you by Mia");
  });

  it("a creator grant plus a later share keeps both", () => {
    expect(reachSummary([creator("Rory"), person("Rory", "Dave")])).toBe("you created it · shared with you by Dave");
  });

  it("the empty state adds the other-companies line only when there is another company to act as", () => {
    expect(sharedEmptyLines(0)).toEqual([SHARED_EMPTY_MESSAGE]);
    expect(sharedEmptyLines(1)).toEqual([SHARED_EMPTY_MESSAGE]);
    expect(sharedEmptyLines(2)).toEqual([SHARED_EMPTY_MESSAGE, SHARED_OTHER_COMPANIES_MESSAGE]);
    expect(SHARED_OTHER_COMPANIES_MESSAGE).toBe("Projects shared with your other companies appear when you act as them.");
  });
});

describe("refiling (11)", () => {
  it("the picker says whose folders it refiles into", () => {
    expect(refileHeading("Building Integrity")).toBe("Refile in Building Integrity's folders");
  });
});

describe("the access list — labels", () => {
  it("owner line, fixed and with no control", () => {
    expect(ownerAccessLine("Building Integrity")).toBe(
      "Building Integrity owns this project. Every Building Integrity member has access, and only a platform admin can delete it.",
    );
  });

  it("person, company, Seed company and creator rows", () => {
    const date = grantDate(AT);
    expect(accessRowLine(grant({ grantId: "g1", granteeName: "Frank" }))).toBe(`Frank (person) — shared by Bob · ${date}`);
    expect(accessRowLine(grant({ grantId: "g2", granteeName: "Rare Forms", granteeKind: "company" }))).toBe(
      `Rare Forms (company: every current and future member) — shared by Bob · ${date}`,
    );
    expect(accessRowLine(grant({ grantId: "g3", granteeName: "The Seed Collaborative", granteeKind: "company", granteeIsConsortium: true }))).toBe(
      `The Seed Collaborative (company: The Seed Collaborative's own members, not the whole co-operative) — shared by Bob · ${date}`,
    );
    expect(accessRowLine(grant({ grantId: "g4", granteeName: "Dave", kind: "creator", grantedByName: null }))).toBe("Dave — created this project");
  });

  it("'shared by Frank' makes no claim about whether Frank still has access", () => {
    const line = accessRowLine(grant({ grantId: "g5", granteeName: "Nick", grantedByName: "Frank" }));
    expect(line).toMatch(/shared by Frank · /);
    expect(line).not.toMatch(/removed|no longer|still has|former/i);
  });

  it("an unparseable date says so", () => {
    expect(grantDate("yesterday")).toBe("date not recorded");
    expect(grantDate(AT)).toMatch(/2026/);
  });
});

describe("the access list — who sees Remove", () => {
  it("shows Remove exactly where the route said the database would allow it, and nowhere else", () => {
    expect(showRemove(grant({ grantId: "a", granteeName: "x", canRemove: true }))).toBe(true);
    expect(showRemove(grant({ grantId: "b", granteeName: "x", canRemove: false }))).toBe(false);
    // Not inferred from other flags: a grant you made that the route says you cannot remove stays hidden.
    expect(showRemove(grant({ grantId: "c", granteeName: "x", canRemove: false, grantedByYou: true }))).toBe(false);
  });

  it("a refused removal says what the database allows", () => {
    expect(REMOVE_REFUSED_MESSAGE).toMatch(/^You can remove only the shares you made/);
    expect(REMOVE_REFUSED_MESSAGE).toMatch(/Nothing was changed\.$/);
  });
});

describe("the access list — the cascade offer (Open Item 1)", () => {
  const frank = grant({ grantId: "gF", granteeName: "Frank", sharesMadeByGrantee: ["gN", "gS"] });
  const nick = grant({ grantId: "gN", granteeName: "Nick", grantedByName: "Frank" });
  const seed = grant({ grantId: "gS", granteeName: "The Seed Collaborative", granteeKind: "company", granteeIsConsortium: true, grantedByName: "Frank" });
  const rf = grant({ grantId: "gR", granteeName: "Rare Forms", granteeKind: "company", sharesMadeByGrantee: [] });

  it("a personal grant offers the shares that person made, PRE-TICKED, with a count", () => {
    expect(cascadeOffer(frank, [frank, nick, seed, rf])).toEqual({
      grantIds: ["gN", "gS"],
      label: "Also remove the 2 shares Frank made",
      recipients: ["Nick", "The Seed Collaborative"],
      defaultChecked: true,
    });
    expect(cascadeOffer({ ...frank, sharesMadeByGrantee: ["gN"] }, [frank, nick])?.label).toBe("Also remove the 1 share Frank made");
  });

  it("a company grant offers nothing", () => {
    expect(cascadeOffer(rf, [frank, nick, seed, rf])).toBeNull();
    expect(cascadeOffer({ ...rf, sharesMadeByGrantee: ["gN"] }, [nick, rf])).toBeNull();
  });

  it("offers nothing when the person made no shares", () => {
    expect(cascadeOffer(nick, [frank, nick, seed])).toBeNull();
  });

  it("offers only shares the remover could remove, and only the ones on screen", () => {
    const notMine = { ...nick, canRemove: false };
    expect(cascadeOffer(frank, [frank, notMine, seed])?.grantIds).toEqual(["gS"]);
    expect(cascadeOffer(frank, [frank, notMine])).toBeNull();
    // gS is listed as Frank's, but it is not on screen: not offered.
    expect(cascadeOffer(frank, [frank, nick])?.grantIds).toEqual(["gN"]);
  });

  it("after removal, says what happened and claims nothing more", () => {
    expect(removedMessage("Frank", 0, 0)).toBe("Removed the share with Frank.");
    expect(removedMessage("Frank", 2, 0)).toBe("Removed the share with Frank. Also removed 2 shares they made.");
    expect(removedMessage("Frank", 1, 1)).toBe("Removed the share with Frank. Also removed 1 share they made. 1 share they made was already gone or not yours to remove.");
  });
});

describe("the share form", () => {
  it("always states the access level", () => {
    expect(SHARE_ACCESS_LINE).toBe("They get full edit access, costs included, and can share it onward.");
  });

  it("a company adds every current and future member; The Seed Collaborative says its own members only", () => {
    expect(companyShareLine("Rare Forms", false)).toBe("…every current and future member of Rare Forms.");
    expect(companyShareLine("The Seed Collaborative", true)).toBe("The Seed Collaborative's own members, not the whole co-operative.");
  });
});

describe("saving as a collaborator", () => {
  it("Save as new says the copy is yours and the owner's project is unchanged", () => {
    expect(copyOwnedByLine("Rare Forms", "Building Integrity")).toBe("This saves a copy, owned by Rare Forms; Building Integrity's project is unchanged.");
  });
});
