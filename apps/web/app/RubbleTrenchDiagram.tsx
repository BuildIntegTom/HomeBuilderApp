import { foundationTypes } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const steps = foundationTypes.find((f) => f.id === "rubble-trench-beam")!.loadPath;
const BADGE_LETTERS = ["A", "B", "C", "D", "E"];

const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 610, y: 320, targetX: 360, targetY: 300 }, // A: rubble trench
  { x: 610, y: 260, targetX: 360, targetY: 258 }, // B: grade beam
  { x: 610, y: 200, targetX: 360, targetY: 222 }, // C: beam to floor panel
  { x: 610, y: 140, targetX: 521, targetY: 190 }, // D: floor panel to toe-up
  { x: 610, y: 80, targetX: 500, targetY: 174 }, // E: toe-up to wall panel
];

/** Schematic cross-section of a rubble trench w/ beam foundation: a
 * continuous stone-filled trench (dug to frost depth) topped with a
 * continuous poured grade beam, then the same floor panel -> toe-up ->
 * wall panel stack shared by every foundation type. Purely illustrative
 * (not to scale). The legend renders straight from the foundation's own
 * `loadPath` (packages/panel-catalog) so the wording stays
 * single-sourced. */
export default function RubbleTrenchDiagram() {
  const rubble = Array.from({ length: 22 }).map((_, i) => ({
    cx: 150 + (i % 11) * 38,
    cy: 285 + Math.floor(i / 11) * 24,
    r: 5 + (i % 3),
  }));

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 660 340"
        style={{ width: "100%", maxWidth: 560, height: "auto" }}
        role="img"
        aria-label="Rubble trench with beam foundation load path diagram"
      >
        <line x1="40" y1="270" x2="600" y2="270" stroke="#999" strokeWidth="1.5" />
        {Array.from({ length: 20 }, (_, i) => (
          <line key={i} x1={44 + i * 28} y1={270} x2={34 + i * 28} y2={282} stroke="#bbb" strokeWidth="1" />
        ))}

        {/* Rubble-filled trench, dug below grade */}
        <rect x="140" y="270" width="440" height="60" fill="#d8d2bc" stroke="#a89c78" />
        {rubble.map((r, i) => (
          <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill={i % 2 === 0 ? "#999" : "#aaa"} stroke="#888" strokeWidth="0.5" />
        ))}

        {/* Continuous grade beam on top of the trench, sharing the wall panel's
            exterior (right) edge at x580 so exterior faces stay flush up the stack */}
        <rect x="140" y="246" width="440" height="24" fill="#b8b8b8" stroke="#777" />

        {/* Floor panel */}
        <rect x="80" y="198" width="500" height="48" fill="#d9c9a3" stroke="#8a6a3a" />

        <text x="595" y="60" fontSize="11" fill="#333" textAnchor="end">
          Exterior
        </text>
        <text x="60" y="226" fontSize="11" fill="#333">
          Interior
        </text>

        {/* Toe-up: ext./int. 2x4 laid flat, flush with each side of the wall panel above, 1.5in wood
            fiberboard between them (Tommy) — spans the same width as the wall panel it carries. */}
        <rect x="470" y="182" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="495" y="182" width="60" height="16" fill="#e8e2d0" stroke="#b0a888" />
        <rect x="555" y="182" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />

        {/* Wall panel rests directly on the toe-up, no gap */}
        <rect x="470" y="86" width="110" height="96" fill="#d9c9a3" stroke="#8a6a3a" />
        <rect x="470" y="166" width="110" height="16" fill="#b5905a" stroke="#8a6a3a" />

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
