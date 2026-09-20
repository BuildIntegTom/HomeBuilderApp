import { describe, expect, it } from "vitest";
import { isNotifiable, shareNoticeCheckDecision, type NoticeAudience } from "./shareNoticeCheck";

const M = "bbbbbbbb-0000-0000-0000-000000000001";
const R = "f1f1f1f1-0000-0000-0000-000000000001";

const signedIn = (userId: string): NoticeAudience => ({ userId, mfaPending: false });
const pending = (userId: string): NoticeAudience => ({ userId, mfaPending: true });
const guest: NoticeAudience = { userId: null, mfaPending: false };

describe("who is never notified", () => {
  it("never notifies a guest", () => {
    expect(isNotifiable(guest)).toBe(false);
    expect(shareNoticeCheckDecision(null, guest)).toBe("clear");
  });

  it("never notifies an account whose two-factor is still pending", () => {
    expect(isNotifiable(pending(R))).toBe(false);
    expect(shareNoticeCheckDecision(null, pending(R))).toBe("clear");
  });

  it("notifies an ordinary signed-in account", () => {
    expect(isNotifiable(signedIn(R))).toBe(true);
  });

  it("clears rather than leaves news on screen when the person signs out", () => {
    expect(shareNoticeCheckDecision(signedIn(R), guest)).toBe("clear");
  });

  it("clears when a second factor becomes pending mid-session", () => {
    expect(shareNoticeCheckDecision(signedIn(R), pending(R))).toBe("clear");
  });
});

describe("when the check runs", () => {
  it("runs at page load, on the first session answer naming a signed-in person", () => {
    expect(shareNoticeCheckDecision(null, signedIn(R))).toBe("check");
  });

  it("runs at sign-in, when a user id appears where there was none", () => {
    expect(shareNoticeCheckDecision(guest, signedIn(R))).toBe("check");
  });

  it("runs when a DIFFERENT account signs in", () => {
    expect(shareNoticeCheckDecision(signedIn(M), signedIn(R))).toBe("check");
  });

  it("runs once the second factor is completed, which is when the database starts answering", () => {
    expect(shareNoticeCheckDecision(pending(R), signedIn(R))).toBe("check");
  });
});

describe("when the check does NOT run — no polling, and no request per refresh", () => {
  it("does not re-check on a session refresh that names the same person", () => {
    expect(shareNoticeCheckDecision(signedIn(R), signedIn(R))).toBe("none");
  });

  it("does not re-check for a guest who is still a guest", () => {
    // Still `clear`, never `check`: there is nobody to ask about.
    expect(shareNoticeCheckDecision(guest, guest)).toBe("clear");
  });

  it("cannot re-check on an acting-as change, because acting-as is not an input", () => {
    // pending_share_notices() takes no acting-as parameter: it answers from
    // personal grants and memberships. Switching company therefore cannot
    // change the answer, and the editor re-reads the session on every switch.
    // Two audiences for one person are indistinguishable here BY DESIGN.
    const beforeSwitch: NoticeAudience = { userId: R, mfaPending: false };
    const afterSwitch: NoticeAudience = { userId: R, mfaPending: false };
    expect(shareNoticeCheckDecision(beforeSwitch, afterSwitch)).toBe("none");
    expect(Object.keys(afterSwitch).sort()).toEqual(["mfaPending", "userId"]);
  });

  it("makes exactly one check across a load, two refreshes and a company switch", () => {
    const steps: NoticeAudience[] = [signedIn(R), signedIn(R), signedIn(R), signedIn(R)];
    let previous: NoticeAudience | null = null;
    const decisions = steps.map((next) => {
      const decision = shareNoticeCheckDecision(previous, next);
      previous = next;
      return decision;
    });
    expect(decisions).toEqual(["check", "none", "none", "none"]);
  });

  it("checks again for the next account, and only once for it", () => {
    let previous: NoticeAudience | null = null;
    const decisions = [signedIn(M), signedIn(M), guest, signedIn(R), signedIn(R)].map((next) => {
      const decision = shareNoticeCheckDecision(previous, next);
      previous = next;
      return decision;
    });
    expect(decisions).toEqual(["check", "none", "clear", "check", "none"]);
  });
});
