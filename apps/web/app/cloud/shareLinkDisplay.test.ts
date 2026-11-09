import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// The whole module, so the tests below can assert what it EXPORTS rather
// than what its source text happens to contain. See the note on
// EXPORT_NAMES.
import * as display from "./shareLinkDisplay";
import { UNTITLED_LABEL } from "./cloudTypes";
import {
  CLAIM_INVALID_MESSAGE,
  CLAIM_WRONG_EMAIL_MESSAGE,
  MINT_COPY_NOW_MESSAGE,
  PREVIEW_LOCKED_LINE,
  claimCountLabel,
  claimOutcomeMessage,
  linkStateLabel,
  previewExpiryLine,
  previewOfferLine,
  previewRefusalMessage,
  projectLabel,
} from "./shareLinkDisplay";

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("previewRefusalMessage", () => {
  it("names a revocation as somebody's decision, not a fault", () => {
    /* A visitor told "something went wrong" would reasonably retry, ask for
       help, and waste both their time and the owner's. The person who revoked
       it meant to. */
    const message = previewRefusalMessage("revoked");
    expect(message).toContain("turned off");
    expect(message).not.toMatch(/error|wrong|failed|invalid/i);
  });

  it("tells each reason apart", () => {
    const revoked = previewRefusalMessage("revoked");
    const expired = previewRefusalMessage("expired");
    const missing = previewRefusalMessage("not_found");
    expect(new Set([revoked, expired, missing]).size).toBe(3);
    expect(expired).toContain("expired");
  });

  it("⚠ answers not_found for anything it does not recognise", () => {
    /* Including null and a reason a future migration might add: a visitor must
       never get a blank explanation. */
    for (const reason of [null, "", "some_future_reason", "undefined"]) {
      expect(previewRefusalMessage(reason)).toBe(previewRefusalMessage("not_found"));
    }
  });

  it("⚠ never distinguishes 'no such link' from 'malformed'", () => {
    /* The database answers `not_found` for both, deliberately, so a token
       cannot be probed. Splitting them here would hand back the distinction
       the database refused to give. */
    expect(previewRefusalMessage("not_found")).toBe(previewRefusalMessage("nonsense"));
  });

  it("every refusal says what to do next", () => {
    for (const reason of ["revoked", "expired", "not_found"] as const) {
      expect(previewRefusalMessage(reason), reason).toMatch(/ask|check/i);
    }
  });
});

describe("previewOfferLine", () => {
  it("says VIEW ONLY when the link does not grant write", () => {
    const line = previewOfferLine("Rogers-Sehorn ADU", "Building Integrity", false);
    expect(line).toContain("Building Integrity");
    expect(line).toContain("Rogers-Sehorn ADU");
    expect(line).toContain("View only");
  });

  it("⚠ does NOT say view-only when the link grants write", () => {
    /* The honest label either way. Telling a collaborator they are view-only
       would have them report a bug the first time they tried to save. */
    const line = previewOfferLine("P", "C", true);
    expect(line).not.toMatch(/view only/i);
    expect(line).toContain("make changes");
  });
});

describe("previewExpiryLine", () => {
  it("gives both the count and the date", () => {
    /* The date is what somebody puts in a diary; the count is what makes
       urgency legible. One without the other is worse. */
    const line = previewExpiryLine("2026-11-18T12:00:00.000Z", NOW);
    expect(line).toContain("10 days");
    expect(line).toMatch(/November/);
  });

  it("says tomorrow in the singular", () => {
    const line = previewExpiryLine("2026-11-09T12:00:00.000Z", NOW);
    expect(line).toContain("tomorrow");
    expect(line).not.toContain("1 days");
  });

  it("is null when there is nothing useful to say", () => {
    expect(previewExpiryLine(null, NOW)).toBeNull();
    expect(previewExpiryLine("not a date", NOW)).toBeNull();
    // Already gone: the refusal path owns that message, not this line.
    expect(previewExpiryLine("2026-11-07T12:00:00.000Z", NOW)).toBeNull();
    expect(previewExpiryLine("2026-11-08T12:00:00.000Z", NOW)).toBeNull();
  });
});

