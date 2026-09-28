import ReportBugContent from "./ReportBugContent";
import styles from "./page.module.css";

/**
 * The route is kept exactly as it was — its own links (including
 * `/?openNote=review-log`, which the editor still honours) still work. Its
 * content now lives in `ReportBugContent` so the editor's bug icon opens the
 * same words as a sticky note instead of navigating away, which would lose an
 * unsaved design. See ReportBugContent's own comment.
 */
export default function ReportBugPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ReportBugContent variant="page" />
      </main>
    </div>
  );
}
