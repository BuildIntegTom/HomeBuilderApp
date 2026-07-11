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
export default function SheetTitleBlock({ title, description, role, children }: SheetTitleBlockProps) {
  const disclaimer = roleDisclaimers[role];
  const meta = useDocumentMeta();

  return (
    <article className={styles.sheet}>
      <div className={styles.content}>{children}</div>
      <div className={styles.titleBlock}>
        <div className={styles.metaZone}>
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
        <div className={styles.titleZone}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.description}>{description}</div>
        </div>
        <div className={styles.footerZone}>
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
