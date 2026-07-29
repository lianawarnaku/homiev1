import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/constants/colors";

type FeatherIcon = keyof typeof Feather.glyphMap;

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: FeatherIcon;
  onPress: () => void;
  destructive?: boolean;
  confirmation?: {
    title: string;
    message: string;
    confirmLabel: string;
  };
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionMenuItem[];
  onClose: () => void;
};

export function ActionMenuModal({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [confirming, setConfirming] = useState<ActionMenuItem | null>(null);

  useEffect(() => {
    if (visible) {
      setConfirming(null);
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
  }, [progress, visible]);

  const dismiss = () => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const runAction = (action: ActionMenuItem) => {
    if (action.confirmation) {
      setConfirming(action);
      return;
    }
    action.onPress();
    dismiss();
  };

  const confirmAction = () => {
    if (!confirming) return;
    confirming.onPress();
    dismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.46],
              }),
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close action menu"
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14) + 10,
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {confirming?.confirmation ? (
            <>
              <View
                style={[
                  styles.warningIcon,
                  { backgroundColor: colors.destructive + "14" },
                ]}
              >
                <Feather name="alert-triangle" size={22} color={colors.destructive} />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {confirming.confirmation.title}
              </Text>
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                {confirming.confirmation.message}
              </Text>
              <View style={styles.confirmButtons}>
                <Pressable
                  accessibilityRole="button"
                  style={[
                    styles.confirmButton,
                    { backgroundColor: colors.secondary },
                  ]}
                  onPress={() => setConfirming(null)}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      { color: colors.secondaryForeground },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirming.confirmation.confirmLabel}
                  style={[
                    styles.confirmButton,
                    { backgroundColor: colors.destructive },
                  ]}
                  onPress={confirmAction}
                >
                  <Feather name="trash-2" size={16} color={colors.destructiveForeground} />
                  <Text
                    style={[
                      styles.confirmButtonText,
                      { color: colors.destructiveForeground },
                    ]}
                  >
                    {confirming.confirmation.confirmLabel}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
                Actions
              </Text>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.message, { color: colors.mutedForeground }]}>
                  {subtitle}
                </Text>
              ) : null}
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Pressable
                    key={action.key}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    style={({ pressed }) => [
                      styles.action,
                      {
                        backgroundColor: action.destructive
                          ? colors.destructive + (pressed ? "20" : "10")
                          : pressed
                            ? colors.muted
                            : "transparent",
                        borderColor: action.destructive
                          ? colors.destructive + "35"
                          : colors.border,
                      },
                    ]}
                    onPress={() => runAction(action)}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        {
                          backgroundColor: action.destructive
                            ? colors.destructive + "16"
                            : colors.primary + "12",
                        },
                      ]}
                    >
                      <Feather
                        name={action.icon}
                        size={18}
                        color={action.destructive ? colors.destructive : colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionLabel,
                        {
                          color: action.destructive
                            ? colors.destructive
                            : colors.foreground,
                        },
                      ]}
                    >
                      {action.label}
                    </Text>
                    {action.destructive ? (
                      <Text
                        style={[
                          styles.destructiveHint,
                          { color: colors.destructive },
                        ]}
                      >
                        Permanent
                      </Text>
                    ) : (
                      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                    )}
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={dismiss}
              >
                <Text style={[styles.cancelText, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#080B12",
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  actions: { gap: 8, marginTop: 16 },
  action: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  destructiveHint: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  confirmButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },
  confirmButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textAlign: "center",
  },
});
