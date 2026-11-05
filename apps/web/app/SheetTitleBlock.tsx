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
  /**
   * ⚠ **B25's colour coding — a tinted title zone and a type swatch, and it
   * costs the sheet NO height.**
   *
   * > *"can we do a little bit of color coding for the different panel types
   * > incorporated into the fabrication sheets"* — Tommy, 2026-11-03
   *
   * It goes here, on the strip that already carries the sheet's name, rather
   * than as a banner above the cut list, because a fabrication sheet comes in
   * UNDER a letter page by only ~12-22px in the tightest measured case (see
   * this file's print block) and goes over as soon as one plaster coat is
   * selected. A ~24px banner would have put common sheets onto a second page
   * — the exact bug Tommy reported — to say something the title zone can say
   * for free.
   *
   * `color` is the type's own plan/legend/right-click colour from
   * `panelColors.ts`; the zone's fill is that colour tinted towards white so
   * black text still holds better than 7:1, in colour and printed in
   * greyscale (measured per type in `panelSheetIdentity.test.ts`). Undefined
   * on every non-panel caller, which renders exactly as before.
   */
  accent?: { color: string; tint: string; label: string };
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
export default function SheetTitleBlock({ title, description, role, children, sideDiagram, accent }: SheetTitleBlockProps) {
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
        <div
          className={sideDiagram ? `${styles.titleZone} ${styles.titleZoneCompact}` : styles.titleZone}
          style={accent ? { background: accent.tint } : undefined}
        >
          {accent && (
            /* The full-strength colour is carried by the swatch, not by the
               fill: at full strength the braced purple and the corner brown
               both fail black text (measured in `panelSheetIdentity.test.ts`). */
            <div className={styles.accentRow}>
              <span className={styles.accentSwatch} style={{ background: accent.color }} aria-hidden="true" />
              <span className={styles.accentLabel}>{accent.label}</span>
            </div>
          )}
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
