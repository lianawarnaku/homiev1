// One translucent surface implementation for the whole app, resolved at
// runtime into the best tier the device actually supports:
//
//   1. Liquid glass (`expo-glass-effect`) — iOS 26+ only. Both availability
//      checks return false off iOS, and the API check guards against iOS 26
//      betas where calling it crashes.
//   2. `expo-blur` + a themed gradient. Android only blurs for real with
//      `experimentalBlurMethod="dimezisBlurView"`, which costs performance, so
//      Android stays off this tier unless a caller opts in.
//   3. An opaque themed surface. The guaranteed floor — a surface never
//      renders as a broken semi-transparent box.
//
// The queued liquid-glass re-skin should extend this component rather than
// fork a second implementation.

import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/constants/colors";
import { isDarkColor, withAlpha } from "@/lib/contrast";

export type GlassTier = "liquid-glass" | "blur" | "solid";

function liquidGlassSupported(): boolean {
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    // The native module is missing (Expo Go, or a build without the plugin).
    return false;
  }
}

/**
 * `allowBlur` opts a surface into tier 2 on Android. Leave it off for anything
 * heavy or animated — dimezisBlurView re-renders the blur every frame.
 */
export function useGlassTier(allowBlur: boolean = Platform.OS !== "android"): GlassTier {
  if (liquidGlassSupported()) return "liquid-glass";
  return allowBlur ? "blur" : "solid";
}

export function GlassSurface({
  children,
  style,
  intensity = 52,
  allowBlur,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  allowBlur?: boolean;
}) {
  const colors = useTheme();
  const tier = useGlassTier(allowBlur);
  const dark = isDarkColor(colors.background);

  if (tier === "liquid-glass") {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        colorScheme={dark ? "dark" : "light"}
        tintColor={withAlpha(colors.card, 0.4)}
      >
        {children}
      </GlassView>
    );
  }

  if (tier === "blur") {
    return (
      <View style={style}>
        <BlurView
          intensity={intensity}
          tint={dark ? "dark" : "light"}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Keeps text legible over whatever scrolls underneath. */}
        <LinearGradient
          colors={[withAlpha(colors.card, 0.82), withAlpha(colors.card, 0.6)]}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  return <View style={[style, { backgroundColor: colors.card }]}>{children}</View>;
}
