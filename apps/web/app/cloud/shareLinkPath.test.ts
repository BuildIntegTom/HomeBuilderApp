import { describe, expect, it } from "vitest";
import { shareLinkUrl, shareTokenFromPastedLink } from "./shareLinkPath";

/**
 * ⚠ This file must not import `auth/shareLinkToken.ts`.
 *
 * That module pulls in `node:crypto`, and the whole point of splitting these
 * two helpers out is that a CLIENT component can import them. A test that
 * reached for the token module would still pass while quietly proving nothing
 * about the constraint that made the split necessary.
 */

describe("shareLinkUrl", () => {
  it("builds /share/<token>", () => {
    expect(shareLinkUrl("https://strawpanels.com", "abc123")).toBe("https://strawpanels.com/share/abc123");
  });

  it("does not double the slash on an origin that has one", () => {
    expect(shareLinkUrl("https://strawpanels.com/", "abc123")).toBe("https://strawpanels.com/share/abc123");
  });

  it("escapes the token rather than trusting it in a path", () => {
    expect(shareLinkUrl("https://x.test", "a/b?c")).toBe("https://x.test/share/a%2Fb%3Fc");
  });

  it("round-trips with the parser", () => {
    const token = "Zm9vYmFyYmF6cXV1eGNvcmdlZ3JhdWx0Z2FyAAA";
    expect(shareTokenFromPastedLink(shareLinkUrl("http://localhost:3000", token))).toBe(token);
  });
});

describe("shareTokenFromPastedLink", () => {
  const token = "Zm9vYmFyYmF6cXV1eGNvcmdlZ3JhdWx0Z2FyAAA";

  it("takes a bare token, trimmed", () => {
    expect(shareTokenFromPastedLink(token)).toBe(token);
    expect(shareTokenFromPastedLink(`  ${token}  `)).toBe(token);
  });

  it("takes a whole pasted link, with or without a trailing slash", () => {
    expect(shareTokenFromPastedLink(`https://strawpanels.com/share/${token}`)).toBe(token);
    expect(shareTokenFromPastedLink(`https://strawpanels.com/share/${token}/`)).toBe(token);
  });

  it("⚠ accepts ANY origin, because the token is what identifies the link", () => {
    /* A link minted on strawpanels.com and opened on a preview deployment is
       the same link: the database stores a hash and never sees a host. */
    expect(shareTokenFromPastedLink(`http://localhost:3000/share/${token}`)).toBe(token);
    expect(shareTokenFromPastedLink(`https://fabricator-app.vercel.app/share/${token}`)).toBe(token);
  });

  it("⚠ is strict about the PATH, so another page's URL fails here", () => {
    /* Hashing whatever was pasted would show a `not_found` preview, telling
       somebody their link is dead when really they pasted the wrong thing. */
    expect(shareTokenFromPastedLink(`https://strawpanels.com/invite/${token}`)).toBeNull();
    expect(shareTokenFromPastedLink("https://strawpanels.com/")).toBeNull();
    expect(shareTokenFromPastedLink("https://strawpanels.com/share/")).toBeNull();
  });

  it("refuses empty, whitespace and obvious non-tokens", () => {
    for (const bad of ["", "   ", "hello there", "abc"]) {
      expect(shareTokenFromPastedLink(bad)).toBeNull();
    }
  });
});
