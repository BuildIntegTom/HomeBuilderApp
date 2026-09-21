import { describe, expect, it } from "vitest";
import {
  MFA_PENDING_MESSAGE,
  SIGN_IN_PROMPT,
  absoluteSaveTime,
  buildCloudMenu,
  cloudStatusLines,
  relativeSaveTime,
  type CloudMenuInput,
} from "./cloudMenu";
import { NO_COMPANY_MESSAGE, consortiumLaterStageMessage, consortiumMenuMessage, type CloudContext } from "./cloudTypes";

const BI = { companyId: "bi", companyName: "Building Integrity", source: "membership" as const };
const SEED_CONSORTIUM = { companyId: "seed", companyName: "The Seed Collaborative", source: "consortium" as const };
const RF_PLATFORM = { companyId: "rf", companyName: "Rare Forms", source: "platform-admin" as const };

const base: CloudMenuInput = {
  backendConfigured: true,
  loading: false,
  signedIn: true,
  mfaPending: false,
  actingAs: BI,
  cloudProjectOpen: false,
};

describe("buildCloudMenu", () => {
  it("is absent with no backend configured", () => {
    expect(buildCloudMenu({ ...base, backendConfigured: false })).toEqual({ kind: "absent" });
  });

  it("is absent until the session has loaded, rather than flashing the guest line", () => {
    expect(buildCloudMenu({ ...base, loading: true })).toEqual({ kind: "absent" });
  });

  it("offers a guest only the sign-in line", () => {
    expect(buildCloudMenu({ ...base, signedIn: false, actingAs: null })).toEqual({ kind: "sign-in-prompt", text: "Sign in to save projects to the cloud" });
    expect(SIGN_IN_PROMPT).toBe("Sign in to save projects to the cloud");
  });

  it("signed in with NO company: no cloud save, says why, and (3B) still offers Open from cloud for personal shares", () => {
    expect(buildCloudMenu({ ...base, actingAs: null })).toEqual({
      kind: "signed-in",
      heading: "Cloud",
      message: NO_COMPANY_MESSAGE,
      saveToCloud: false,
      saveAsNew: false,
      openFromCloud: true,
      versionHistory: false,
      sharing: false,
    });
    expect(NO_COMPANY_MESSAGE).toMatch(/aren't a member of any company/);
    expect(NO_COMPANY_MESSAGE).toMatch(/Save Project still downloads/);
  });

  it("a project still open after the membership went: Save to cloud stays, so the 403 and its download offer can show", () => {
    const menu = buildCloudMenu({ ...base, actingAs: null, cloudProjectOpen: true });
    expect(menu).toMatchObject({ saveToCloud: true, saveAsNew: false });
  });

  it("a member acting as their own company gets every 2B item under a heading naming it", () => {
    expect(buildCloudMenu(base)).toEqual({
      kind: "signed-in",
      heading: "Cloud · Building Integrity",
      message: null,
      saveToCloud: true,
      saveAsNew: true,
      openFromCloud: true,
      versionHistory: false,
      sharing: false,
    });
  });

  it("3B: Sharing… is offered only while a cloud project is open, whatever the switcher says, and never with two-factor pending", () => {
    expect(buildCloudMenu({ ...base, cloudProjectOpen: true })).toMatchObject({ sharing: true });
    expect(buildCloudMenu({ ...base, actingAs: RF_PLATFORM, cloudProjectOpen: true })).toMatchObject({ sharing: true });
    expect(buildCloudMenu({ ...base, actingAs: null, cloudProjectOpen: true })).toMatchObject({ sharing: true });
    expect(buildCloudMenu({ ...base, mfaPending: true, cloudProjectOpen: true })).toMatchObject({ sharing: false, openFromCloud: false });
  });

  it("2C: Version history is offered only while a cloud project is open, whatever the switcher says", () => {
    expect(buildCloudMenu({ ...base, cloudProjectOpen: true })).toMatchObject({ versionHistory: true });
    expect(buildCloudMenu({ ...base, actingAs: SEED_CONSORTIUM, cloudProjectOpen: true })).toMatchObject({ versionHistory: true });
    // Membership revoked mid-session: still offered, so its 404 can say so.
    expect(buildCloudMenu({ ...base, actingAs: null, cloudProjectOpen: true })).toMatchObject({ versionHistory: true });
    expect(buildCloudMenu({ ...base, mfaPending: true, cloudProjectOpen: true })).toMatchObject({ versionHistory: false });
    expect(buildCloudMenu({ ...base, signedIn: false, actingAs: null, cloudProjectOpen: true })).toEqual({ kind: "sign-in-prompt", text: SIGN_IN_PROMPT });
  });

  it("a platform admin acting as any company can create there", () => {
    expect(buildCloudMenu({ ...base, actingAs: RF_PLATFORM })).toMatchObject({ saveAsNew: true, heading: "Cloud · Rare Forms" });
  });

  it("3D: acting as Seed through the consortium can now create, while its folders still say Stage 4", () => {
    const menu = buildCloudMenu({ ...base, actingAs: SEED_CONSORTIUM });
    expect(menu).toMatchObject({ saveToCloud: true, saveAsNew: true, openFromCloud: true, heading: "Cloud · The Seed Collaborative" });
    // The message is now about LISTING only: creating is no longer refused,
    // and the folder tabs are deliberately unchanged (browsing is Stage 4).
    expect(menu.kind === "signed-in" && menu.message).toMatch(/folders open in a later stage/);
    expect(menu.kind === "signed-in" && menu.message).not.toMatch(/can't create/);
  });

  it("3E: the menu line does not say 'nothing to list here' above Open from cloud…, which lists Shared with us", () => {
    const menu = buildCloudMenu({ ...base, actingAs: SEED_CONSORTIUM });
    expect(menu).toMatchObject({ openFromCloud: true, message: consortiumMenuMessage("The Seed Collaborative") });
    expect(menu.kind === "signed-in" && menu.message).not.toMatch(/nothing to list/);
    // Still the folder tabs' own sentence in the tree; only the menu changed.
    expect(consortiumMenuMessage("X")).not.toBe(consortiumLaterStageMessage("X"));
  });

  it("acting as Seed with a Building Integrity project open still saves into that project", () => {
    expect(buildCloudMenu({ ...base, actingAs: SEED_CONSORTIUM, cloudProjectOpen: true })).toMatchObject({ saveToCloud: true, saveAsNew: true });
  });

  it("two-factor pending offers nothing and says to enter the code", () => {
    expect(buildCloudMenu({ ...base, mfaPending: true })).toMatchObject({ message: MFA_PENDING_MESSAGE, saveToCloud: false, saveAsNew: false, openFromCloud: false });
  });
});

describe("cloudStatusLines", () => {
  const ctx: CloudContext = {
    projectId: "p1",
    companyId: "bi",
    companyName: "Building Integrity",
    folder: "current",
    baseVersionId: "v7",
    baseVersionNumber: 7,
    baseCreatedAt: "2026-09-14T13:00:00+00:00",
    latestKnownVersionNumber: 7,
  };

  it("is empty with no cloud project open", () => {
    expect(cloudStatusLines(null, "Smith House", BI)).toEqual([]);
  });

  it("reads name · version · company › folder", () => {
    expect(cloudStatusLines(ctx, "Smith House", BI)).toEqual(["Smith House · v7 · Building Integrity › Current Projects"]);
  });

  it("shows an empty name as (untitled)", () => {
    expect(cloudStatusLines({ ...ctx, folder: "proposals" }, "  ", BI)[0]).toBe("(untitled) · v7 · Building Integrity › Proposals");
  });

  it("adds the mismatch line when acting as another company; saves still go to the project", () => {
    expect(cloudStatusLines(ctx, "Smith House", { companyId: "rf", companyName: "Rare Forms" })).toEqual([
      "Smith House · v7 · Building Integrity › Current Projects",
      "Owned by Building Integrity. You're acting as Rare Forms; saves still go to this project.",
    ]);
  });

  const byBob = [{ via: "person" as const, granteeName: "Rory", grantedByName: "Bob", createdAt: "2026-09-14T13:00:00+00:00" }];

  it("3B: a shared project says how it reached you, and that saves still go to it", () => {
    expect(cloudStatusLines(ctx, "Smith House", { companyId: "rf", companyName: "Rare Forms" }, byBob)).toEqual([
      "Smith House · v7 · Building Integrity › Current Projects",
      "Owned by Building Integrity · shared with you by Bob. You're acting as Rare Forms; saves still go to this project.",
    ]);
  });

  it("3B: an account with no membership still sees who owns it and how it reached them", () => {
    expect(cloudStatusLines(ctx, "Smith House", null, byBob)).toEqual([
      "Smith House · v7 · Building Integrity › Current Projects",
      "Owned by Building Integrity · shared with you by Bob.",
    ]);
    expect(cloudStatusLines(ctx, "Smith House", null)).toHaveLength(1);
  });

  it("3B: a blank owner name (the pre-3B collaborator bug) is a visible gap, not 'v7 ·  › Current Projects'", () => {
    expect(cloudStatusLines({ ...ctx, companyName: "" }, "Smith House", BI)[0]).toBe("Smith House · v7 · (owner name not available) › Current Projects");
  });
});

describe("relativeSaveTime", () => {
  const now = new Date("2026-09-14T15:00:00.000Z");
  it.each([
    ["2026-09-14T14:59:30+00:00", "just now"],
    ["2026-09-14T14:59:00+00:00", "1 minute ago"],
    ["2026-09-14T14:15:00.123456+00:00", "45 minutes ago"],
    ["2026-09-14T14:00:00Z", "1 hour ago"],
    ["2026-09-14T13:00:00Z", "2 hours ago"],
    ["2026-09-13T12:00:00Z", "yesterday"],
    ["2026-09-09T15:00:00Z", "5 days ago"],
  ])("%s reads %s", (createdAt, expected) => {
    expect(relativeSaveTime(createdAt, now)).toBe(expected);
  });

  it("falls back to a calendar date after a month", () => {
    expect(relativeSaveTime("2026-01-02T12:00:00Z", now)).toMatch(/2026/);
  });

  it("says a date the strict parser rejects is not recorded", () => {
    expect(relativeSaveTime("2026-09-14 13:00:00", now)).toBe("date not recorded");
  });
});

describe("absoluteSaveTime (2C: every history row says exactly when)", () => {
  it("prints the calendar date AND the time, never only 'ago'", () => {
    const text = absoluteSaveTime("2026-09-12T14:14:00.123456+00:00");
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
    expect(text).not.toMatch(/ago/);
  });

  it("says a date the strict parser rejects is not recorded, rather than substituting one", () => {
    expect(absoluteSaveTime("not a date")).toBe("date not recorded");
  });
});
