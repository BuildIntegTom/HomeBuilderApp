import Link from "next/link";
import ReadMeContent from "./ReadMeContent";
import styles from "./page.module.css";

/**
 * The route is kept exactly as it was — direct links to it still work, and it
 * is still the printable version. Its content now lives in `ReadMeContent` so
 * the editor's Read Me icon opens the same words as a sticky note instead of
 * navigating away (which would lose an unsaved design; see ReadMeContent's own
 * comment).
 */
export default function ReadMePage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ReadMeContent variant="page" />
        <Link href="/">← Back to the layout editor</Link>
      </main>
    </div>
  );
}
