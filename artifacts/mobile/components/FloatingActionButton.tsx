import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import { StyleSheet } from "react-native";

import { SmoothPressable } from "@/components/SmoothPressable";
import { useTheme } from "@/constants/colors";
import { elevationStyle } from "@/lib/elevation";
import { useTabBarLayout } from "@/hooks/useTabBarLayout";

const FAB_SIZE = 56;
const FAB_TAB_GAP = 12;
const FAB_CONTENT_GAP = 16;

export function useFloatingActionMetrics() {
  const { tabBarInset } = useTabBarLayout();
  const bottom = tabBarInset + FAB_TAB_GAP;

  return {
    bottom,
    scrollBottomPadding: bottom + FAB_SIZE + FAB_CONTENT_GAP,
  };
}

export function FloatingActionButton({
  onPress,
  accessibilityLabel,
  icon = "plus",
}: {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const colors = useTheme();
  const { bottom } = useFloatingActionMetrics();
  const pressLocked = useRef(false);

  return (
    <SmoothPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      containerStyle={[styles.container, { bottom }]}
      rippleBorderless
      rippleRadius={FAB_SIZE / 2}
      style={[
        styles.button,
        // The shadow lives on the button, not the container: Android needs a
        // solid background under an elevated view or it draws nothing.
        elevationStyle("raised", colors.foreground),
        { backgroundColor: colors.primary },
      ]}
      onPress={() => {
        if (pressLocked.current) return;
        pressLocked.current = true;
        onPress();
        setTimeout(() => {
          pressLocked.current = false;
        }, 450);
      }}
    >
      <Feather name={icon} size={25} color={colors.primaryForeground} />
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 20,
  },
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
