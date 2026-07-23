import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/constants/colors";

export function HouseLoader() {
  const colors = useTheme();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 6500, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
    };
  }, [pulse, rotation]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const blockStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.96 + pulse.value * 0.08 }, { scaleY: 1.04 - pulse.value * 0.08 }],
  }));
  const inverseBlockStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1.04 - pulse.value * 0.08 }, { scaleY: 0.96 + pulse.value * 0.08 }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your household"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.halo, { backgroundColor: colors.primary + "12" }]}>
        <Animated.View style={[styles.house, orbitStyle]}>
          <Animated.View
            style={[
              styles.roof,
              blockStyle,
              {
                borderBottomColor: colors.primary,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.walls,
              inverseBlockStyle,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.window,
                blockStyle,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={[styles.windowVertical, { backgroundColor: colors.primary }]} />
              <View style={[styles.windowHorizontal, { backgroundColor: colors.primary }]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.door,
                blockStyle,
                { backgroundColor: colors.accent, borderColor: colors.primary },
              ]}
            >
              <View style={[styles.knob, { backgroundColor: colors.primaryForeground }]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.window,
                inverseBlockStyle,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={[styles.windowVertical, { backgroundColor: colors.primary }]} />
              <View style={[styles.windowHorizontal, { backgroundColor: colors.primary }]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: "center",
    justifyContent: "center",
  },
  house: {
    width: 128,
    height: 132,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 68,
    borderRightWidth: 68,
    borderBottomWidth: 58,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginBottom: -4,
    zIndex: 2,
  },
  walls: {
    width: 108,
    height: 74,
    borderWidth: 3,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  window: {
    width: 25,
    height: 27,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: 25,
    overflow: "hidden",
  },
  windowVertical: {
    position: "absolute",
    width: 2,
    height: "100%",
    left: 10,
  },
  windowHorizontal: {
    position: "absolute",
    width: "100%",
    height: 2,
    top: 11,
  },
  door: {
    width: 28,
    height: 48,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 4,
  },
  knob: { width: 5, height: 5, borderRadius: 3 },
});
