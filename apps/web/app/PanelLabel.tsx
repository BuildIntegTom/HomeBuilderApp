"use client";

import { Text } from "@react-three/drei";

export interface PanelLabelProps {
  text: string | undefined;
  position: [number, number, number];
  rotation?: [number, number, number];
  fontSize?: number;
}

const DEFAULT_ROTATION: [number, number, number] = [0, 0, 0];

/**
 * Shared "double outline, white fill" panel-name label (Tommy: "i liked
 * that double outline with white fill type of lettering we have for the 2d
 * plan view") for every simplified 3D box view — Building3DView's
 * whole-building preview and TruckLoad3DView's shipping-stack view.
 * Position/rotation are the caller's own concern (a wall panel's "top of
 * its largest exterior face" and a stacked truck panel's "top face" are
 * different enough placements that baking either one in here wouldn't fit
 * the other).
 */
export default function PanelLabel({ text, position, rotation = DEFAULT_ROTATION, fontSize = 0.25 }: PanelLabelProps) {
  if (!text) return null;
  return (
    <Text
      position={position}
      rotation={rotation}
      fontSize={fontSize}
      color="#ffffff"
      outlineWidth={fontSize * 0.12}
      outlineColor="#333333"
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  );
}
