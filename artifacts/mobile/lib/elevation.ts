// Cross-platform elevation.
//
// The iOS `shadow*` props do not render on Android at all — Android draws
// shadows from `elevation`, and only for views with a solid background (a
// transparent elevated view casts nothing). Web wants a `boxShadow` string.
// Each surface asks for a named level here instead of restating four shadow
// props, so an iOS-only shadow cannot be introduced by copy-paste again.
//
// Pass the shadow color from `useTheme()` (usually `colors.foreground`).

import { Platform, type ViewStyle } from "react-native";

import { parseHexColor } from "@/lib/contrast";

export type ElevationLevel = "subtle" | "card" | "raised" | "floating" | "sheet";

interface LevelSpec {
  offsetY: number;
  radius: number;
  opacity: number;
  elevation: number;
}

const LEVELS: Record<ElevationLevel, LevelSpec> = {
  subtle: { offsetY: 5, radius: 14, opacity: 0.05, elevation: 1 },
  card: { offsetY: 5, radius: 14, opacity: 0.06, elevation: 2 },
  raised: { offsetY: 4, radius: 8, opacity: 0.2, elevation: 6 },
  floating: { offsetY: 8, radius: 20, opacity: 0.14, elevation: 12 },
  // Lifts upward, for surfaces anchored to the bottom edge.
  sheet: { offsetY: -8, radius: 24, opacity: 0.18, elevation: 16 },
};

function rgbaString(color: string, opacity: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return `rgba(0, 0, 0, ${opacity})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

export function elevationStyle(level: ElevationLevel, color: string): ViewStyle {
  const spec = LEVELS[level];
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: color,
        shadowOffset: { width: 0, height: spec.offsetY },
        shadowOpacity: spec.opacity,
        shadowRadius: spec.radius,
      },
      android: {
        // Android tints the elevation shadow from shadowColor on API 28+ and
        // ignores it below, where the platform gray is the only option.
        shadowColor: color,
        elevation: spec.elevation,
      },
      default: {
        boxShadow: `0px ${spec.offsetY}px ${spec.radius}px ${rgbaString(color, spec.opacity)}`,
      },
    }) ?? {}
  );
}
