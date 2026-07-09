import {
  floorCornerCavityDetail,
  floorFieldBayDetail,
  floorInsulationSequencingRule,
} from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

const BADGE_LETTERS = ["A", "B", "C"];

const STEPS = [
  { key: "sequencing", ...floorInsulationSequencingRule, label: "Insulate-before-deck sequencing" },
  { key: "corner", ...floorCornerCavityDetail, label: "Corner cavity fill & capping" },
  { key: "field", ...floorFieldBayDetail, label: "Interior field bays" },
];

const BADGES: { x: number; y: number; targetX: number; targetY: number }[] = [
  { x: 650, y: 130, targetX: 352, targetY: 250 }, // A: sequencing rule — boundary between open and decked bays
  { x: 650, y: 230, targetX: 82, targetY: 82 }, // B: corner cavity
  { x: 650, y: 330, targetX: 287, targetY: 250 }, // C: interior field bay, still open
];

/** Illustrative (not-to-scale) plan-view of a building corner's floor
 * insulation sequencing: bays nearer the corner are shown still open
 * (cellulose visible, not yet decked) while bays further along are shown
 * already decked (opaque OSB cap) — the contrast between the two states
 * illustrates the "insulate before decking covers the bay" rule. The
 * corner cavity between the doubled rim members gets its own cellulose
 * fill and cap, shown semi-transparent so the fill is visible underneath.
 * Legend text is sourced directly from panel-catalog so the wording stays
 * single-sourced. */
export default function FloorCornerDetailDiagram() {
  const joistX = [94, 223, 352, 481, 610];
  const bayFill = [true, true, false, false]; // true = open/cellulose, false = already decked

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 680 420"
        style={{ width: "100%", maxWidth: 620, height: "auto" }}
        role="img"
        aria-label="Floor corner and perimeter insulation sequencing diagram"
      >
        {/* Bays, drawn first so joists/rims sit on top */}
        {bayFill.map((open, i) => {
          const x = joistX[i]!;
          const width = joistX[i + 1]! - x;
          return open ? (
            <g key={i}>
              <rect x={x} y="94" width={width} height="306" fill="#efe6c8" stroke="#cdbd8f" />
              {Array.from({ length: 10 }).map((_, d) => (
                <circle
                  key={d}
                  cx={x + 18 + (d % 3) * (width - 36) / 2}
                  cy={130 + Math.floor(d / 3) * 70}
                  r="2.2"
                  fill="#cdbd8f"
                />
              ))}
            </g>
          ) : (
            <rect key={i} x={x} y="94" width={width} height="306" fill="#c9b483" stroke="#8a6a3a" />
          );
        })}

        {/* Divider marking where the sequencing changes, with a directional note */}
        <line x1="352" y1="94" x2="352" y2="400" stroke="#e0392b" strokeWidth="2" strokeDasharray="6 4" />
        <text x="352" y="410" fontSize="11" fill="#a33" textAnchor="middle">
          open, cellulose visible ← | → already decked
        </text>

        {/* Joists between bays */}
        {joistX.map((x, i) => (
          <rect key={i} x={x - 3} y="94" width="6" height="306" fill="#8a6a3a" />
        ))}

        {/* Perimeter rims (doubled — thin line down the middle indicates the two members) */}
        <rect x="70" y="70" width="540" height="24" fill="#7a4a2b" stroke="#5c3a20" />
        <line x1="70" y1="82" x2="610" y2="82" stroke="#fff" strokeWidth="1" />
        <rect x="70" y="70" width="24" height="330" fill="#7a4a2b" stroke="#5c3a20" />
        <line x1="82" y1="70" x2="82" y2="400" stroke="#fff" strokeWidth="1" />

        {/* Corner cavity — cellulose fill between the doubled members, capped (semi-transparent) */}
        <rect x="70" y="70" width="24" height="24" fill="#efe6c8" />
        <circle cx="78" cy="78" r="1.6" fill="#cdbd8f" />
        <circle cx="86" cy="86" r="1.6" fill="#cdbd8f" />
        <rect x="66" y="66" width="32" height="32" fill="#c9b483" opacity="0.5" stroke="#8a6a3a" strokeDasharray="3 2" />

        <text x="50" y="60" fontSize="11" fill="#333" textAnchor="middle">
          Corner
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
        {STEPS.map((step, i) => (
          <div key={step.key} className={styles.legendRow}>
            <dt className={styles.legendBadge}>{BADGE_LETTERS[i]}</dt>
            <dd className={styles.legendText}>
              <strong>{step.label}.</strong> {step.note}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
