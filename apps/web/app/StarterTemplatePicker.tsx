"use client";

import { useMemo, useState } from "react";
import styles from "./StarterTemplatePicker.module.css";
import {
  STARTER_TEMPLATES,
  planOutlineLoopsFt,
  type StarterPlan,
  type StarterTemplate,
} from "./starterTemplates";

/**
 * **U3 — the eight tiles a stranger lands on.**
 *
 * > *"6 prefabs include ... or draw your own, log in OR (if logged in) open
 * > from cloud."* — Tommy, 2026-11-05
 *
 * ⚠ **It fills the canvas instead of the empty drawing surface**, rather than
 * sitting behind a menu. What it replaces is the words *"Click and drag to
 * draw the footprint"* on a blank stage — the one screen in this app that
 * asked a newcomer to already know what it wanted. Every tile here puts a
 * finished building in front of them in one click, which is the whole value:
 * *"Each tile is a real drawn design, not a parameter preset."*
 *
 * ⚠ **Draw your own is a tile, not an escape hatch in the corner.** Drawing
 * from scratch is a first-class choice and it is listed as one — he put it in
 * the same breath as the six.
 */

const PREVIEW_W = 168;
const PREVIEW_H = 104;
const PREVIEW_PAD = 10;

/**
 * The tile's picture: the real plan of the building that tile makes, scaled
 * to fit, outer ring filled and any courtyard knocked out of it.
 *
 * ⚠ **`fill-rule: evenodd` is what makes a courtyard a hole** rather than a
 * second solid shape drawn on top. One `<path>` with two subpaths, so the
 * ring reads as a ring at 168px the way it does at full size.
 */
function PlanPreview({ plan, title }: { plan: StarterPlan; title: string }) {
  const d = useMemo(() => {
    const loops = planOutlineLoopsFt(plan);
    if (loops.length === 0) return null;
    const xs = loops.flat().map((p) => p.x);
    const ys = loops.flat().map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    /* One scale for both axes — a plan squashed to fill its box would show a
       stranger the wrong proportions of a real building, which is the one
       thing this picture exists to get right. */
    const scale = Math.min((PREVIEW_W - 2 * PREVIEW_PAD) / (maxX - minX || 1), (PREVIEW_H - 2 * PREVIEW_PAD) / (maxY - minY || 1));
    const offX = (PREVIEW_W - (maxX - minX) * scale) / 2;
    const offY = (PREVIEW_H - (maxY - minY) * scale) / 2;
    return loops
      .map(
        (points) =>
          points
            .map((p, i) => `${i === 0 ? "M" : "L"}${(offX + (p.x - minX) * scale).toFixed(2)} ${(offY + (p.y - minY) * scale).toFixed(2)}`)
            .join(" ") + " Z",
      )
      .join(" ");
  }, [plan]);

  if (d === null) return <div className={styles.previewEmpty} aria-hidden="true" />;
  return (
    <svg className={styles.preview} viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} role="img" aria-label={`Plan of ${title}`}>
      <path d={d} fillRule="evenodd" className={styles.previewShape} />
    </svg>
  );
}

