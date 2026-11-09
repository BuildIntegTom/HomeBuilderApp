import { describe, expect, it } from "vitest";
import { hashInviteToken } from "./inviteToken";
import {
  SHARE_LINK_EXPIRY_DAYS,
  generateShareLinkToken,
  hashShareLinkToken,
  shareLinkExpiryFrom,
} from "./shareLinkToken";

describe("share-link tokens", () => {
  it("are 256 bits of base64url, and never repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const token = generateShareLinkToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      // 32 bytes base64url, unpadded.
      expect(token.length).toBe(43);
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });

  it("⚠ hash with the SAME function invites use", () => {
    /* Not an incidental equality — asserted so that a future edit which gives
       one of them a salt, a different encoding or a different digest fails
       here. The failure it prevents is silent: a link whose stored hash no
       longer matches its issued token previews as `not_found` forever, with
       nothing visibly wrong at either end. */
    const token = generateShareLinkToken();
    expect(hashShareLinkToken(token)).toBe(hashInviteToken(token));
    expect(hashShareLinkToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash the same token to the same digest, and different tokens apart", () => {
    const a = generateShareLinkToken();
    const b = generateShareLinkToken();
    expect(hashShareLinkToken(a)).toBe(hashShareLinkToken(a));
    expect(hashShareLinkToken(a)).not.toBe(hashShareLinkToken(b));
  });

  it("⚠ the raw token is not recoverable from the hash", () => {
    /* The whole security property of the table: `share_links` holds only the
       digest, so a company member reading the claims list, or anyone with a
       dump, cannot reconstruct a working link. This asserts the obvious so
       that storing the token itself would have to delete a test. */
    const token = generateShareLinkToken();
    const hash = hashShareLinkToken(token);
    expect(hash).not.toContain(token);
    expect(token).not.toContain(hash);
  });
});

describe("share-link expiry", () => {
  it("is 30 days, longer than an invite's fortnight", () => {
    expect(SHARE_LINK_EXPIRY_DAYS).toBe(30);
    const now = new Date("2026-11-08T12:00:00.000Z");
    expect(shareLinkExpiryFrom(now).toISOString()).toBe("2026-12-08T12:00:00.000Z");
  });

  it("is always in the future, which the database requires", () => {
    /* `create_share_link` raises 22023 on an expiry at or before now, so a
       default that could ever compute to the past would be a hard refusal
       rather than a long link. */
    const now = new Date("2026-11-08T12:00:00.000Z");
    expect(shareLinkExpiryFrom(now).getTime()).toBeGreaterThan(now.getTime());
    expect(shareLinkExpiryFrom(now, 1).getTime()).toBeGreaterThan(now.getTime());
  });
});

/* The URL helpers moved to `cloud/shareLinkPath.ts` so a client component can
   import them without dragging `node:crypto` into the bundle; their tests
   moved with them, to `cloud/shareLinkPath.test.ts`. Re-exported here, and
   asserted so the re-export cannot quietly disappear and break server
   imports. */
describe("the re-exported path helpers", () => {
  it("are the same functions cloud/shareLinkPath defines", async () => {
    const path = await import("../cloud/shareLinkPath");
    const token = await import("./shareLinkToken");
    expect(token.shareLinkUrl).toBe(path.shareLinkUrl);
    expect(token.shareTokenFromPastedLink).toBe(path.shareTokenFromPastedLink);
  });
});
