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
import { BrandMark } from "@/components/BrandMark";

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
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.96 + pulse.value * 0.08 }, { scaleY: 1.04 - pulse.value * 0.08 }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your household"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.halo, { backgroundColor: colors.primary + "12" }]}>
        <Animated.View style={orbitStyle}>
          <Animated.View style={pulseStyle}>
            <BrandMark size={132} color={colors.primary} />
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
});
