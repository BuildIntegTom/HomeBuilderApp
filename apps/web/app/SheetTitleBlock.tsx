import type { ReactNode } from "react";
import { useDocumentMeta } from "./DocumentMetaContext";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import styles from "./SheetTitleBlock.module.css";

export interface SheetTitleBlockProps {
  title: string;
  description: ReactNode;
  role: ViewerRole;
  /** Main drawing/content area — everything left of the title-block strip. */
  children: ReactNode;
  /** A small reference diagram/thumbnail shown in its own zone at the TOP
   * of the right-hand title-block strip (Tommy: "squeeze it... into the top
   * big part of the side panel on the right, so the large center area has
   * lots of room for tables") — undefined (every non-shop-drawing caller)
   * renders the title block exactly as before, no new zone. Callers that
   * pass this should shrink their own diagram to fit (~230-250px wide) —
   * this prop just provides the slot, not any scaling. */
  sideDiagram?: ReactNode;
}

/**
 * Shared print-sheet frame for every detail/shop-drawing page — a genuine
 * landscape sheet (Tommy: "remake the title block blank page to be
 * landscape, a black line all the way around the outside, and title block
 * stuff on the right side") matching Title Block.pdf's proportions: a full
 * black outer frame, a large content area on the left, and a right-hand
 * strip subdivided into explicit fields (project/site/date/sheet number,
 * title+description, disclaimer/sign-off) instead of the old 3 generic
 * zones. Project/site/date/sheet-number come from DocumentMetaContext
 * (see that file's doc comment for why — too many call sites to prop-drill).
 */
export default function SheetTitleBlock({ title, description, role, children, sideDiagram }: SheetTitleBlockProps) {
  const disclaimer = roleDisclaimers[role];
  const meta = useDocumentMeta();

  return (
    <article className={styles.sheet}>
      <div className={styles.content}>{children}</div>
      <div className={styles.titleBlock}>
        {sideDiagram && <div className={styles.diagramZone}>{sideDiagram}</div>}
        <div className={sideDiagram ? `${styles.metaZone} ${styles.metaZoneCompact}` : styles.metaZone}>
          <div className={styles.wordmark}>Building Integrity</div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Project</span>
            <span className={styles.metaValue}>{meta.projectName}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Site</span>
            <span className={styles.metaValue}>{meta.siteLabel}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Date</span>
            <span className={styles.metaValue}>{meta.date}</span>
          </div>
          {meta.sheetNumber !== undefined && meta.sheetCount !== undefined && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Sheet</span>
              <span className={styles.metaValue}>
                {meta.sheetNumber} of {meta.sheetCount}
              </span>
            </div>
          )}
        </div>
        <div className={sideDiagram ? `${styles.titleZone} ${styles.titleZoneCompact}` : styles.titleZone}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.description}>{description}</div>
        </div>
        <div className={sideDiagram ? `${styles.footerZone} ${styles.footerZoneCompact}` : styles.footerZone}>
          <p className={styles.disclaimer}>
            <span className={styles.roleTag}>{disclaimer.label}</span> {disclaimer.text}
          </p>
          {role !== "public" && (
            <p className={styles.signoff}>
              Prepared by: _______________
              <br />
              Engineer stamp: _______________
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
