import { foundationTypes } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const slabSteps = foundationTypes.find((f) => f.id === "slab")!.loadPath;
const BADGE_LETTERS = ["A", "B", "C", "D", "E"];

// Callout badge positions (hand-placed to land near each step's element in
// the schematic below) paired 1:1 with slabSteps, in order.
const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 600, y: 380, targetX: 208, targetY: 353 }, // A: footer
  { x: 600, y: 300, targetX: 198, targetY: 272 }, // B: stem wall
  { x: 600, y: 230, targetX: 226, targetY: 218 }, // C: thermal shelf (lip)
  { x: 600, y: 160, targetX: 220, targetY: 195 }, // D: EPS foam
  { x: 600, y: 90, targetX: 350, targetY: 188 }, // E: slab
];

/** Schematic cross-section of the thermally-broken slab detail: footer ->
 * stem wall -> thermal shelf (lip) -> EPS foam thermal break -> slab.
 * Purely illustrative (not to scale). Exterior is to the left, interior to
 * the right. The legend below the drawing renders straight from
 * `slabLoadPath` (packages/panel-catalog) so the wording stays
 * single-sourced. */
export default function SlabFoundationDiagram() {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 640 420"
        style={{ width: "100%", maxWidth: 560, height: "auto" }}
        role="img"
        aria-label="Thermally broken slab foundation detail diagram"
      >
        {/* Footer */}
        <rect x="100" y="326" width="216" height="54" fill="#b8b8b8" stroke="#777" />
        {/* Stem wall, lower (full 10in thickness) */}
        <rect x="178" y="218" width="60" height="108" fill="#b8b8b8" stroke="#777" />
        {/* Stem wall, upper (receded 6in thickness, above the shelf) */}
        <rect x="178" y="182" width="36" height="36" fill="#c9c9c9" stroke="#777" />
        {/* EPS foam: vertical run down the upper wall's interior face, then horizontal across the shelf and under the slab */}
        <rect x="214" y="182" width="12" height="36" fill="#cfe8f3" stroke="#8fb8cc" />
        <rect x="214" y="206" width="306" height="12" fill="#cfe8f3" stroke="#8fb8cc" />
        {/* Slab, poured on top of the horizontal foam */}
        <rect x="214" y="170" width="306" height="36" fill="#d9c9a3" stroke="#8a6a3a" />

        <text x="60" y="356" fontSize="11" fill="#333" textAnchor="end">
          Exterior
        </text>
        <text x="580" y="200" fontSize="11" fill="#333" textAnchor="end">
          Interior
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
        {slabSteps.map((step, i) => (
          <div key={step.label} className={styles.legendRow}>
            <dt className={styles.legendBadge}>{BADGE_LETTERS[i]}</dt>
            <dd className={styles.legendText}>
              <strong>{step.label}.</strong> {step.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
