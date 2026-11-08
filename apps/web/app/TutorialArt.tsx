"use client";

import type { TutorialArtId } from "./tutorials";

/**
 * ⚠ **U7's illustrations — schematics, not decoration.**
 *
 * The teardown asked for *"three illustrated cards"*, and an illustration that
 * does not show the thing the card is describing is worse than a blank space:
 * it costs the reader a look and tells them nothing. So each of these draws the
 * actual gesture or the actual outcome — a cursor on a panel, a board snapping
 * to a face, a greyed row with a reason — in the app's own panel colours.
 *
 * ⚠ **Inline SVG, no asset.** Same reasoning as the straw texture in
 * `PanelMembersGroup`: a file is a thing that can 404, go missing from a build,
 * or be served from a path that moves. These cannot.
 *
 * ⚠ **`aria-hidden`.** Every one of them restates the card's own text, which is
 * right beside it. A screen reader should hear the sentence once.
 */

const LUMBER = "#8a6a3a";
const SHEET = "#d9c9a3";
const INK = "#3a4553";
const MUTED = "#9aa7b4";
const ACCENT = "#2f6f4f";
const WARN = "#a6522a";

const VIEW = { width: 232, height: 92 } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      width="100%"
      height={92}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", background: "#f7f9fb", borderRadius: 6, border: "1px solid #e2e8ee" }}
    >
      {children}
    </svg>
  );
}

/** A row of wall panels, the shape every plan and elevation in this app draws. */
function PanelRow({ highlight, openAt }: { highlight?: number; openAt?: number }) {
  const widths = [34, 34, 34, 34, 34];
  let x = 18;
  return (
    <>
      {widths.map((w, i) => {
        const at = x;
        x += w + 2;
        if (i === openAt) {
          return (
            <rect
              key={i}
              x={at}
              y={30}
              width={w}
              height={40}
              fill="none"
              stroke={MUTED}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          );
        }
        return (
          <rect
            key={i}
            x={at}
            y={30}
            width={w}
            height={40}
            fill={i === highlight ? SHEET : LUMBER}
            stroke={INK}
            strokeWidth={i === highlight ? 1.8 : 0.8}
          />
        );
      })}
    </>
  );
}

/** The arrow-and-dot cursor, pointed at a spot. */
function Cursor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L0 13 L3.4 9.8 L5.8 15 L8.4 13.8 L6 8.8 L10.6 8.6 Z" fill="#111" stroke="#fff" strokeWidth={0.8} />
    </g>
  );
}

