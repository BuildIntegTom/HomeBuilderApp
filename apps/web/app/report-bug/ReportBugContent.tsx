import Link from "next/link";
import styles from "./page.module.css";

const CONTACT_EMAIL = "tommy@buildinteg.com";

export interface ReportBugContentProps {
  /**
   * `"page"` is the route (its own `<h1>`, and both trailing links navigate).
   * `"note"` is the sticky note the editor's bug icon opens: the note header
   * already carries the heading, you are already in the editor, and the
   * Review Log is a note rather than a page from there.
   */
  variant: "page" | "note";
  /**
   * The name of the view the reporter is on, as the app itself labels it —
   * `viewLabels.ts`'s `currentViewLabel`. Note variant only.
   *
   * ⚠ THIS IS CONTEXT, NOT TELEMETRY. One line, naming one screen. No version
   * string, no user agent, no viewport figures, no project state, and nothing
   * is sent anywhere: the user still writes the email themselves. A report-bug
   * backend is a decided deferral (spec, §9a), not something to grow into
   * here.
   */
  currentViewName?: string;
  /** Note variant: opens the Review Log note instead of navigating to
   * `/?openNote=review-log`. The same surface the Review icon opens. */
  onOpenReviewLog?: () => void;
}

/**
 * The Report Bug / Request Feature content, extracted from `/report-bug`'s own
 * page so the editor's bug icon can open it as a sticky note **by reference**
 * (Tommy: "can we add a cute outline of a bug that opens up a sticky note with
 * the current page contents on it?").
 *
 * ⚠ EVERY WORD HERE IS THE ROUTE'S EXISTING WORDING, VERBATIM, including the
 * `mailto:` address, which was already in this file before this change. It is
 * not rewritten, tightened or "improved", and no address that was not already
 * here has been introduced. The only addition is the one context line above.
 *
 * WHY A NOTE AND NOT A NAVIGATION: same reason as Read Me — there is no
 * `localStorage`/`sessionStorage` anywhere in `apps/web/app`, so leaving the
 * editor loses an unsaved design, and this pass turns the link into an
 * always-visible icon. The route stays for direct links.
 */
export default function ReportBugContent({ variant, currentViewName, onOpenReviewLog }: ReportBugContentProps) {
  const reviewLogLabel = "Review Log — Items for Engineer/Contractor Review →";
  return (
    <div className={styles.content}>
      <div>
        {variant === "page" && <h1>Report Bug / Request Feature</h1>}
        <p>
          This app is being developed by Tommy Fieser of the Seed Collaborative and Building Integrity.
        </p>
      </div>

      <section>
        <h2>Found a bug or glitch?</h2>
        <p>
          Please send an email that includes:
          <br />
          1) how you got to the bug, and
          <br />
          2) what you would like to see instead.
        </p>
        <p className={styles.example}>
          <span className={styles.shout}>FOR EXAMPLE:</span> When I open the app on my phone, draw a rectangular
          wall plan, and then pan the screen, it leaves a repeated drawing of the wall plan and looks like an
          absolute mess. Make it so that the image renders correctly, not leaving a trail of images.
        </p>
      </section>

      <section>
        <h2>Have an idea for a feature?</h2>
        <p className={styles.shout}>Keep in mind: ANYTHING IS POSSIBLE with what this app does.</p>
        <p>
          Please tell me:
          <br />
          1) what the feature is, and
          <br />
          2) where it should be.
        </p>
        <p className={styles.example}>
          <span className={styles.shout}>FOR EXAMPLE:</span> On roof options, I want to see a fully panelized roof
          system that we can make on the table complete with 3D modeling and pre-engineered guesstimates at its
          deflection and load bearing capabilities. These roof panels should be 3&apos; wide and have options to be
          slideable. When applicable, they should land directly above wall seams.
        </p>
      </section>

      <section>
        {currentViewName && (
          <p className={styles.contextLine} data-current-view={currentViewName}>
            You opened this from: <span className={styles.shout}>{currentViewName}</span>
          </p>
        )}
        <p>Please include the date noticed/idea conceived and send to:</p>
        <p className={styles.emailLine}>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>

      <div>
        {variant === "page" && (
          <>
            <Link href="/">← Back to the layout editor</Link>
            <br />
            <Link href="/?openNote=review-log">{reviewLogLabel}</Link>
          </>
        )}
        {variant === "note" && (
          <button type="button" className={styles.reviewLogLink} onClick={onOpenReviewLog}>
            {reviewLogLabel}
          </button>
        )}
      </div>
    </div>
  );
}
