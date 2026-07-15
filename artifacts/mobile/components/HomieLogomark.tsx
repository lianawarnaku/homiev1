import React from "react";
import Svg, { Polygon, Rect } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

/**
 * Homie logomark — four brown square tiles and one brown triangle tile,
 * all converging at the center point.
 *
 * Layout (viewBox 0 0 100 108):
 *   Triangle (roof): points 27,46  73,46  50,18
 *   TL square:  x=27  y=48  w=22 h=22   (inner corner at 49,70)
 *   TR square:  x=51  y=48  w=22 h=22   (inner corner at 51,70)
 *   BL square:  x=27  y=72  w=22 h=22
 *   BR square:  x=51  y=72  w=22 h=22
 *
 * The 2 px gap between every piece makes each tile visually distinct.
 */
export function HomieLogomark({ size = 80, color = "#8D5524" }: Props) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 100 108">
      {/* Roof tile — triangle */}
      <Polygon points="27,46 73,46 50,18" fill={color} />

      {/* Top-left square tile */}
      <Rect x={27} y={48} width={22} height={22} fill={color} />

      {/* Top-right square tile */}
      <Rect x={51} y={48} width={22} height={22} fill={color} />

      {/* Bottom-left square tile */}
      <Rect x={27} y={72} width={22} height={22} fill={color} />

      {/* Bottom-right square tile */}
      <Rect x={51} y={72} width={22} height={22} fill={color} />
    </Svg>
  );
}
