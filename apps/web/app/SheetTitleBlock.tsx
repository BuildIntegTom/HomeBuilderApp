import type { ReactNode } from "react";
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
 * Shared print-sheet frame for every detail/shop-drawing page: a large
 * content area on the left, and a title-block strip on the right split
 * into 3 zones (logo, title+description, disclaimer/sign-off) — matching
 * the proportions of Tommy's title-block PDF template (Title Block.pdf).
 * Stacks vertically below ~700px instead of squeezing the strip unreadably
 * narrow.
 */
export default function SheetTitleBlock({ title, description, role, children }: SheetTitleBlockProps) {
  const disclaimer = roleDisclaimers[role];

  return (
    <article className={styles.sheet}>
      <div className={styles.content}>{children}</div>
      <div className={styles.titleBlock}>
        <div className={styles.logoZone}>
          <div className={styles.wordmark}>Building Integrity</div>
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
