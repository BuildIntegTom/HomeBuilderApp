import { foundationTypes } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C", "D", "E"];

// Callout badge positions (hand-placed to land near each step's junction in
// the schematic below) paired 1:1 with the foundation's loadPath, in order.
// The pier sits centered under the wall panel (x525, matching the wall's
// own centerline) — not floating in the middle of the floor span.
const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 610, y: 298, targetX: 525, targetY: 295 }, // A: pier
  { x: 610, y: 246, targetX: 525, targetY: 263 }, // B: pier to beam
  { x: 610, y: 194, targetX: 300, targetY: 229 }, // C: beam to floor panel
  { x: 610, y: 142, targetX: 521, targetY: 174 }, // D: floor panel to toe-up
  { x: 610, y: 90, targetX: 500, targetY: 158 }, // E: toe-up to wall panel
];

export interface PierFoundationDiagramProps {
  foundationId: "crawlspace" | "concrete-pier" | "ground-screw" | "cinderblock-pier";
}

const ARIA_LABELS: Record<PierFoundationDiagramProps["foundationId"], string> = {
  crawlspace: "Vented crawlspace (helical pile) load path diagram",
  "concrete-pier": "Concrete pier (poured column) foundation load path diagram",
  "ground-screw": "Ground screw foundation load path diagram",
  "cinderblock-pier": "Cinderblock pier foundation load path diagram",
};

/** Schematic side-elevation of a pier foundation's load path: pier -> beam
 * -> floor panel -> toe-up (with its thermal-break detail) -> wall panel
 * bottom plate. Shared by all 4 pier products (helical pile, ground screw,
 * poured concrete column, cinderblock) — only the pier itself is drawn
 * differently; the beam/floor/toe-up/wall stack above it is identical
 * either way. Purely illustrative (not to scale). The legend below the
 * drawing renders straight from the matching foundation's `loadPath`
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

        {/* Pier sits centered under the wall panel (x515-535, matching the
            wall's own centerline at 525) — not floating mid-span. */}
        {foundationId === "concrete-pier" && <rect x="515" y="270" width="20" height="50" fill="#b8b8b8" stroke="#777" />}
        {foundationId === "crawlspace" && (
          <>
            <rect x="515" y="270" width="20" height="50" fill="#c9c9c9" stroke="#888" />
            {Array.from({ length: 4 }, (_, i) => (
              <line key={i} x1={515} y1={279 + i * 11} x2={535} y2={285 + i * 11} stroke="#888" strokeWidth="1" />
            ))}
          </>
        )}
        {foundationId === "ground-screw" && (
          <>
            <rect x="520" y="270" width="10" height="45" fill="#c9c9c9" stroke="#888" />
            <ellipse cx="525" cy="315" rx="15" ry="5" fill="#a8a8a8" stroke="#777" />
          </>
        )}
        {foundationId === "cinderblock-pier" && (
          <>
            <rect x="513" y="270" width="24" height="50" fill="#c9c9c9" stroke="#888" />
            {Array.from({ length: 3 }, (_, i) => (
              <line key={i} x1={513} y1={287 + i * 16} x2={537} y2={287 + i * 16} stroke="#888" strokeWidth="1" />
            ))}
            <line x1="525" y1="270" x2="525" y2="287" stroke="#888" strokeWidth="1" />
            <line x1="525" y1="303" x2="525" y2="319" stroke="#888" strokeWidth="1" />
          </>
        )}
        <rect x="505" y="256" width="40" height="14" fill="#a8a8a8" stroke="#777" />

        {/* Beam and floor panel share the wall panel's exterior (right)
            edge at x580, so exterior faces stay flush all the way up
            through the stack. */}
        <rect x="140" y="230" width="440" height="26" fill="#c7a76c" stroke="#8a6a3a" />

        <rect x="80" y="182" width="500" height="48" fill="#d9c9a3" stroke="#8a6a3a" />

        <text x="595" y="60" fontSize="11" fill="#333" textAnchor="end">
          Exterior
        </text>
        <text x="60" y="210" fontSize="11" fill="#333">
          Interior
        </text>

        {/* Toe-up: ext./int. 2x4 laid flat, flush with each side of the wall panel above, 1.5in wood
            fiberboard between them (Tommy) — spans the same width as the wall panel it carries. */}
        <rect x="470" y="166" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="495" y="166" width="60" height="16" fill="#e8e2d0" stroke="#b0a888" />
        <rect x="555" y="166" width="25" height="16" fill="#7a4a2b" stroke="#5c3a20" />

        {/* Wall panel rests directly on the toe-up, no gap */}
        <rect x="470" y="70" width="110" height="96" fill="#d9c9a3" stroke="#8a6a3a" />
        <rect x="470" y="150" width="110" height="16" fill="#b5905a" stroke="#8a6a3a" />

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
