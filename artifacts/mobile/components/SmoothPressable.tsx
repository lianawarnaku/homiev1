import React from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/constants/colors";
import { tapLight } from "@/lib/haptics";
import { androidRipple } from "@/lib/ripple";

type SmoothPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  haptic?: boolean;
  /** Icon-only controls ripple past their bounds instead of being clipped. */
  rippleBorderless?: boolean;
  rippleRadius?: number;
};

export function SmoothPressable({
  style,
  containerStyle,
  haptic = true,
  rippleBorderless = false,
  rippleRadius,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: SmoothPressableProps) {
  const colors = useTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.08,
    transform: [{ scale: 1 - pressed.value * 0.025 }],
  }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...props}
        disabled={disabled}
        android_ripple={androidRipple(colors.foreground, {
          borderless: rippleBorderless,
          radius: rippleRadius,
        })}
        // A bounded ripple is clipped to the rounded shape only when the
        // pressable itself hides its overflow.
        style={[style, rippleBorderless ? null : styles.clipRipple]}
        onPress={(event) => {
          if (haptic) tapLight();
          onPress?.(event);
        }}
        onPressIn={(event) => {
          pressed.value = withTiming(1, { duration: 90 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressed.value = withTiming(0, { duration: 140 });
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clipRipple: { overflow: "hidden" },
});
