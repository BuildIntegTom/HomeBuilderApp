import { foundationTypes } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const steps = foundationTypes.find((f) => f.id === "concrete-block-stem-wall")!.loadPath;
const BADGE_LETTERS = ["A", "B", "C", "D", "E", "F"];

const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 630, y: 330, targetX: 525, targetY: 328 }, // A: footer
  { x: 630, y: 280, targetX: 525, targetY: 263 }, // B: CMU stem wall
  { x: 630, y: 230, targetX: 525, targetY: 209 }, // C: sill plate
  { x: 630, y: 180, targetX: 500, targetY: 178 }, // D: sill plate to floor panel
  { x: 630, y: 130, targetX: 521, targetY: 146 }, // E: floor panel to toe-up
  { x: 630, y: 80, targetX: 500, targetY: 130 }, // F: toe-up to wall panel
];

/** Schematic cross-section of a concrete block (CMU) stem wall foundation:
 * continuous footer -> stacked/mortared CMU stem wall (course lines drawn
 * in a running-bond pattern) -> sill plate -> the same floor panel ->
 * toe-up -> wall panel stack shared by every foundation type. Purely
 * illustrative (not to scale). The legend renders straight from the
 * foundation's own `loadPath` (packages/panel-catalog) so the wording
 * stays single-sourced. */
export default function ConcreteBlockStemWallDiagram() {
  const courseYs = [216, 234, 252, 270, 288];

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 680 370"
        style={{ width: "100%", maxWidth: 560, height: "auto" }}
        role="img"
        aria-label="Concrete block stem wall foundation load path diagram"
      >
        <line x1="40" y1="310" x2="650" y2="310" stroke="#999" strokeWidth="1.5" />
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} x1={44 + i * 28} y1={310} x2={34 + i * 28} y2={322} stroke="#bbb" strokeWidth="1" />
        ))}

        {/* Footer — centered under the stem wall, which is centered under
            the wall panel above (x525), not floating mid-span */}
        <rect x="405" y="310" width="240" height="36" fill="#b8b8b8" stroke="#777" />

        {/* CMU stem wall, with running-bond course lines */}
        <rect x="465" y="216" width="120" height="94" fill="#c9c9c9" stroke="#888" />
        {courseYs.map((y, i) => (
          <g key={y}>
            <line x1="465" y1={y} x2="585" y2={y} stroke="#999" strokeWidth="1" />
            <line x1={i % 2 === 0 ? 525 : 495} y1={y} x2={i % 2 === 0 ? 525 : 495} y2={y + 18} stroke="#999" strokeWidth="1" />
          </g>
        ))}

        {/* Sill plate */}
        <rect x="455" y="202" width="140" height="14" fill="#7a4a2b" stroke="#5c3a20" />

        {/* Floor panel, sharing the wall panel's exterior (right) edge at
            x580 so exterior faces stay flush up the stack */}
        <rect x="80" y="154" width="500" height="48" fill="#d9c9a3" stroke="#8a6a3a" />

        <text x="595" y="32" fontSize="11" fill="#333" textAnchor="end">
          Exterior
        </text>
        <text x="60" y="182" fontSize="11" fill="#333">
          Interior
        </text>

        {/* Toe-up: ext./int. 2x4 laid flat, flush with each side of the wall panel above, 1.5in wood
            fiberboard between them (Tommy) — spans the same width as the wall panel it carries. */}
        <rect x="470" y="138" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="495" y="138" width="60" height="16" fill="#e8e2d0" stroke="#b0a888" />
        <rect x="555" y="138" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />

        {/* Wall panel rests directly on the toe-up, no gap */}
        <rect x="470" y="42" width="110" height="96" fill="#d9c9a3" stroke="#8a6a3a" />
        <rect x="470" y="122" width="110" height="16" fill="#b5905a" stroke="#8a6a3a" />

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
        {steps.map((step, i) => (
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