function TemplateTile({
  template,
  onPick,
}: {
  template: StarterTemplate;
  onPick: (plan: StarterPlan, name: string) => void;
}) {
  /* The octagon's own 16ft / 32ft. Local to the tile: picking a size is not a
     document edit and must not reach `ProjectState`. */
  const [optionId, setOptionId] = useState(template.options[0]!.id);
  const option = template.options.find((o) => o.id === optionId) ?? template.options[0]!;
  const hasSwitch = template.options.length > 1;

  return (
    <div className={styles.tile}>
      <button
        type="button"
        className={styles.tileButton}
        onClick={() => onPick(option.plan, template.name)}
        title={`Draw ${template.name} — ${option.label}`}
      >
        <PlanPreview plan={option.plan} title={template.name} />
        <span className={styles.tileName}>{template.name}</span>
        <span className={styles.tileDims}>{option.label}</span>
        <span className={styles.tileBlurb}>{template.blurb}</span>
      </button>
      {hasSwitch && (
        <div className={styles.optionRow} role="group" aria-label={`${template.name} size`}>
          {template.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={o.id === option.id ? styles.optionActive : styles.option}
              aria-pressed={o.id === option.id}
              onClick={() => setOptionId(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface StarterTemplatePickerProps {
  onPick: (plan: StarterPlan, name: string) => void;
  /** Dismisses the picker and leaves the blank canvas behind it. */
  onDrawYourOwn: () => void;
  /** Opens the cloud project list. Only called when `canOpenFromCloud`. */
  onOpenFromCloud: () => void;
  /** Opens the account control, the same way the Project menu's own sign-in
   * line does. Only called when `canOpenFromCloud` is false. */
  onSignIn: () => void;
  /**
   * ⚠ **`cloud.menu.openFromCloud`, not a bare "signed in"** — the Project
   * menu already derives this from the backend being configured, the session
   * loading, MFA still pending and who you are acting as, and the one tile
   * here must not answer that question a second way.
   *
   * ⚠ **The tile is shown either way, never hidden.** Signed out it reads
   * *Sign in to open a saved design* and opens the sign-in — which is the
   * honest label for what the click does. Hiding it instead would leave a
   * signed-out stranger believing this app has no cloud at all.
   */
  canOpenFromCloud: boolean;
  /**
   * ⚠ **Set when the picker is inside another scrolling surface** — which,
   * since 2026-11-08, is everywhere: Home is its only mount.
   *
   * Its `.root` was written to be the DIRECT child of `.editorCanvasLayer`,
   * so it takes the layer's full height and scrolls inside itself. That was a
   * recorded fix (centring something taller than its container put its box at
   * y = -128 and cut off the whole first row of tiles). Nested inside Home's
   * own scrolling column the same rule collapses it to nothing: measured in
   * the browser, the heading rendered and every tile was squeezed out of
   * sight. Embedded, it lets the parent do the scrolling.
   */
  embedded?: boolean;
}

export default function StarterTemplatePicker({
  onPick,
  onDrawYourOwn,
  onOpenFromCloud,
  onSignIn,
  canOpenFromCloud,
  embedded = false,
}: StarterTemplatePickerProps) {
  return (
    <div className={embedded ? styles.rootEmbedded : styles.root} data-starter-templates="">
      <h2 className={styles.heading}>Start with a building</h2>
      <p className={styles.sub}>
        Every tile below is a real drawn design — footprint, panels, openings and roof already on it. Pick one and
        change it; a template is a first draw, not a preset.
      </p>
      <div className={styles.grid}>
        {STARTER_TEMPLATES.map((template) => (
          <TemplateTile key={template.id} template={template} onPick={onPick} />
        ))}

        <div className={styles.tile}>
          <button type="button" className={styles.tileButton} onClick={onDrawYourOwn} title="Start from an empty plan">
            <div className={styles.previewEmpty} aria-hidden="true">
              <span className={styles.previewEmptyMark}>▭</span>
            </div>
            <span className={styles.tileName}>Draw your own</span>
            <span className={styles.tileDims}>Empty plan</span>
            <span className={styles.tileBlurb}>Rectangle or Octagon, then drag on the canvas.</span>
          </button>
        </div>

        <div className={styles.tile}>
          <button
            type="button"
            className={styles.tileButton}
            onClick={canOpenFromCloud ? onOpenFromCloud : onSignIn}
            title={canOpenFromCloud ? "Open a design you saved" : "Sign in — your saved designs come with you"}
          >
            <div className={styles.previewEmpty} aria-hidden="true">
              <span className={styles.previewEmptyMark}>☁</span>
            </div>
            <span className={styles.tileName}>{canOpenFromCloud ? "Open from cloud" : "Sign in to open a saved design"}</span>
            <span className={styles.tileDims}>{canOpenFromCloud ? "Your saved designs" : "Not signed in"}</span>
            <span className={styles.tileBlurb}>
              {canOpenFromCloud
                ? "Pick up a project you already started."
                : "Signing in brings your saved designs with you."}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
