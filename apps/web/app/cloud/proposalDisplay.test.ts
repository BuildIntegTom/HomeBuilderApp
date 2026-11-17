import { describe, expect, it } from "vitest";
import {
  PROPOSAL_DEAD_MESSAGE,
  PROPOSAL_SENT_KEEP_IT,
  proposalAdoptedLine,
  proposalAlreadyTakenLine,
  proposalExpiryLine,
  proposalFromLine,
  proposalSentLine,
} from "./proposalDisplay";
import type { ProposalPreview } from "./proposalRouteLogic";

const live: ProposalPreview = {
  found: true,
  submitterName: "Jane Rogers",
  createdAt: "2026-11-10T09:00:00.000Z",
  expiresAt: "2027-02-08T09:00:00.000Z",
  adopted: false,
  adoptedAt: null,
  adoptedByCompanyName: null,
};

describe("who sent it", () => {
  it("names them when there is a name", () => {
    expect(proposalFromLine("Jane Rogers")).toBe("A design sent in by Jane Rogers.");
  });

  it("⚠ still says something when there is NOT", () => {
    /* The name is optional at submission, so this is the ordinary case and not
       an edge one. A page that renders nothing here reads as broken. */
    for (const empty of [null, "", "   "]) {
      expect(proposalFromLine(empty), String(empty)).toBe(
        "A design sent in by somebody without an account.",
      );
    }
  });
});

describe("the dates", () => {
  it("are days, not relative times", () => {
    /* ⚠ A relative time computed on the server disagrees with itself the
       moment the page sits open, and this is a page somebody leaves open. */
    const sent = proposalSentLine(live.createdAt)!;
    expect(sent.startsWith("Sent ")).toBe(true);
    expect(sent).not.toMatch(/ago|hour|minute/i);
    expect(proposalExpiryLine(live.expiresAt)).toMatch(/^This link lapses /);
  });

  it("render NOTHING rather than 'Invalid Date'", () => {
    for (const bad of [null, "", "not a date", "2026-13-45"]) {
      expect(proposalSentLine(bad), String(bad)).toBeNull();
      expect(proposalExpiryLine(bad), String(bad)).toBeNull();
    }
  });
});

describe("⚠ an adopted proposal is an ANSWER, not a refusal", () => {
  it("says nothing at all while it is unadopted", () => {
    expect(proposalAdoptedLine(live)).toBeNull();
  });

  it("names the company and the day to the sender", () => {
    const taken = {
      ...live,
      adopted: true,
      adoptedAt: "2026-11-12T10:00:00.000Z",
      adoptedByCompanyName: "Building Integrity",
    };
    const line = proposalAdoptedLine(taken)!;
    expect(line).toContain("Building Integrity has taken this proposal up");
    expect(line).toMatch(/2026/);
  });

  it("still answers when the company name did not come back", () => {
    const taken = { ...live, adopted: true, adoptedAt: null, adoptedByCompanyName: null };
    expect(proposalAdoptedLine(taken)).toBe("This proposal has been taken up.");
  });

  it("⚠ does not tell the READER they were too late — they may be the adopter", () => {
    const line = proposalAlreadyTakenLine("Building Integrity");
    expect(line).toContain("Building Integrity adopted this proposal");
    expect(line).not.toMatch(/too late|somebody else|beat you/i);
  });
});

describe("⚠ the words that have to carry a real consequence", () => {
  it("the dead-link line gives ONE reason for two causes", () => {
    /* Expired and never-existed must be indistinguishable, or the page
       becomes a token oracle. */
    expect(PROPOSAL_DEAD_MESSAGE).toContain("mistyped");
    expect(PROPOSAL_DEAD_MESSAGE).toContain("expired");
    expect(PROPOSAL_DEAD_MESSAGE).not.toMatch(/no such|not found|revoked/i);
  });

  it("the sender is told the link is the only copy", () => {
    /* The raw token is in the URL and nowhere else: the database holds only
       its hash, and the sender has no account to find it from. */
    expect(PROPOSAL_SENT_KEEP_IT).toMatch(/only way back/i);
    expect(PROPOSAL_SENT_KEEP_IT).toMatch(/no account/i);
  });
});