/** A little menu, with one row greyed and struck. */
function MiniMenu({ x, y, rows }: { x: number; y: number; rows: { label: string; disabled?: boolean }[] }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={92} height={rows.length * 14 + 6} rx={3} fill="#fff" stroke={INK} strokeWidth={0.9} />
      {rows.map((row, i) => (
        <g key={row.label}>
          <rect x={3} y={4 + i * 14} width={86} height={12} rx={2} fill={row.disabled ? "#f1f3f5" : "#eef4fb"} />
          <text x={8} y={13 + i * 14} fontSize={8} fill={row.disabled ? MUTED : INK} fontFamily="system-ui, sans-serif">
            {row.label}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function TutorialArt({ art }: { art: TutorialArtId }) {
  switch (art) {
    case "right-click":
      return (
        <Frame>
          <PanelRow highlight={2} />
          <Cursor x={96} y={46} />
          <MiniMenu x={112} y={14} rows={[{ label: "Change type…" }, { label: "Delete / merge" }]} />
        </Frame>
      );

    case "type-list":
      return (
        <Frame>
          <MiniMenu
            x={18}
            y={10}
            rows={[
              { label: "Standard" },
              { label: "Braced" },
              { label: "Window" },
              { label: "Big Header", disabled: true },
            ]}
          />
          <text x={120} y={58} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            greyed, with
          </text>
          <text x={120} y={69} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            the reason why
          </text>
          <path d="M114 62 L104 62" stroke={MUTED} strokeWidth={1} markerEnd="" />
        </Frame>
      );

    case "open-slot":
      return (
        <Frame>
          <PanelRow openAt={2} />
          {/* The wall still measures what it measured. */}
          <path d="M18 80 L190 80" stroke={ACCENT} strokeWidth={1} />
          <path d="M18 76 L18 84 M190 76 L190 84" stroke={ACCENT} strokeWidth={1} />
          <text x={78} y={22} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            open slot
          </text>
        </Frame>
      );

    case "member-pick":
      return (
        <Frame>
          <rect x={30} y={14} width={120} height={64} fill="none" stroke={INK} strokeWidth={1} />
          {[44, 72, 100, 128].map((x) => (
            <rect key={x} x={x} y={14} width={6} height={64} fill={LUMBER} />
          ))}
          <rect x={72} y={14} width={6} height={64} fill={SHEET} stroke={ACCENT} strokeWidth={1.6} />
          <Cursor x={80} y={44} />
          <MiniMenu x={158} y={20} rows={[{ label: "Duplicate" }, { label: "2x4 → 2x6" }]} />
        </Frame>
      );

    case "member-snap":
      return (
        <Frame>
          <rect x={26} y={16} width={70} height={60} fill="none" stroke={MUTED} strokeWidth={1} />
          <rect x={26} y={16} width={6} height={60} fill={LUMBER} />
          {/* The dragged board, caught against the face. */}
          <rect x={34} y={16} width={6} height={60} fill={SHEET} stroke={ACCENT} strokeWidth={1.4} />
          <path d="M58 46 L40 46" stroke={ACCENT} strokeWidth={1.2} />
          <path d="M44 42 L39 46 L44 50" fill="none" stroke={ACCENT} strokeWidth={1.2} />
          <text x={62} y={44} fontSize={8.5} fill={ACCENT} fontFamily="system-ui, sans-serif">
            snaps to the face
          </text>
          <text x={62} y={56} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            then the ⅛ inch
          </text>
        </Frame>
      );

    case "member-refused":
      return (
        <Frame>
          <rect x={30} y={16} width={110} height={60} fill="none" stroke={MUTED} strokeWidth={1} />
          <rect x={60} y={16} width={8} height={60} fill={LUMBER} />
          <rect x={64} y={16} width={8} height={60} fill="none" stroke={WARN} strokeWidth={1.6} strokeDasharray="3 2" />
          <circle cx={68} cy={46} r={13} fill="none" stroke={WARN} strokeWidth={1.8} />
          <path d="M59 55 L77 37" stroke={WARN} strokeWidth={1.8} />
          <text x={150} y={44} fontSize={8.5} fill={WARN} fontFamily="system-ui, sans-serif">
            put back
          </text>
        </Frame>
      );

    case "scope":
      return (
        <Frame>
          {[
            { label: "Floors", on: true },
            { label: "Walls", on: true },
            { label: "Roof", on: true },
            { label: "Foundation", on: false },
          ].map((row, i) => (
            <g key={row.label} transform={`translate(26 ${16 + i * 17})`}>
              <rect x={0} y={0} width={11} height={11} rx={2} fill={row.on ? ACCENT : "#fff"} stroke={INK} strokeWidth={0.9} />
              {row.on && <path d="M2.4 5.6 L4.6 8 L8.6 2.8" fill="none" stroke="#fff" strokeWidth={1.6} />}
              <text x={18} y={9.5} fontSize={9} fill={row.on ? INK : MUTED} fontFamily="system-ui, sans-serif">
                {row.label}
              </text>
            </g>
          ))}
          <text x={116} y={74} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            unchecked = out of
          </text>
          <text x={116} y={85} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            the building entirely
          </text>
        </Frame>
      );

    case "girt-style":
      return (
        <Frame>
          <rect x={26} y={20} width={84} height={52} fill="none" stroke={INK} strokeWidth={1} />
          <rect x={26} y={40} width={84} height={7} fill={LUMBER} />
          <rect x={26} y={56} width={84} height={7} fill={LUMBER} />
          <text x={122} y={32} fontSize={8.5} fill={INK} fontFamily="system-ui, sans-serif">
            settings describe
          </text>
          <text x={122} y={44} fontSize={8.5} fill={INK} fontFamily="system-ui, sans-serif">
            panels not yet built
          </text>
          <rect x={122} y={54} width={84} height={16} rx={3} fill="#fff6e5" stroke={WARN} strokeWidth={0.9} />
          <text x={128} y={65} fontSize={8} fill={WARN} fontFamily="system-ui, sans-serif">
            pending · Repanelize
          </text>
        </Frame>
      );

    case "pending-flag":
      return (
        <Frame>
          <rect x={26} y={22} width={180} height={20} rx={3} fill="#fff6e5" stroke={WARN} strokeWidth={1} />
          <path d="M36 27 L36 37 M36 27 L45 30 L36 33" fill="none" stroke={WARN} strokeWidth={1.4} />
          <text x={52} y={36} fontSize={9} fill={WARN} fontFamily="system-ui, sans-serif">
            pending BI confirmation
          </text>
          <text x={26} y={58} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            a researched placeholder,
          </text>
          <text x={26} y={70} fontSize={8.5} fill={MUTED} fontFamily="system-ui, sans-serif">
            flagged everywhere it is used
          </text>
        </Frame>
      );
  }
}
