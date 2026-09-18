import { Feather } from "@expo/vector-icons";
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/constants/colors";
import { androidRipple } from "@/lib/ripple";

export function HistoryDisclosure({
  count,
  expanded,
  onToggle,
  children,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const colors = useTheme();
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`History, ${count} records`}
        onPress={onToggle}
        android_ripple={androidRipple(colors.foreground)}
        style={[
          styles.header,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="archive" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>
          History ({count})
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={19}
          color={colors.mutedForeground}
        />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  header: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  title: { flex: 1, fontFamily: "Inter_600SemiBold", includeFontPadding: false, fontSize: 15 },
});
