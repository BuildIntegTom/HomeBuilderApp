import { describe, expect, it } from "vitest";
import { proposalTokenFromPastedLink, proposalUrl } from "./proposalPath";
import { mapProposalDbError, PROPOSAL_ALREADY_ADOPTED_MESSAGE, PROPOSAL_NOT_A_MEMBER_MESSAGE, PROPOSAL_NOT_LIVE_MESSAGE, PROPOSAL_REFUSED_MESSAGE, PROPOSAL_SIGN_IN_MESSAGE } from "./proposalRouteLogic";

const TOKEN = "Ab3-_xyz0123456789abcdefghijklmnopqrstuvwxyz";

describe("proposalUrl", () => {
  it("builds the link a designer sends to a company", () => {
    expect(proposalUrl("https://strawpanels.com", TOKEN)).toBe(`https://strawpanels.com/proposal/${TOKEN}`);
  });

  it("does not double the slash on an origin that has one", () => {
    expect(proposalUrl("https://strawpanels.com/", TOKEN)).toBe(`https://strawpanels.com/proposal/${TOKEN}`);
  });
});

describe("⚠ proposalTokenFromPastedLink", () => {
  it("takes the token out of a pasted link, whatever the origin", () => {
    expect(proposalTokenFromPastedLink(`https://strawpanels.com/proposal/${TOKEN}`)).toBe(TOKEN);
    expect(proposalTokenFromPastedLink(`http://localhost:3000/proposal/${TOKEN}/`)).toBe(TOKEN);
    expect(proposalTokenFromPastedLink(`  https://preview.vercel.app/proposal/${TOKEN}  `)).toBe(TOKEN);
  });

  it("accepts a bare token, for somebody who was read it over the phone", () => {
    expect(proposalTokenFromPastedLink(TOKEN)).toBe(TOKEN);
  });

  /**
   * ⚠ **The one that matters.** All three token kinds are 43 characters of
   * base64url and are indistinguishable; only the path tells them apart.
   * Returning a share token from here would hash it against `proposals`, find
   * nothing, and tell somebody holding a perfectly good link that it was dead
   * — which is exactly the bug `shareTokenFromPastedLink` already carries a
   * guard against, one path along.
   */
  it("REFUSES a share link and an invite link rather than mistaking them for a proposal", () => {
    expect(proposalTokenFromPastedLink(`https://strawpanels.com/share/${TOKEN}`)).toBeNull();
    expect(proposalTokenFromPastedLink(`https://strawpanels.com/invite/${TOKEN}`)).toBeNull();
  });

  it("refuses anything else", () => {
    for (const text of ["", "   ", "https://strawpanels.com", "not a link", "https://example.com/proposal/"]) {
      expect({ text, token: proposalTokenFromPastedLink(text) }).toEqual({ text, token: null });
    }
  });
});

describe("⚠ mapProposalDbError — the database's words never reach a client", () => {
  it("maps a missing or expired proposal to one message, with no reason", () => {
    expect(mapProposalDbError({ code: "02000" }, "preview")?.message).toBe(PROPOSAL_NOT_LIVE_MESSAGE);
  });

  it("⚠ tells a unique_violation apart by OPERATION, because it means two things", () => {
    /* On adopt it is somebody else having got there first; on submit it is a
       token collision, which is a retry rather than a thing to explain. */
    expect(mapProposalDbError({ code: "23505" }, "adopt")?.message).toBe(PROPOSAL_ALREADY_ADOPTED_MESSAGE);
    expect(mapProposalDbError({ code: "23505" }, "submit")?.message).toBe(PROPOSAL_REFUSED_MESSAGE);
  });

  it("separates 'sign in' from 'not a member', which share one SQLSTATE", () => {
    expect(mapProposalDbError({ code: "42501", message: "Sign in to adopt a proposal." }, "adopt")?.message).toBe(
      PROPOSAL_SIGN_IN_MESSAGE,
    );
    expect(mapProposalDbError({ code: "42501", message: "You are not a member of that company." }, "adopt")?.message).toBe(
      PROPOSAL_NOT_A_MEMBER_MESSAGE,
    );
  });

  it("maps every refusal from the document trigger to one sentence", () => {
    expect(mapProposalDbError({ code: "23514" }, "submit")?.message).toBe(PROPOSAL_REFUSED_MESSAGE);
  });

  it("returns null for anything unmapped, so it surfaces as a 500 rather than as a wrong answer", () => {
    expect(mapProposalDbError({ code: "XX000", message: "boom" }, "submit")).toBeNull();
  });
});
