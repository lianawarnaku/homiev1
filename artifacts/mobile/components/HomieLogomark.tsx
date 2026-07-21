import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

/**
 * Homie logomark — four rounded square tiles + one rounded triangle tile.
 *
 * Triangle corners rounded via quadratic bézier (r ≈ 5):
 *   Peak  (50, 18) · Bottom-left (27, 46) · Bottom-right (73, 46)
 *
 * Squares use rx/ry = 4 for consistent corner radius.
 */
export function HomieLogomark({ size = 80, color = "#8D5524" }: Props) {
  // Rounded triangle path
  // For each corner: move r=5 along both adjacent edges, then Q through the corner point.
  const roof =
    "M 46.3,21.4 L 23.7,42.6 Q 20,46 25,46 L 75,46 Q 80,46 76.3,42.6 L 53.7,21.4 Q 50,18 46.3,21.4 Z";

  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 100 108">
      {/* Roof tile — rounded triangle */}
      <Path d={roof} fill={color} />

      {/* Top-left square */}
      <Rect x={27} y={48} width={22} height={22} rx={4} ry={4} fill={color} />

      {/* Top-right square */}
      <Rect x={51} y={48} width={22} height={22} rx={4} ry={4} fill={color} />

      {/* Bottom-left square */}
      <Rect x={27} y={72} width={22} height={22} rx={4} ry={4} fill={color} />

      {/* Bottom-right square */}
      <Rect x={51} y={72} width={22} height={22} rx={4} ry={4} fill={color} />
    </Svg>
  );
}