describe("claimOutcomeMessage", () => {
  it("treats all three outcomes as success, because all three mean access", () => {
    for (const status of ["claimed", "already-claimed", "already-has-access"] as const) {
      const message = claimOutcomeMessage(status, "the ADU");
      expect(message, status).not.toMatch(/error|sorry|couldn't|failed/i);
      expect(message, status).toContain("the ADU");
    }
  });

  it("⚠ already-claimed is not apologised for", () => {
    /* They clicked an old link; the right thing to do with that is open the
       project, not tell them off. */
    expect(claimOutcomeMessage("already-claimed", "P")).toContain("already had access");
  });

  it("⚠ already-has-access does not assert WHICH route reached them", () => {
    /* A membership, a company grant and platform admin all land in this
       branch, so naming one would sometimes be wrong. */
    const message = claimOutcomeMessage("already-has-access", "P");
    expect(message).not.toMatch(/member of|admin|company grant/i);
    expect(message).toContain("your own account");
  });

  it("falls back to a name when the project has none", () => {
    expect(claimOutcomeMessage("claimed", null)).toContain("that design");
  });
});

describe("linkStateLabel", () => {
  const live = { isLive: true, revokedAt: null, expiresAt: "2026-12-08T12:00:00.000Z" };

  it("reads Live, Expired and Turned off", () => {
    expect(linkStateLabel(live, NOW)).toBe("Live");
    expect(linkStateLabel({ ...live, expiresAt: "2026-11-01T12:00:00.000Z", isLive: false }, NOW)).toBe("Expired");
    expect(linkStateLabel({ ...live, revokedAt: "2026-11-08T11:00:00.000Z", isLive: false }, NOW)).toBe("Turned off");
  });

  it("⚠ REVOKED wins over expired, because it is the decision somebody made", () => {
    /* A link that was turned off and then also lapsed should read as turned
       off: that is the fact the owner acted on, and "Expired" would make
       their own revocation invisible in the list. */
    const both = { isLive: false, revokedAt: "2026-11-02T12:00:00.000Z", expiresAt: "2026-11-03T12:00:00.000Z" };
    expect(linkStateLabel(both, NOW)).toBe("Turned off");
  });
});

describe("claimCountLabel", () => {
  it("counts in words, singular and plural", () => {
    expect(claimCountLabel([])).toBe("Nobody has opened it yet");
    expect(claimCountLabel([1])).toBe("1 person has opened it");
    expect(claimCountLabel([1, 2])).toBe("2 people have opened it");
  });
});

describe("the warnings that are not about failures", () => {
  it("⚠ MINT_COPY_NOW says the link is not recoverable, and what to do instead", () => {
    /* The token is stored only as a SHA-256, so the mint response is the one
       time the link exists outside the clipboard. Somebody who closes the
       panel expecting to find it later has lost it. */
    expect(MINT_COPY_NOW_MESSAGE).toMatch(/won't be shown again|isn't stored/i);
    expect(MINT_COPY_NOW_MESSAGE).toMatch(/make another/i);
  });

  it("PREVIEW_LOCKED_LINE does not name the address", () => {
    /* A link forwarded to the wrong person must not disclose whose link it
       is. The line says "one email address", never which. */
    expect(PREVIEW_LOCKED_LINE).not.toContain("@");
  });
});

describe("messages that must not promise a distinction the code cannot make", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "shareLinkDisplay.ts"), "utf8");

  /** ⚠ THE EXPORT SURFACE, not the source text.
   *
   * The first version of these two tests grepped the file for the forbidden
   * names and failed — on the doc comment that explains why those names are
   * deliberately absent. That is the second time in this stride a
   * source-substring assertion has caught prose instead of code (the other
   * was `requireCloudSession` in a route's own comment), and the lesson is
   * the same both times: assert the thing callers actually see.
   *
   * It is also a stricter test. A substring check would pass a file that
   * mentioned the name only in a comment — but equally would FAIL a file that
   * correctly documented the absence, which is what happened. Reading the
   * module's keys cannot be fooled either way. */
  const EXPORT_NAMES = Object.keys(display);

  it("⚠ there is no CLAIM_REVOKED_MESSAGE or CLAIM_EXPIRED_MESSAGE", () => {
    /* 0011 raises the SAME SQLSTATE 22023 for "not valid", "revoked" and
       "expired", and this codebase never forwards a database message — so the
       claim route cannot tell them apart. Exporting separate strings would
       imply it can, and the first person to need them would discover
       otherwise the hard way. The PREVIEW does distinguish all three, which is
       why nothing is lost. */
    expect(EXPORT_NAMES).not.toContain("CLAIM_REVOKED_MESSAGE");
    expect(EXPORT_NAMES).not.toContain("CLAIM_EXPIRED_MESSAGE");
    expect(CLAIM_INVALID_MESSAGE).toMatch(/isn't valid any more/);
    // And the absence is EXPLAINED, so the next reader does not just add them.
    expect(source).toMatch(/22023/);
  });

  it("⚠ the wrong-email message records WHY 42501 is not the two-factor refusal", () => {
    /* `claim_share_link` raises 42501 for both the aal check and a locked
       email. They are told apart upstream — requireCloudSession refuses an
       mfaPending session first — and that reasoning has to survive in the
       file, because a future route that skips that helper would make this
       message wrong and send somebody hunting an email problem that does not
       exist. */
    expect(source).toContain("requireCloudSession");
    expect(source).toMatch(/two-factor/i);
    expect(CLAIM_WRONG_EMAIL_MESSAGE).toMatch(/different email address/);
  });

  it("⚠ there is no CLAIM_TWO_FACTOR_MESSAGE on this path either", () => {
    /* It would be dead: the branch is unreachable from these routes. A string
       nothing can render is a claim about behaviour that is not true. */
    expect(EXPORT_NAMES).not.toContain("CLAIM_TWO_FACTOR_MESSAGE");
  });
});

