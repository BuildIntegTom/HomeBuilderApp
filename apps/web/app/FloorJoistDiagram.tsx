import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C", "D", "E"];

const STEPS = [
  {
    label: "Edge-rim joist",
    description: "Full-depth rim member right at the short-wall edge.",
  },
  {
    label: "Thermal-break gap",
    description: "1.5\" insulated air gap separating the edge-rim joist from the rim joist behind it.",
  },
  {
    label: "Rim joist",
    description: "Second rim member, completing the doubled/thermally-broken rim assembly before transitioning into the field joists.",
  },
  {
    label: "Field joists",
    description: "Depth = panel thickness − 4.5\", repeating at the selected type's o.c. spacing, insulated bays between them, until reaching the far end — which mirrors this same edge-rim → gap → rim joist assembly (symmetric, Tommy).",
  },
  {
    label: "Long-side blocking",
    description: "Solid blocking just under the panel along the long sides (the sides the joists run alongside, not the sides they land on).",
  },
];

/** Illustrative (not-to-scale) plan-view schematic of the suspended-floor
 * joist layout's short-end detail: the thermally-broken double-rim
 * assembly, the field joist run, and — mirrored — the same assembly at
 * the far end (confirmed symmetric, Tommy). Shared by every floor joist
 * type (LVL 16/24, Solid Pine); only spacing/material differ, not this
 * detail. */
export default function FloorJoistDiagram() {
  const fieldJoistX = [400, 460, 520, 580];

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 900 220" style={{ width: "100%", maxWidth: 720, height: "auto" }} role="img" aria-label="Suspended floor joist rim detail diagram">
        {/* Near-end double-rim assembly */}
        <rect x="20" y="40" width="18" height="140" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="38" y="40" width="16" height="140" fill="#cfe8f3" stroke="#8fb8cc" />
        <rect x="54" y="40" width="18" height="140" fill="#7a4a2b" stroke="#5c3a20" />

        {/* Transition gap into the field */}
        <rect x="72" y="55" width="30" height="110" fill="#cfe8f3" stroke="#8fb8cc" />

        {/* Field joists (shallower depth) with insulation bays between them */}
        {fieldJoistX.map((x, i) => (
          <g key={i}>
            {i > 0 && <rect x={x - 40} y={55} width={40} height={110} fill="#cfe8f3" stroke="#8fb8cc" />}
            <rect x={x} y={55} width={16} height={110} fill="#d9c9a3" stroke="#8a6a3a" />
          </g>
        ))}

        <text x="660" y="115" fontSize="20" fill="#999" textAnchor="middle">
          •••
        </text>

        {/* Far-end double-rim assembly, mirrored */}
        <rect x="828" y="40" width="18" height="140" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="810" y="40" width="16" height="140" fill="#cfe8f3" stroke="#8fb8cc" />
        <rect x="792" y="40" width="18" height="140" fill="#7a4a2b" stroke="#5c3a20" />
        <rect x="712" y="55" width="80" height="110" fill="#cfe8f3" stroke="#8fb8cc" />

        {/* Long-side blocking inset, shown along the bottom as a reference strip */}
        <rect x="20" y="195" width="844" height="10" fill="#b5905a" stroke="#8a6a3a" />

        {/* Badges */}
        <g fontSize="11" fontWeight="700" fill="#fff">
          <circle cx="29" cy="20" r="10" fill="#1c3d5a" />
          <text x="29" y="24" textAnchor="middle">A</text>
          <line x1="29" y1="30" x2="29" y2="40" stroke="#999" strokeDasharray="3 2" />

          <circle cx="46" cy="20" r="10" fill="#1c3d5a" />
          <text x="46" y="24" textAnchor="middle">B</text>
          <line x1="46" y1="30" x2="46" y2="40" stroke="#999" strokeDasharray="3 2" />

          <circle cx="63" cy="20" r="10" fill="#1c3d5a" />
          <text x="63" y="24" textAnchor="middle">C</text>
          <line x1="63" y1="30" x2="63" y2="40" stroke="#999" strokeDasharray="3 2" />

          <circle cx="408" cy="20" r="10" fill="#1c3d5a" />
          <text x="408" y="24" textAnchor="middle">D</text>
          <line x1="408" y1="30" x2="408" y2="55" stroke="#999" strokeDasharray="3 2" />

          <circle cx="442" cy="210" r="10" fill="#1c3d5a" />
          <text x="442" y="214" textAnchor="middle">E</text>
        </g>
      </svg>

      <dl className={styles.legend}>
        {STEPS.map((step, i) => (
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
