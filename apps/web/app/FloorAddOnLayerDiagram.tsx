import { floorAddOnLayerLayers } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C", "D"];

const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 630, y: 270, targetX: 210, targetY: 250 }, // A: perpendicular 2x4 strapping
  { x: 630, y: 230, targetX: 165, targetY: 250 }, // B: cellulose fill between the strapping
  { x: 630, y: 190, targetX: 320, targetY: 217 }, // C: sheathing (taped)
  { x: 630, y: 150, targetX: 320, targetY: 192 }, // D: splash-protection panel (taped)
];

/** Illustrative (not-to-scale) cross-section of the optional perpendicular
 * 2x4 add-on layer, shown in the context of what it sits between: the
 * primary floor joists below (dimmed, not part of this layer) and the
 * wall base plate / straw wall above. Cross-section view, so the
 * perpendicular strapping (running into the page relative to the primary
 * joists) reads as separated end-on blocks. Legend text is sourced
 * directly from `floorAddOnLayerLayers` (packages/panel-catalog) so the
 * wording stays single-sourced. */
export default function FloorAddOnLayerDiagram() {
  const stripX = [90, 190, 290, 390, 490];

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 680 340"
        style={{ width: "100%", maxWidth: 620, height: "auto" }}
        role="img"
        aria-label="Perpendicular 2x4 add-on layer cross-section diagram"
      >
        {/* Context: primary floor joists below (dimmed — not part of this layer) */}
        <rect x="60" y="270" width="520" height="40" fill="#c9c9c9" stroke="#999" />
        <text x="320" y="295" fontSize="11" fill="#666" textAnchor="middle">
          Primary floor joists (below, not part of this layer)
        </text>

        {/* Cellulose fill band, with the perpendicular 2x4 strips overlaid, leaving cellulose visible in the gaps */}
        <rect x="60" y="230" width="520" height="40" fill="#efe6c8" stroke="#cdbd8f" />
        {Array.from({ length: 12 }).map((_, i) => (
          <circle key={i} cx={75 + (i % 6) * 90} cy={i < 6 ? 240 : 258} r="2" fill="#cdbd8f" />
        ))}
        {stripX.map((x, i) => (
          <rect key={i} x={x} y="230" width="40" height="40" fill="#8a6a3a" stroke="#5c3a20" />
        ))}

        {/* Sheathing, taped at the seam */}
        <rect x="60" y="205" width="520" height="25" fill="#c9b483" stroke="#8a6a3a" />
        <line x1="320" y1="205" x2="320" y2="230" stroke="#8a6a3a" strokeWidth="1.5" />
        <rect x="312" y="205" width="16" height="25" fill="#d4a017" opacity="0.75" />

        {/* Splash-protection panel, taped at the seam */}
        <rect x="60" y="180" width="520" height="25" fill="#d9c9a3" stroke="#8a6a3a" />
        <line x1="320" y1="180" x2="320" y2="205" stroke="#8a6a3a" strokeWidth="1.5" />
        <rect x="312" y="180" width="16" height="25" fill="#d4a017" opacity="0.75" />

        {/* Context: wall base plate + straw wall above, with the added insulation layer at the junction highlighted */}
        <rect x="60" y="150" width="520" height="30" fill="#7a4a2b" stroke="#5c3a20" />
        <text x="320" y="169" fontSize="11" fill="#fff" textAnchor="middle">
          Wall base plate
        </text>
        <rect x="60" y="130" width="520" height="20" fill="#a9c9d9" stroke="#7fa8bc" />
        <rect x="60" y="60" width="520" height="70" fill="#e8dcc4" stroke="#cdbd8f" />
        <text x="320" y="100" fontSize="11" fill="#666" textAnchor="middle">
          Straw wall above — added insulation layer at this junction (highlighted band)
        </text>

        {BADGES.map((badge, i) => (
          <g key={BADGE_LETTERS[i]}>
            <line x1={badge.targetX} y1={badge.targetY} x2={badge.x - 12} y2={badge.y} stroke="#999" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx={badge.x} cy={badge.y} r="10" fill="#1c3d5a" />
            <text x={badge.x} y={badge.y + 4} fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle">
              {BADGE_LETTERS[i]}
            </text>
          </g>
        ))}
      </svg>

      <dl className={styles.legend}>
        {floorAddOnLayerLayers.map((layer, i) => (
          <div key={layer.id} className={styles.legendRow}>
            <dt className={styles.legendBadge}>{BADGE_LETTERS[i]}</dt>
            <dd className={styles.legendText}>
              <strong>{layer.label}.</strong> {layer.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