describe("projectLabel — the empty-name trap", () => {
  it("⚠ an EMPTY name is (untitled), which `??` would have missed", () => {
    /* Found by driving `share_link_preview` against the real SQL: it came
       back with `project_name: ""` for a project with no saved version,
       because `projects.name` is system-maintained from the document. The
       page rendered an empty <h1> and "Building Integrity shared  with you."
       Nullish coalescing is the wrong operator for a column whose empty value
       is meaningful. */
    expect(projectLabel("")).toBe("(untitled)");
    expect(projectLabel("   ")).toBe("(untitled)");
    expect(projectLabel(null)).toBe("(untitled)");
    expect(projectLabel(undefined)).toBe("(untitled)");
    expect(projectLabel("Rogers-Sehorn ADU")).toBe("Rogers-Sehorn ADU");
  });

  it("uses the SAME phrase the rest of the app uses", () => {
    /* The project tree, the delete confirmations and the backup report all
       say `(untitled)`. One unnamed project should not be called three
       different things depending on the screen. */
    expect(projectLabel("")).toBe(UNTITLED_LABEL);
  });

  it("⚠ the offer line survives an unnamed project and an unreadable owner", () => {
    const line = previewOfferLine("", "", false);
    expect(line).toContain("(untitled)");
    expect(line).toContain("A company");
    // No double space where a name used to be.
    expect(line).not.toMatch(/ {2}/);
    expect(line).not.toMatch(/shared +with/);
  });

  it("the claim message says 'that design', not '(untitled)'", () => {
    /* Addressed to the person who just claimed it: "You now have access to
       (untitled)" reads like a fault. */
    expect(claimOutcomeMessage("claimed", "")).toContain("that design");
    expect(claimOutcomeMessage("claimed", "   ")).toContain("that design");
    expect(claimOutcomeMessage("claimed", null)).toContain("that design");
  });
});
