import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Warm "brown on white" accent palette for the bar. Kept local so it doesn't
// disturb the app-wide tokens in constants/colors.ts.
const ACTIVE = "#8B5E34"; // warm brown
const ACTIVE_BG = "rgba(139, 94, 52, 0.14)"; // translucent brown highlight
const INACTIVE = "#A89F97"; // warm neutral gray
const HAIRLINE = "rgba(120, 90, 60, 0.14)"; // subtle warm border

/**
 * Moonly-inspired floating tab bar: a rounded, frosted/translucent pill that
 * hovers above a warm-white surface. The active tab's icon sits in a rounded
 * "brown" highlight (like Moonly's moon), with the label beneath.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView
        intensity={isWeb ? 20 : 40}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={styles.bar}
      >
        {/* Frosted overlay so the pill reads as glass on the light background */}
        <View style={styles.frost} pointerEvents="none" />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const focused = state.index === index;
          const color = focused ? ACTIVE : INACTIVE;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              if (!isWeb) Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, focused && { backgroundColor: ACTIVE_BG }]}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color, fontFamily: focused ? "Inter_600SemiBold" : "Inter_500Medium" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Normal flow so the tab bar reserves space (content never hides beneath
    // it). The pill inside still reads as a floating, frosted element.
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "#F8F6F3", // matches the app's warm-white background
    alignItems: "stretch",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    overflow: "hidden",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    // Soft float shadow
    shadowColor: "#3B2A1A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.62)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconWrap: {
    width: 42,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.1,
  },
});
