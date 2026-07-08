import type { ReactNode } from "react";
import type { FastenerSpacingRow } from "@building-integrity/panel-catalog";
import SheetTitleBlock from "./SheetTitleBlock";
import type { ViewerRole } from "./viewerRole";
import styles from "./DetailGuidePage.module.css";

export interface DetailGuidePageProps {
  title: string;
  triggerCondition: string;
  diagram: ReactNode;
  fastenerSchedule: FastenerSpacingRow[];
  fastenerScheduleNote?: string;
  notes: string[];
  role: ViewerRole;
}

/** Template for a printable construction Detail Guide page — diagram,
 * fastener schedule (omitted if empty), and notes in the main content
 * area, with the title/description/disclaimer living in the shared
 * title-block strip (SheetTitleBlock). Matches the format described in
 * building_integrity_app_spec.md's "Output & Documentation" section;
 * reused across all detail pages, not just foundations. */
export default function DetailGuidePage({
  title,
  triggerCondition,
  diagram,
  fastenerSchedule,
  fastenerScheduleNote,
  notes,
  role,
}: DetailGuidePageProps) {
  return (
    <SheetTitleBlock
      title={title}
      description={
        <>
          <strong>Applies when:</strong> {triggerCondition}
        </>
      }
      role={role}
    >
      <div className={styles.diagram}>{diagram}</div>

      {fastenerSchedule.length > 0 && (
        <div>
          <h4 className={styles.sectionHeading}>Fastener schedule</h4>
          <table className={styles.fastenerTable}>
            <thead>
              <tr>
                <th>Connection</th>
                <th>Fastener</th>
                <th>Spacing</th>
              </tr>
            </thead>
            <tbody>
              {fastenerSchedule.map((row) => (
                <tr key={row.connection}>
                  <td>{row.connection}</td>
                  <td>{row.fastener}</td>
                  <td>{row.spacing}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fastenerScheduleNote && <p className={styles.note}>{fastenerScheduleNote}</p>}
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <h4 className={styles.sectionHeading}>Notes</h4>
          <ul className={styles.notesList}>
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </SheetTitleBlock>
  );
}
