import { foundationTypes } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C", "D", "E"];

// Callout badge positions (hand-placed to land near each step's junction in
// the schematic below) paired 1:1 with the foundation's loadPath, in order.
const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 610, y: 298, targetX: 312, targetY: 300 }, // A: pier
  { x: 610, y: 246, targetX: 310, targetY: 258 }, // B: pier to beam
  { x: 610, y: 194, targetX: 300, targetY: 229 }, // C: beam to floor panel
  { x: 610, y: 142, targetX: 521, targetY: 159 }, // D: floor panel to toe-up
  { x: 610, y: 90, targetX: 500, targetY: 128 }, // E: toe-up to wall panel
];

export interface PierFoundationDiagramProps {
  foundationId: "crawlspace" | "concrete-pier" | "ground-screw";
}

const ARIA_LABELS: Record<PierFoundationDiagramProps["foundationId"], string> = {
  crawlspace: "Vented crawlspace (helical pile) load path diagram",
  "concrete-pier": "Concrete pier foundation load path diagram",
  "ground-screw": "Ground screw foundation load path diagram",
};

/** Schematic side-elevation of a pier foundation's load path: pier -> beam
 * -> floor panel -> toe-up (with its thermal-break detail) -> wall panel
 * bottom plate. Shared by all 3 pier products (helical pile, ground screw,
 * cast concrete) — only the pier itself is drawn differently; the beam/
 * floor/toe-up/wall stack above it is identical either way. Purely
 * illustrative (not to scale). The legend below the drawing renders
 * straight from the matching foundation's `loadPath`
 * (packages/panel-catalog) so the wording stays single-sourced. */
export default function PierFoundationDiagram({ foundationId }: PierFoundationDiagramProps) {
  const steps = foundationTypes.find((f) => f.id === foundationId)!.loadPath;

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 660 340"
        style={{ width: "100%", maxWidth: 560, height: "auto" }}
        role="img"
        aria-label={ARIA_LABELS[foundationId]}
      >
        <line x1="40" y1="270" x2="600" y2="270" stroke="#999" strokeWidth="1.5" />
        {Array.from({ length: 20 }, (_, i) => (
          <line key={i} x1={44 + i * 28} y1={270} x2={34 + i * 28} y2={282} stroke="#bbb" strokeWidth="1" />
        ))}

        {foundationId === "concrete-pier" && <rect x="300" y="270" width="20" height="50" fill="#b8b8b8" stroke="#777" />}
        {foundationId === "crawlspace" && (
          <>
            <rect x="300" y="270" width="20" height="50" fill="#c9c9c9" stroke="#888" />
            {Array.from({ length: 4 }, (_, i) => (
              <line key={i} x1={300} y1={279 + i * 11} x2={320} y2={285 + i * 11} stroke="#888" strokeWidth="1" />
            ))}
          </>
        )}
        {foundationId === "ground-screw" && (
          <>
            <rect x="305" y="270" width="10" height="45" fill="#c9c9c9" stroke="#888" />
            <ellipse cx="310" cy="315" rx="15" ry="5" fill="#a8a8a8" stroke="#777" />
          </>
        )}
        <rect x="290" y="256" width="40" height="14" fill="#a8a8a8" stroke="#777" />

        <rect x="100" y="230" width="440" height="26" fill="#c7a76c" stroke="#8a6a3a" />

        <rect x="70" y="182" width="500" height="48" fill="#d9c9a3" stroke="#8a6a3a" />

        <rect x="500" y="136" width="14" height="46" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="514" y="136" width="14" height="46" fill="#e8e2d0" stroke="#b0a888" />
        <rect x="528" y="136" width="14" height="46" fill="#7a4a2b" stroke="#5c3a20" />

        <rect x="470" y="40" width="110" height="96" fill="#d9c9a3" stroke="#8a6a3a" />
        <rect x="470" y="120" width="110" height="16" fill="#b5905a" stroke="#8a6a3a" />

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
