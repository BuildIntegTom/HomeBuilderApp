import Image from "next/image";
import styles from "./page.module.css";

const CONTACT_EMAIL = "tommy@buildinteg.com";
const VENMO_QR_IMAGE_PATH = "/venmo-qr.png";
const VENMO_QR_PDF_PATH = "/venmo-qr.pdf";

/**
 * The Read Me content, extracted from `/read-me`'s own page so the editor's
 * Read Me icon can open it as a sticky note **by reference** rather than as a
 * second copy of the words.
 *
 * WHY A NOTE AND NOT A NAVIGATION (spec, "Top Bar & Navigation
 * Reorganisation" §9b). There is no `localStorage` or `sessionStorage`
 * anywhere in `apps/web/app`, so navigating to `/read-me` and coming back
 * loses the whole unsaved design. That hazard already existed while the link
 * lived in the tray footer; promoting it to an always-visible icon in the
 * editor chrome makes it far easier to hit, so the icon opens this content in
 * place. The route stays exactly where it was, for direct links and printing.
 *
 * ⚠ THE LIABILITY STATEMENT IS VERBATIM. It is legal-posture text in the same
 * family as `roleDisclaimers`: it may be relocated, never reworded, never
 * re-wrapped to fit a narrower surface. Same for the contact address, which
 * was already in this file's original and is not a new one.
 *
 * The Venmo QR renders at its existing 240px (page.module.css `.qrImage`),
 * which fits inside a sticky note's 420px body at every viewport width the
 * note supports, and the "Open as PDF" link is still beside it — a QR too
 * small to scan would be a broken feature, so both paths are kept.
 */
export interface ReadMeContentProps {
  /**
   * `"page"` is the route, which owns its own `<h1>`. `"note"` is the sticky
   * note, whose own header already carries the same words — so the heading is
   * dropped there rather than printed twice. Nothing else differs; the words
   * are the same words either way.
   */
  variant: "page" | "note";
}

export default function ReadMeContent({ variant }: ReadMeContentProps) {
  return (
    <div className={styles.content}>
      <div>
        {variant === "page" && <h1>Read Me</h1>}
        <p>This software was created by Tommy Fieser of Building Integrity, who welcomes you to use it.</p>
        <p>I am using AI to translate my ideas into this super cool thing. Use responsibly!</p>
      </div>

      <section>
        <h2>Liability</h2>
        <p className={styles.shout}>
          Always keep in mind — anything coming from this app that you want to produce is your liability. I am not
          responsible for your project.
        </p>
      </section>

      <section>
        <h2>Support this tool</h2>
        <p>
          Creating and maintaining this app takes time and energy. If you feel so compelled to donate to this
          ever-changing, helpful, free-to-use tool, consider a donation with each project.
        </p>
        <div className={styles.donate}>
          <a href={VENMO_QR_PDF_PATH} target="_blank" rel="noopener noreferrer" className={styles.qrLink}>
            <Image src={VENMO_QR_IMAGE_PATH} alt="Venmo QR code for @Tommy-Fieser" width={1000} height={1294} className={styles.qrImage} />
          </a>
          <a href={VENMO_QR_PDF_PATH} target="_blank" rel="noopener noreferrer" className={styles.qrOpenLink}>
            Open as PDF ↗
          </a>
        </div>
      </section>

      <section>
        <p className={styles.shout}>Seriously, anything is possible.</p>
        <p>If you want something added to this app, please let me know at:</p>
        <p className={styles.emailLine}>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </div>
  );
}
