import { describe, expect, it } from "vitest";
import {
  PROPOSAL_ALREADY_ADOPTED_MESSAGE,
  PROPOSAL_NOT_A_MEMBER_MESSAGE,
  PROPOSAL_NOT_LIVE_MESSAGE,
  PROPOSAL_NOT_MIGRATED_MESSAGE,
  PROPOSAL_REFUSED_MESSAGE,
  PROPOSAL_SIGN_IN_MESSAGE,
  mapProposalDbError,
} from "./proposalRouteLogic";

/**
 * ⚠ **The error map is the only part of this file that can be wrong quietly.**
 * The four calls themselves are three lines each and fail loudly; this decides
 * what a person is told when the database says no, and 0014 reuses SQLSTATEs
 * across operations that mean different things.
 */

describe("⚠ unique_violation means two different things, and the OPERATION tells them apart", () => {
  it("on adopt it is somebody else having got there first", () => {
    const mapped = mapProposalDbError({ code: "23505" }, "adopt")!;
    expect(mapped.status).toBe(409);
    expect(mapped.message).toBe(PROPOSAL_ALREADY_ADOPTED_MESSAGE);
  });

  it("on submit it is a token collision, which is not the same sentence at all", () => {
    /* Astronomically unlikely on 256 bits, but telling a first-time sender
       "that has already been adopted" would be nonsense. */
    const mapped = mapProposalDbError({ code: "23505" }, "submit")!;
    expect(mapped.status).toBe(409);
    expect(mapped.message).toBe(PROPOSAL_REFUSED_MESSAGE);
    expect(mapped.message).not.toContain("adopted");
  });
});

describe("⚠ insufficient_privilege, likewise", () => {
  it("is 'not a member' only on adopt AND only when the message says so", () => {
    const mapped = mapProposalDbError({ code: "42501", message: "You are not a member of that company." }, "adopt")!;
    expect(mapped.status).toBe(403);
    expect(mapped.message).toBe(PROPOSAL_NOT_A_MEMBER_MESSAGE);
  });

  it("is 'sign in' when adopt refused for the OTHER reason sharing that code", () => {
    /* `adopt_proposal` raises the same SQLSTATE for a missing session. Keying
       only on the operation would tell a signed-out visitor they are not a
       member of a company they never named. */
    const mapped = mapProposalDbError({ code: "42501", message: "Sign in to adopt a proposal." }, "adopt")!;
    expect(mapped.message).toBe(PROPOSAL_SIGN_IN_MESSAGE);
  });

  it("is 'sign in' on read, whatever the message", () => {
    for (const code of ["42501", "28000"]) {
      const mapped = mapProposalDbError({ code, message: "member" }, "read")!;
      expect(mapped.status, code).toBe(403);
      expect(mapped.message, code).toBe(PROPOSAL_SIGN_IN_MESSAGE);
    }
  });
});

describe("⚠ the window where this code is deployed and 0014 is not", () => {
  it("says so, rather than failing as a generic 500", () => {
    /* `0014` is applied by hand, so there is a real window in which the route
       exists and the function does not. A generic 500 sends whoever is
       debugging it to the route instead of to the database. */
    for (const code of ["42883", "PGRST202"]) {
      const mapped = mapProposalDbError({ code, message: "could not find function" }, "submit")!;
      expect(mapped.status, code).toBe(503);
      expect(mapped.message, code).toBe(PROPOSAL_NOT_MIGRATED_MESSAGE);
    }
  });

  it("tells the sender their design is not the problem", () => {
    expect(PROPOSAL_NOT_MIGRATED_MESSAGE).toMatch(/nothing is wrong with your design/i);
  });
});

describe("the rest of the map", () => {
  it("no_data_found is a dead link, 404", () => {
    const mapped = mapProposalDbError({ code: "02000" }, "adopt")!;
    expect(mapped.status).toBe(404);
    expect(mapped.message).toBe(PROPOSAL_NOT_LIVE_MESSAGE);
  });

  it("check_violation is a design this app will not take, 400", () => {
    /* `refuse_unusable_proposal` — the trigger that was added because a design
       with no `state` key submitted happily and then could not be adopted. */
    const mapped = mapProposalDbError({ code: "23514" }, "submit")!;
    expect(mapped.status).toBe(400);
    expect(mapped.message).toBe(PROPOSAL_REFUSED_MESSAGE);
  });

  it("⚠ anything UNMAPPED returns null rather than a guess", () => {
    /* The caller then throws it as-is for the generic 500. Inventing a
       friendly sentence for an unknown SQLSTATE is how a real fault gets
       reported to somebody as if it were their mistake. */
    for (const code of [undefined, "", "XX000", "40001", "22001"]) {
      expect(mapProposalDbError({ code }, "submit"), String(code)).toBeNull();
    }
  });

  it("⚠ no database message is ever forwarded to a client", () => {
    const leaky = "duplicate key value violates unique constraint \"proposals_token_hash_key\"";
    for (const op of ["submit", "preview", "read", "adopt"] as const) {
      const mapped = mapProposalDbError({ code: "23505", message: leaky }, op);
      if (mapped) expect(mapped.message, op).not.toContain("constraint");
    }
  });
});
