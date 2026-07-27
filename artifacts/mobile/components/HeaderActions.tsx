import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SmoothPressable } from "@/components/SmoothPressable";
import { useTheme } from "@/constants/colors";
import { useAppContextSelector } from "@/context/AppContext";

export function HeaderActions() {
  const colors = useTheme();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { currentProposedChart, currentUserId, nudges, appAlerts, memberships, activeSweetId, switchSweet, leaveSweet } =
    useAppContextSelector((context) => ({
      currentProposedChart: context.currentProposedChart,
      currentUserId: context.currentUserId,
      nudges: context.nudges,
      appAlerts: context.appAlerts,
      memberships: context.memberships,
      activeSweetId: context.activeSweetId,
      switchSweet: context.switchSweet,
      leaveSweet: context.leaveSweet,
    }));
  const hasPendingAlert =
    currentProposedChart?.status === "pending" ||
    nudges.some((nudge) => nudge.toRoommateId === currentUserId && !nudge.seen) ||
    appAlerts.some((alert) => !alert.readAt);

  return (
    <View style={styles.cluster}>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel="Switch Sweet"
        onPress={() => setSwitcherOpen(true)}
        containerStyle={styles.hitArea}
        style={[styles.button, { backgroundColor: colors.muted }]}
      >
        <Feather name="repeat" size={19} color={colors.foreground} />
      </SmoothPressable>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel="Open household alerts"
        onPress={() => router.push("/alerts")}
        containerStyle={styles.hitArea}
        style={[styles.button, { backgroundColor: colors.muted }]}
      >
        <Feather name="bell" size={20} color={colors.foreground} />
        {hasPendingAlert && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.destructive, borderColor: colors.muted },
            ]}
          />
        )}
      </SmoothPressable>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={() => router.push("/settings")}
        containerStyle={styles.hitArea}
        style={[styles.button, { backgroundColor: colors.muted }]}
      >
        <Feather name="settings" size={20} color={colors.foreground} />
      </SmoothPressable>
      <Modal visible={switcherOpen} transparent animationType="slide" onRequestClose={() => setSwitcherOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSwitcherOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Switch Sweet</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>Choose which household to view</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSwitcherOpen(false)}
              style={[styles.closeButton, { backgroundColor: colors.muted }]}
              accessibilityLabel="Close Sweet switcher"
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.membershipList}>
            {memberships.map((membership) => {
              const selected = membership.sweetId === activeSweetId;
              return (
                <TouchableOpacity
                  key={membership.id}
                  style={[
                    styles.membershipRow,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "0F" : colors.background },
                  ]}
                  onPress={() => {
                    switchSweet(membership.sweetId);
                    setSwitcherOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${membership.name}, ${membership.role}, ${membership.memberCount ?? 1} members${selected ? ", selected" : ""}`}
                >
                  <View style={[styles.sweetIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="home" size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.sweetName, { color: colors.foreground }]} numberOfLines={1}>{membership.name}</Text>
                    <Text style={[styles.sweetMeta, { color: colors.mutedForeground }]}>
                      {membership.role === "owner" ? "Host" : "Member"} · {membership.memberCount ?? 1} {(membership.memberCount ?? 1) === 1 ? "member" : "members"}
                    </Text>
                  </View>
                  {selected && <Feather name="check-circle" size={20} color={colors.primary} />}
                  <TouchableOpacity
                    onPress={(event) => {
                      event.stopPropagation();
                      Alert.alert(
                      `Leave ${membership.name}?`,
                      "You will lose access to this Sweet’s shared data. Your other Sweets are not affected.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Leave",
                          style: "destructive",
                          onPress: () => void leaveSweet(membership.sweetId).catch((error) =>
                            Alert.alert("Unable to leave", error instanceof Error ? error.message : "Please try again."),
                          ),
                        },
                      ],
                      );
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Leave ${membership.name}`}
                  >
                    <Feather name="log-out" size={17} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.switcherActions}>
            <TouchableOpacity
              style={[styles.switcherButton, { borderColor: colors.border }]}
              onPress={() => {
                setSwitcherOpen(false);
                router.push("/sweet-setup" as never);
              }}
            >
              <Feather name="plus-circle" size={18} color={colors.primary} />
              <Text style={[styles.switcherButtonText, { color: colors.foreground }]}>Create or join a Sweet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hitArea: {
    width: 44,
    height: 44,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 9,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, paddingBottom: 30 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  sheetSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  membershipList: { gap: 9 },
  membershipRow: { minHeight: 64, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  sweetIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sweetName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sweetMeta: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  switcherActions: { marginTop: 14 },
  switcherButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  switcherButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
