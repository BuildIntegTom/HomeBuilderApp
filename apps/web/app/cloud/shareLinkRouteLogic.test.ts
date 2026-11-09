import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { PROJECT_NOT_FOUND_MESSAGE, ProjectRouteError } from "./projectRouteLogic";
import {
  CLAIM_INVALID_MESSAGE,
  CLAIM_NOT_SIGNED_IN_MESSAGE,
  CLAIM_UNATTRIBUTABLE_MESSAGE,
  CLAIM_WRONG_EMAIL_MESSAGE,
  LINKS_LIST_REFUSED_MESSAGE,
  MINT_EXPIRY_MESSAGE,
  MINT_REFUSED_MESSAGE,
  MINT_UNATTRIBUTABLE_MESSAGE,
  REVOKE_REFUSED_MESSAGE,
} from "./shareLinkDisplay";
import {
  MINT_EMAIL_INVALID_MESSAGE,
  TOKEN_REQUIRED_MESSAGE,
  claimShareLink,
  createShareLink,
  listShareLinks,
  mapShareLinkDbError,
  parseMintRequest,
  previewShareLink,
  requireToken,
  revokeShareLink,
  type ShareLinkOperation,
} from "./shareLinkRouteLogic";

// The same chainable stand-in sharingRouteLogic.test.ts uses.
interface Call {
  kind: "rpc" | "from";
  name: string;
  args?: unknown;
  ops: [string, unknown[]][];
  terminal?: string;
}
type Reply = { data?: unknown; error?: unknown };

function fakeDb(respond: (call: Call) => Reply) {
  const calls: Call[] = [];
  const builder = (call: Call): unknown => {
    const finish = (terminal?: string) => {
      call.terminal = terminal;
      calls.push(call);
      return Promise.resolve()
        .then(() => respond(call))
        .then((r) => ({ data: r.data ?? null, error: r.error ?? null }));
    };
    const chain: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => finish().then(resolve, reject);
          }
          if (prop === "single" || prop === "maybeSingle") return () => finish(prop);
          return (...args: unknown[]) => {
            call.ops.push([String(prop), args]);
            return chain;
          };
        },
      },
    );
    return chain;
  };
  const db = {
    rpc: (name: string, args: unknown) => builder({ kind: "rpc", name, args, ops: [] }),
    from: (name: string) => builder({ kind: "from", name, ops: [] }),
  };
  return { db: db as unknown as SupabaseClient, calls };
}

async function rejection(promise: Promise<unknown>): Promise<ProjectRouteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return error;
    throw error;
  }
  throw new Error("expected a ProjectRouteError");
}

const P1 = "5768ff5e-b9ff-4b18-bdcb-f9ccd9043b25";
const L1 = "7c9a1e22-1111-4b18-bdcb-f9ccd9043b25";
const G1 = "3ab41e22-2222-4b18-bdcb-f9ccd9043b25";
const HASH = "a".repeat(64);
const SOON = new Date("2026-12-08T12:00:00.000Z");

// ---------------------------------------------------------------------------

