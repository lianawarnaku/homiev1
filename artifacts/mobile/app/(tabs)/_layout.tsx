import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/constants/colors";
import { useAppContext } from "@/context/AppContext";
import { SmoothPressable } from "@/components/SmoothPressable";

function ScrollableTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useTheme();
  const { pointsEnabled } = useAppContext();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  // Expo Router auto-registers every route file, even when its Tabs.Screen
  // configuration is conditionally omitted. Remove the route from the array
  // we actually render so it creates neither a button nor a flex slot.
  const visibleRoutes = state.routes.filter(
    (route) => pointsEnabled || route.name !== "leaderboard"
  );
  const focusedRouteKey = state.routes[state.index]?.key;

  return (
    <View
      style={[
        styles.tabBarShell,
        {
          bottom: isWeb ? 12 : Math.max(insets.bottom, 8),
          borderColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={52} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.translucentTint]} />
      <View style={styles.tabBarContent}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = focusedRouteKey === route.key;
          const color = focused ? colors.primary : colors.mutedForeground;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : typeof options.title === "string"
                ? options.title
                : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <SmoothPressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              containerStyle={styles.tabItemSlot}
              style={[styles.tabItem, focused && { backgroundColor: colors.secondary }]}
            >
              <View style={styles.iconSlot}>
                {options.tabBarIcon?.({ focused, color, size: 21 })}
              </View>
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </SmoothPressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useTheme();
  const { pointsEnabled } = useAppContext();

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} />}
      detachInactiveScreens
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        // Keep a visited tab's component/state alive, but freeze inactive
        // native screens so household sync updates do not spend a frame
        // rendering five invisible page trees.
        lazy: true,
        freezeOnBlur: Platform.OS !== "web",
        animation: "fade",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Sweet",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: "Group",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color }) => (
            <Feather name="dollar-sign" size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Shopping",
          tabBarIcon: ({ color }) => (
            <Feather name="shopping-cart" size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="borrow"
        options={{
          title: "Borrow",
          tabBarIcon: ({ color }) => (
            <Feather name="repeat" size={19} color={color} />
          ),
        }}
      />
      {pointsEnabled && (
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Ranks",
            tabBarIcon: ({ color }) => (
              <Feather name="award" size={21} color={color} />
            ),
          }}
        />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 68,
    borderWidth: 1,
    borderRadius: 28,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#3D2B20",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  translucentTint: { backgroundColor: "rgba(255, 252, 247, 0.68)" },
  tabBarContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tabItemSlot: { flex: 1, height: 54, maxWidth: 76 },
  tabItem: {
    flex: 1,
    width: "100%",
    height: 54,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
  },
  iconSlot: {
    width: 28,
    height: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabLabel: { fontSize: 10, lineHeight: 12, fontFamily: "Inter_500Medium" },
});
