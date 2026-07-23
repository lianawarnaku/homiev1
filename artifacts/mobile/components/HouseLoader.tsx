import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/constants/colors";
import { BrandMark } from "@/components/BrandMark";

export function HouseLoader() {
  const colors = useTheme();
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(0.78);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.78, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(opacity);
    };
  }, [opacity, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your household"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Animated.View style={pulseStyle}>
        <BrandMark size={132} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
