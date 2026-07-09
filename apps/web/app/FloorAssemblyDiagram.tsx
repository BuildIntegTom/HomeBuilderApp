import { floorAssemblyLayers } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

// Callout badge positions (hand-placed to land near each layer's element in
// the schematic below), 1:1 with floorAssemblyLayers, in the same
// bottom-to-top order — badge column runs bottom (A, sill) to top (G, gap
// sealing) to mirror the physical stack.
const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 630, y: 320, targetX: 320, targetY: 320 }, // A: pressure-treated sill/rim
  { x: 630, y: 283, targetX: 320, targetY: 297 }, // B: wire mesh
  { x: 630, y: 247, targetX: 551, targetY: 207 }, // C: wood fiber board (rim liner)
  { x: 630, y: 210, targetX: 320, targetY: 207 }, // D: cellulose fill
  { x: 630, y: 173, targetX: 320, targetY: 105 }, // E: OSB deck
  { x: 630, y: 137, targetX: 320, targetY: 105 }, // F: air sealing tape (at the deck seam)
  { x: 630, y: 100, targetX: 551, targetY: 105 }, // G: gap sealing (corner callout)
];

/** Illustrative (not-to-scale) cross-section of the full suspended-floor
 * assembly, bottom to top, as a single joist bay cut across its width:
 * pressure-treated sill/rim -> wire mesh -> wood fiber rim liner ->
 * cellulose fill -> OSB deck -> air-sealing tape at the seam -> gap
 * sealing at a corner. Legend text is sourced directly from
 * `floorAssemblyLayers` (packages/panel-catalog) so the wording stays
 * single-sourced. */
export default function FloorAssemblyDiagram() {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 680 360"
        style={{ width: "100%", maxWidth: 620, height: "auto" }}
        role="img"
        aria-label="Full suspended floor assembly cross-section diagram"
      >
        {/* Pressure-treated sill/rim (bottom-most framing member) */}
        <rect x="80" y="300" width="480" height="40" fill="#7d8b5e" stroke="#5c6640" />

        {/* Wire mesh — thin hatched band just above the sill */}
        <rect x="80" y="294" width="480" height="6" fill="#cfcfcf" stroke="#888" strokeDasharray="3 2" />
        {Array.from({ length: 23 }).map((_, i) => (
          <line key={i} x1={84 + i * 21} y1="294" x2={84 + i * 21 + 8} y2="300" stroke="#888" strokeWidth="0.75" />
        ))}

        {/* Wood fiber board — vertical liners against each rim face */}
        <rect x="80" y="120" width="18" height="174" fill="#e8e0cc" stroke="#b8ab84" />
        <rect x="542" y="120" width="18" height="174" fill="#e8e0cc" stroke="#b8ab84" />

        {/* Cellulose fill, between the liners */}
        <rect x="98" y="120" width="444" height="174" fill="#efe6c8" stroke="#cdbd8f" />
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={110 + (i % 10) * 44} cy={135 + Math.floor(i / 10) * 40} r="2.2" fill="#cdbd8f" />
        ))}

        {/* OSB deck on top, with a seam down the middle */}
        <rect x="80" y="90" width="480" height="30" fill="#c9b483" stroke="#8a6a3a" />
        <line x1="320" y1="90" x2="320" y2="120" stroke="#8a6a3a" strokeWidth="1.5" />
        {/* Air sealing tape over the seam */}
        <rect x="312" y="90" width="16" height="30" fill="#d4a017" opacity="0.75" />

        {/* Gap sealing callout at a corner */}
        <circle cx="551" cy="105" r="15" fill="none" stroke="#e0392b" strokeDasharray="3 2" />
        <path d="M 544 108 q 4 -8 7 0 t 7 0" stroke="#e0392b" strokeWidth="1.5" fill="none" />

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
        {floorAssemblyLayers.map((layer, i) => (
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