describe("createShareLink", () => {
  it("calls create_share_link with the hash and an ISO expiry", async () => {
    const { db, calls } = fakeDb(() => ({
      data: { link_id: L1, expires_at: SOON.toISOString(), locked_email: null, grants_write: false },
    }));
    const minted = await createShareLink(db, P1, HASH, SOON);
    expect(minted).toEqual({ linkId: L1, expiresAt: SOON.toISOString(), lockedEmail: null, grantsWrite: false });
    expect(calls[0].name).toBe("create_share_link");
    expect(calls[0].args).toEqual({
      p_project: P1,
      p_token_hash: HASH,
      p_expires_at: "2026-12-08T12:00:00.000Z",
      p_locked_email: null,
      p_grants_write: false,
    });
  });

  it("⚠ sends p_grants_write FALSE explicitly, never undefined", async () => {
    /* The column default is the guarantee, but a route that omitted the
       argument would be relying on PostgREST's argument handling — one
       library change away from sending `null` into a NOT NULL column, or from
       some refactor supplying `true`. View-only is the safe direction, so it
       is stated rather than left out. */
    const { db, calls } = fakeDb(() => ({
      data: { link_id: L1, expires_at: SOON.toISOString(), locked_email: null, grants_write: false },
    }));
    await createShareLink(db, P1, HASH, SOON, {});
    const args = calls[0].args as Record<string, unknown>;
    expect(args.p_grants_write).toBe(false);
    expect("p_grants_write" in args).toBe(true);
  });

  it("passes a lock and a write grant through when asked for them", async () => {
    const { db, calls } = fakeDb(() => ({
      data: { link_id: L1, expires_at: SOON.toISOString(), locked_email: "client@example.com", grants_write: true },
    }));
    const minted = await createShareLink(db, P1, HASH, SOON, { lockedEmail: "client@example.com", grantsWrite: true });
    expect((calls[0].args as Record<string, unknown>).p_locked_email).toBe("client@example.com");
    expect((calls[0].args as Record<string, unknown>).p_grants_write).toBe(true);
    expect(minted.grantsWrite).toBe(true);
  });

  it("⚠ a malformed project id is the same 404 as a project you cannot touch", async () => {
    /* So a project id cannot be probed by trying to mint a link for it: "no
       such project", "not yours" and "not a uuid" all answer alike. */
    const { db, calls } = fakeDb(() => ({ data: null }));
    const refusal = await rejection(createShareLink(db, "not-a-uuid", HASH, SOON));
    expect(refusal.status).toBe(404);
    expect(refusal.message).toBe(MINT_REFUSED_MESSAGE);
    // And it never reached the database.
    expect(calls).toHaveLength(0);
  });

  it("maps 42501 to the same 404", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501" } }));
    const refusal = await rejection(createShareLink(db, P1, HASH, SOON));
    expect(refusal.status).toBe(404);
    expect(refusal.message).toBe(MINT_REFUSED_MESSAGE);
  });

  it("maps 22023 to the expiry message and 23514 to the unattributable one", async () => {
    const expiry = await rejection(createShareLink(fakeDb(() => ({ error: { code: "22023" } })).db, P1, HASH, SOON));
    expect(expiry.status).toBe(400);
    expect(expiry.message).toBe(MINT_EXPIRY_MESSAGE);

    const noName = await rejection(createShareLink(fakeDb(() => ({ error: { code: "23514" } })).db, P1, HASH, SOON));
    expect(noName.status).toBe(409);
    expect(noName.message).toBe(MINT_UNATTRIBUTABLE_MESSAGE);
  });

  it("an empty answer is a refusal, not a link with undefined fields", async () => {
    const { db } = fakeDb(() => ({ data: null }));
    const refusal = await rejection(createShareLink(db, P1, HASH, SOON));
    expect(refusal.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe("listShareLinks", () => {
  const row = {
    link_id: L1,
    created_by_name: "Alice",
    created_by_you: true,
    created_at: "2026-11-08T10:00:00.000Z",
    expires_at: SOON.toISOString(),
    revoked_at: null,
    locked_email: null,
    grants_write: false,
    is_live: true,
    claims: [{ grant_id: G1, grantee_name: "Henry", can_write: false, claimed_at: "2026-11-08T11:00:00.000Z" }],
  };

  it("maps a row and its claims", async () => {
    const { db, calls } = fakeDb(() => ({ data: [row] }));
    const { links } = await listShareLinks(db, P1);
    expect(calls[0].name).toBe("project_share_links");
    expect(calls[0].args).toEqual({ p_project: P1 });
    expect(links).toHaveLength(1);
    expect(links[0].linkId).toBe(L1);
    expect(links[0].createdByYou).toBe(true);
    expect(links[0].isLive).toBe(true);
    expect(links[0].claims).toEqual([
      { grantId: G1, granteeName: "Henry", canWrite: false, claimedAt: "2026-11-08T11:00:00.000Z" },
    ]);
  });

  it("a link nobody has opened has an empty claims list, not null", async () => {
    const { db } = fakeDb(() => ({ data: [{ ...row, claims: null }] }));
    const { links } = await listShareLinks(db, P1);
    expect(links[0].claims).toEqual([]);
  });

  it("⚠ NEVER selects share_links directly", async () => {
    /* The table is read only through `project_share_links`, which is
       `security invoker` and therefore sits behind the table's own policy. A
       `.from("share_links")` would be a second, unpoliced read path. */
    const { db, calls } = fakeDb(() => ({ data: [row] }));
    await listShareLinks(db, P1);
    expect(calls.every((c) => c.kind === "rpc")).toBe(true);
    expect(calls.some((c) => c.name === "share_links")).toBe(false);
  });

  it("a refusal to list says RELOAD, not that the project is gone", async () => {
    /* The caller got here by opening a project they can read, so "that
       project doesn't exist" would be both wrong and alarming. */
    const { db } = fakeDb(() => ({ error: { code: "55555" } }));
    const refusal = await rejection(listShareLinks(db, P1));
    expect(refusal.status).toBe(403);
    expect(refusal.message).toBe(LINKS_LIST_REFUSED_MESSAGE);
  });

  it("a malformed project id is the project 404", async () => {
    const { db } = fakeDb(() => ({ data: [] }));
    const refusal = await rejection(listShareLinks(db, "nope"));
    expect(refusal.message).toBe(PROJECT_NOT_FOUND_MESSAGE);
  });
});

// ---------------------------------------------------------------------------

describe("revokeShareLink", () => {
  it("calls revoke_share_link and returns the stamp", async () => {
    const { db, calls } = fakeDb(() => ({ data: { link_id: L1, revoked_at: "2026-11-08T12:00:00.000Z" } }));
    const result = await revokeShareLink(db, L1);
    expect(calls[0].name).toBe("revoke_share_link");
    expect(calls[0].args).toEqual({ p_link: L1 });
    expect(result).toEqual({ linkId: L1, revokedAt: "2026-11-08T12:00:00.000Z" });
  });

  it("a link you cannot touch and a malformed id are the same 404", async () => {
    const bad = await rejection(revokeShareLink(fakeDb(() => ({ data: null })).db, "nope"));
    expect(bad.status).toBe(404);
    expect(bad.message).toBe(REVOKE_REFUSED_MESSAGE);

    const refused = await rejection(revokeShareLink(fakeDb(() => ({ error: { code: "42501" } })).db, L1));
    expect(refused.status).toBe(404);
    expect(refused.message).toBe(REVOKE_REFUSED_MESSAGE);
  });
});

// ---------------------------------------------------------------------------

describe("previewShareLink", () => {
  it("maps a live link", async () => {
    const { db, calls } = fakeDb(() => ({
      data: {
        valid: true,
        reason: null,
        project_name: "Rogers-Sehorn ADU",
        owner_company_name: "Building Integrity",
        shared_by_name: "Alice",
        locked_to_email: false,
        grants_write: false,
        expires_at: SOON.toISOString(),
      },
    }));
    const preview = await previewShareLink(db, HASH);
    expect(calls[0].name).toBe("share_link_preview");
    expect(calls[0].args).toEqual({ p_token_hash: HASH });
    expect(preview.valid).toBe(true);
    expect(preview.projectName).toBe("Rogers-Sehorn ADU");
    expect(preview.grantsWrite).toBe(false);
  });

  it("⚠ carries NO project id, at the type level and in fact", async () => {
    /* The whole point of `share_link_preview` being anon-executable is that
       what it returns is harmless to a stranger. An id would let somebody
       holding a stray URL start probing other endpoints with a real project
       id. The database does not return one; this asserts the app does not
       invent one. */
    const { db } = fakeDb(() => ({
      data: {
        valid: true,
        reason: null,
        project_name: "P",
        owner_company_name: "C",
        shared_by_name: "A",
        locked_to_email: false,
        grants_write: false,
        expires_at: SOON.toISOString(),
        // Even if the function were changed to return one, it is not mapped.
        project_id: P1,
      },
    }));
    const preview = await previewShareLink(db, HASH);
    expect(Object.keys(preview)).not.toContain("projectId");
    expect(JSON.stringify(preview)).not.toContain(P1);
  });

  it("⚠ lockedToEmail is a BOOLEAN — never the address", async () => {
    /* A link forwarded to the wrong person must not tell them whose link they
       hold; that would turn a stray URL into an email-address disclosure. */
    const { db } = fakeDb(() => ({
      data: {
        valid: true,
        reason: null,
        project_name: "P",
        owner_company_name: "C",
        shared_by_name: "A",
        locked_to_email: true,
        grants_write: false,
        expires_at: SOON.toISOString(),
      },
    }));
    const preview = await previewShareLink(db, HASH);
    expect(preview.lockedToEmail).toBe(true);
    expect(typeof preview.lockedToEmail).toBe("boolean");
    expect(JSON.stringify(preview)).not.toContain("@");
  });

  it("keeps each refusal reason, so the page can use its own words", async () => {
    for (const reason of ["not_found", "revoked", "expired"] as const) {
      const { db } = fakeDb(() => ({
        data: {
          valid: false,
          reason,
          project_name: reason === "not_found" ? null : "P",
          owner_company_name: null,
          shared_by_name: null,
          locked_to_email: null,
          grants_write: null,
          expires_at: null,
        },
      }));
      const preview = await previewShareLink(db, HASH);
      expect(preview.valid).toBe(false);
      expect(preview.reason).toBe(reason);
    }
  });

  it("⚠ a reason this code does not recognise becomes not_found, not a blank page", async () => {
    /* If 0011 ever grows a fourth reason, the landing page must still say
       something actionable rather than render an invalid link with no
       explanation. */
    const { db } = fakeDb(() => ({
      data: {
        valid: false,
        reason: "some_future_reason",
        project_name: "P",
        owner_company_name: "C",
        shared_by_name: "A",
        locked_to_email: false,
        grants_write: false,
        expires_at: null,
      },
    }));
    const preview = await previewShareLink(db, HASH);
    expect(preview.reason).toBe("not_found");
    expect(preview.valid).toBe(false);
  });

  it("no row at all is a dead end, not a 500", async () => {
    const { db } = fakeDb(() => ({ data: null }));
    const preview = await previewShareLink(db, HASH);
    expect(preview).toEqual({
      valid: false,
      reason: "not_found",
      projectName: null,
      ownerCompanyName: null,
      sharedByName: null,
      lockedToEmail: false,
      grantsWrite: false,
      expiresAt: null,
    });
  });

  it("a valid row never carries a reason", async () => {
    const { db } = fakeDb(() => ({
      data: {
        valid: true,
        reason: "revoked",
        project_name: "P",
        owner_company_name: "C",
        shared_by_name: "A",
        locked_to_email: false,
        grants_write: false,
        expires_at: SOON.toISOString(),
      },
    }));
    expect((await previewShareLink(db, HASH)).reason).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("claimShareLink", () => {
  it("relays each of the three outcomes", async () => {
    for (const status of ["claimed", "already-claimed", "already-has-access"] as const) {
      const { db, calls } = fakeDb(() => ({
        data: { status, project_id: P1, grant_id: status === "already-has-access" ? null : G1, can_write: false },
      }));
      const result = await claimShareLink(db, HASH);
      expect(calls[0].name).toBe("claim_share_link");
      expect(result.status).toBe(status);
      expect(result.projectId).toBe(P1);
    }
  });

  it("⚠ sends NO user id, so the route cannot claim on somebody else's behalf", async () => {
    /* `claim_share_link` reads auth.uid() itself, exactly as redeem_invite
       does. A user-id argument here would be the whole vulnerability. */
    const { db, calls } = fakeDb(() => ({ data: { status: "claimed", project_id: P1, grant_id: G1, can_write: false } }));
    await claimShareLink(db, HASH);
    expect(calls[0].args).toEqual({ p_token_hash: HASH });
    expect(JSON.stringify(calls[0].args)).not.toMatch(/user|uid|auth/i);
  });

  it("⚠ already-claimed reports the grant they HAD, not what this link offers", async () => {
    /* 0011 returns the existing grant's level on purpose: a view-only client
       later sent a writing link does not silently gain write, and a writing
       collaborator sent a view-only link does not silently lose it. This
       asserts the app relays that rather than echoing the link's own flag. */
    const { db } = fakeDb(() => ({ data: { status: "already-claimed", project_id: P1, grant_id: G1, can_write: true } }));
    const result = await claimShareLink(db, HASH);
    expect(result.canWrite).toBe(true);
    expect(result.grantId).toBe(G1);
  });

  it("⚠ an unrecognised status is a 500, NOT a cheerful default", async () => {
    /* The one thing this route must never do is tell somebody they have
       access when the database said something this code does not understand. */
    const { db } = fakeDb(() => ({ data: { status: "shrug", project_id: P1, grant_id: null, can_write: false } }));
    const refusal = await rejection(claimShareLink(db, HASH));
    expect(refusal.status).toBe(500);
  });

  it("22023 — invalid, revoked or expired — is one 410", async () => {
    const refusal = await rejection(claimShareLink(fakeDb(() => ({ error: { code: "22023" } })).db, HASH));
    expect(refusal.status).toBe(410);
    expect(refusal.message).toBe(CLAIM_INVALID_MESSAGE);
  });

  it("⚠ 42501 is the WRONG EMAIL, because two-factor is refused upstream", async () => {
    /* `claim_share_link` raises 42501 for both the aal check and the locked
       email, so they are indistinguishable by code. Every cloud route enters
       through requireCloudSession(), which refuses an mfaPending session with
       its own 401 first — so a 42501 reaching here is the email mismatch.
       ⚠ If a share-link route is ever added that skips requireCloudSession,
       this mapping becomes wrong and this comment is the trail back. */
    const refusal = await rejection(claimShareLink(fakeDb(() => ({ error: { code: "42501" } })).db, HASH));
    expect(refusal.status).toBe(403);
    expect(refusal.message).toBe(CLAIM_WRONG_EMAIL_MESSAGE);
  });

  it("28000 is the not-signed-in 401, and 23514 the unattributable 409", async () => {
    const anon = await rejection(claimShareLink(fakeDb(() => ({ error: { code: "28000" } })).db, HASH));
    expect(anon.status).toBe(401);
    expect(anon.message).toBe(CLAIM_NOT_SIGNED_IN_MESSAGE);

    const noName = await rejection(claimShareLink(fakeDb(() => ({ error: { code: "23514" } })).db, HASH));
    expect(noName.status).toBe(409);
    expect(noName.message).toBe(CLAIM_UNATTRIBUTABLE_MESSAGE);
  });
});

// ---------------------------------------------------------------------------

describe("mapShareLinkDbError", () => {
  it("forwards no database message, ever", () => {
    const operations: ShareLinkOperation[] = ["mint", "list", "revoke", "preview", "claim"];
    const secret = "relation public.share_links does not exist";
    for (const operation of operations) {
      for (const code of ["42501", "22023", "23514", "28000", "22P02", "PGRST116"]) {
        const mapped = mapShareLinkDbError({ code, message: secret }, operation);
        if (mapped) expect(mapped.message).not.toContain(secret);
      }
    }
  });

  it("leaves an unmapped code alone, for the generic 500", () => {
    expect(mapShareLinkDbError({ code: "40001" }, "claim")).toBeNull();
    expect(mapShareLinkDbError({}, "mint")).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("parseMintRequest", () => {
  it("defaults to no lock and NO WRITE", () => {
    /* ⚠ The second half is the one that matters: handing out edit rights by
       omission is the only mistake here that cannot be taken back once
       somebody has saved over the design. */
    expect(parseMintRequest({})).toEqual({ lockedEmail: null, grantsWrite: false });
    expect(parseMintRequest({ grantsWrite: "yes" })).toEqual({ lockedEmail: null, grantsWrite: false });
    expect(parseMintRequest({ grantsWrite: 1 })).toEqual({ lockedEmail: null, grantsWrite: false });
    expect(parseMintRequest({ grantsWrite: true }).grantsWrite).toBe(true);
  });

  it("lowercases and trims a lock", () => {
    expect(parseMintRequest({ lockedEmail: "  Client@Example.COM " }).lockedEmail).toBe("client@example.com");
  });

  it("treats blank as no lock", () => {
    expect(parseMintRequest({ lockedEmail: "   " }).lockedEmail).toBeNull();
    expect(parseMintRequest({ lockedEmail: "" }).lockedEmail).toBeNull();
    expect(parseMintRequest({ lockedEmail: null }).lockedEmail).toBeNull();
  });

  it("refuses something that is not an address at all", () => {
    for (const bad of ["henry", "a@", "@b", "a b@c", "a@b c"]) {
      expect(() => parseMintRequest({ lockedEmail: bad })).toThrow(MINT_EMAIL_INVALID_MESSAGE);
    }
    expect(() => parseMintRequest({ lockedEmail: 42 })).toThrow(MINT_EMAIL_INVALID_MESSAGE);
  });

  it("⚠ is deliberately loose about what an address looks like", () => {
    /* The real check is whether the claimant's own verified address matches,
       in the database. A stricter pattern here would only reject valid
       addresses the app has no business judging. */
    for (const ok of ["a+tag@example.co.uk", "o'brien@example.com", "x@[192.168.0.1]", "ünïcode@example.com"]) {
      expect(parseMintRequest({ lockedEmail: ok }).lockedEmail).toBe(ok.toLowerCase());
    }
  });
});

describe("requireToken", () => {
  it("takes a trimmed token", () => {
    expect(requireToken({ token: "  abc  " })).toBe("abc");
  });

  it("refuses missing, blank and non-strings", () => {
    for (const body of [{}, { token: "" }, { token: "   " }, { token: 42 }, { token: null }]) {
      expect(() => requireToken(body)).toThrow(TOKEN_REQUIRED_MESSAGE);
    }
  });
});

// ---------------------------------------------------------------------------

describe("the routes themselves", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const api = join(here, "..", "api");
  const read = (rel: string) => readFileSync(join(api, rel), "utf8");

  const GUARDED = [
    "projects/[id]/share-links/route.ts",
    "share-links/[id]/route.ts",
    "share-links/claim/route.ts",
  ];

  /** ⚠ Matches the CALL, not the word.
   *
   * The first version of this test asserted the source merely *contained*
   * "requireCloudSession", and it failed — on the preview route, whose doc
   * comment explains that it is the one route which does NOT go through it.
   * A substring test over source text cannot tell a call from prose about a
   * call, and here the prose was correct while the test was wrong. Worse, the
   * same looseness would have passed a route that imported the helper and
   * never called it, which is exactly the regression it exists to catch. */
  const CALLS_SESSION = /await requireCloudSession\(/;

  it("⚠ every share-link route except the preview CALLS requireCloudSession", () => {
    /* Load-bearing twice over. It is the authentication gate, and it is also
       what makes claim's 42501 unambiguously the locked-email mismatch rather
       than the two-factor refusal that shares the SQLSTATE. A new route that
       skipped it would silently break that mapping. */
    for (const file of GUARDED) {
      expect(read(file), `${file} must require a cloud session`).toMatch(CALLS_SESSION);
    }
  });

  it("⚠ no share-link route ever builds an admin client", () => {
    /* 0011's functions and the RLS policies are the access control. A
       service-role client walks past both — and `create_share_link` and
       `claim_share_link` are `security definer` precisely so that the caller
       does not need table rights, so an admin client would defeat the design
       rather than enable anything. */
    for (const file of [...GUARDED, "share-links/preview/route.ts"]) {
      expect(read(file), `${file} must not use the service role`).not.toContain("createSupabaseAdminClient");
      expect(read(file)).not.toContain("SERVICE_ROLE");
    }
  });

  it("⚠ the preview is the ONLY route without a session, and it is a POST", () => {
    const preview = read("share-links/preview/route.ts");
    expect(preview).not.toMatch(CALLS_SESSION);
    // A credential in a query string lands in access logs, Referer headers
    // and browser history. The body keeps it out of all three.
    expect(preview).toContain("export async function POST");
    expect(preview).not.toContain("export async function GET");
    expect(preview).not.toContain("searchParams");
  });

  it("⚠ the mint route returns the token but does NOT build a URL", () => {
    /* The server does not reliably know which host the person is looking at
       — a preview deployment, a custom domain and localhost are all
       legitimate — and a link built from the wrong origin is a dead end that
       looks like a database fault. */
    const mint = read("projects/[id]/share-links/route.ts");
    expect(mint).toContain("generateShareLinkToken");
    expect(mint).toContain("token");
    expect(mint).not.toContain("shareLinkUrl");
  });

  it("⚠ no route logs the token", () => {
    for (const file of [...GUARDED, "share-links/preview/route.ts"]) {
      const source = read(file);
      expect(source, `${file} must not log`).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
  });
});
