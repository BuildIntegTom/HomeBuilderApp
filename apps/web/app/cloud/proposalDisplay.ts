import type { ProposalPreview } from "./proposalRouteLogic";

/**
 * The WORDS a proposal link's landing page says, separated from the page that
 * says them — the same split `shareLinkDisplay.ts` makes, and for the same
 * reason: a sentence that decides whether somebody understands what they have
 * been sent is worth testing, and a React page is an awkward place to test a
 * sentence.
 *
 * ⚠ **Nothing here may name the design.** `proposal_preview` does not return
 * it, so this file could not leak it even by trying — but the rule is worth
 * writing down beside the words rather than only in the migration, because
 * this is the file somebody edits when they want the page to say more.
 */

/** What a dead or unknown proposal link says. ⚠ ONE sentence for "no such
 *  proposal" and for "expired", because the database gives one answer for
 *  both: a caller probing tokens learns only whether a live one exists. */
export const PROPOSAL_DEAD_MESSAGE =
  "This proposal link isn't live. It may have been mistyped, or it may have expired.";

/** The reassurance under it. The editor is open to everybody, which is both
 *  true and the thing a confused visitor most needs to hear. */
export const PROPOSAL_DEAD_REASSURANCE =
  "Nothing is lost — the editor is open to everyone, signed in or not. You can draw a building of your own right now.";

/** Who sent it, when there is a name. */
export function proposalFromLine(submitterName: string | null): string {
  const name = submitterName?.trim();
  return name ? `A design sent in by ${name}.` : "A design sent in by somebody without an account.";
}

/**
 * ⚠ **A date, not "3 days ago".** A relative time computed on the server and
 * rendered on the client disagrees with itself the moment the page sits open,
 * and this page is one somebody leaves open while they go and ask a colleague
 * whether to take the job.
 */
export function proposalSentLine(createdAt: string | null): string | null {
  const when = formatDay(createdAt);
  return when ? `Sent ${when}.` : null;
}

/** When the link lapses, for the company deciding whether to hurry. */
export function proposalExpiryLine(expiresAt: string | null): string | null {
  const when = formatDay(expiresAt);
  return when ? `This link lapses ${when}.` : null;
}

/**
 * ⚠ **What an ALREADY-ADOPTED proposal says, and why the page still works.**
 *
 * An adopted proposal stays previewable on purpose: the sender following their
 * own link to see what happened to their design is the main reason the preview
 * exists. So this is an answer, not a refusal, and it names the company —
 * which is the one thing the sender actually wants to know.
 */
export function proposalAdoptedLine(preview: ProposalPreview): string | null {
  if (!preview.adopted) return null;
  const company = preview.adoptedByCompanyName?.trim();
  const when = formatDay(preview.adoptedAt);
  const who = company ? `${company} has taken this proposal up` : "This proposal has been taken up";
  return when ? `${who}, ${when}.` : `${who}.`;
}

/**
 * The line on the ADOPTER's side of the same fact — shown to a signed-in
 * company looking at a proposal somebody else already took.
 *
 * ⚠ Deliberately NOT "you are too late": the reader may be the company that
 * adopted it, opening their own link again. It states what happened and lets
 * the reader place themselves in it.
 */
export function proposalAlreadyTakenLine(adoptedByCompanyName: string | null): string {
  const company = adoptedByCompanyName?.trim();
  return company
    ? `${company} adopted this proposal. A proposal can only be taken up once, so there is nothing to adopt here now.`
    : "This proposal has already been adopted. A proposal can only be taken up once, so there is nothing to adopt here now.";
}

/** What the sender is told once their link exists. */
export const PROPOSAL_SENT_HEADLINE = "Your design has a link";
export const PROPOSAL_SENT_INSTRUCTION =
  "Send this link to Building Integrity however you like — email, text, read it out. Nothing is sent anywhere until you do.";

/**
 * ⚠ **KEEP THE LINK, because there is no second copy.** The raw token exists
 * in this URL and nowhere else — the database stores only its hash — so a
 * visitor who closes the page without copying it has no way back to their own
 * proposal. The same property invites and share links have, said out loud
 * here because this is the only one of the three whose owner has no account to
 * find it from.
 */
export const PROPOSAL_SENT_KEEP_IT =
  "Keep this link. It is the only way back to this proposal — there is no account it can be looked up from.";

/**
 * A day, in the one format this app uses for dates somebody reads rather than
 * measures. `null` for anything unparseable, so a caller renders nothing
 * rather than "Invalid Date".
 */
function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
