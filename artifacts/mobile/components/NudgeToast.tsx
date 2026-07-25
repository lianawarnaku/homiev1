import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/constants/colors";
import { useAppContextSelector } from "@/context/AppContext";
import { reportRuntimeError } from "@/lib/runtimeDiagnostics";

const DELIVERY_KEY_PREFIX = "sweetmate:nudge-toast-delivery:v1";
const VISUAL_DURATION_MS = 1000;

export function NudgeToast() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUserId, nudges, nudgesReady } = useAppContextSelector(
    (context) => ({
      currentUserId: context.currentUserId,
      nudges: context.nudges,
      nudgesReady: context.nudgesReady,
    }),
  );
  const [storageReady, setStorageReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === "active",
  );
  const deliveredRef = useRef(new Set<string>());
  const hadDeliveryRecordRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const batchRef = useRef<string[]>([]);
  const queuedCountRef = useRef(0);
  const visibleRef = useRef(false);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `${DELIVERY_KEY_PREFIX}:${currentUserId}`;

  const persistDelivered = () => {
    const recentIds = [...deliveredRef.current].slice(-250);
    void AsyncStorage.setItem(storageKey, JSON.stringify(recentIds)).catch(
      (error) => {
        reportRuntimeError("persist anonymous nudge toast delivery", error);
      },
    );
  };

  const showCount = (count: number) => {
    if (count <= 0) return;
    if (visibleRef.current) {
      queuedCountRef.current += count;
      return;
    }
    const nextMessage =
      count === 1 ? "You received a nudge" : `You received ${count} new nudges`;
    visibleRef.current = true;
    setMessage(nextMessage);
    AccessibilityInfo.announceForAccessibility(
      count === 1
        ? "You received a nudge. Someone in your Sweet sent you a reminder."
        : `${nextMessage}. Someone in your Sweet sent you reminders.`,
    );
    hideTimerRef.current = setTimeout(() => {
      visibleRef.current = false;
      setMessage(null);
      const queued = queuedCountRef.current;
      queuedCountRef.current = 0;
      if (queued > 0) {
        hideTimerRef.current = setTimeout(() => showCount(queued), 100);
      }
    }, VISUAL_DURATION_MS);
  };

  useEffect(() => {
    let active = true;
    setStorageReady(false);
    deliveredRef.current = new Set();
    hadDeliveryRecordRef.current = false;
    mountedAtRef.current = Date.now();
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          const ids = JSON.parse(raw) as unknown;
          if (Array.isArray(ids)) {
            deliveredRef.current = new Set(
              ids.filter((id): id is string => typeof id === "string"),
            );
          }
          hadDeliveryRecordRef.current = true;
        }
      })
      .catch((error) => {
        reportRuntimeError("load anonymous nudge toast delivery", error);
      })
      .finally(() => {
        if (active) setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!storageReady || !nudgesReady || !appIsActive) return;
    const received = nudges.filter(
      (nudge) => nudge.toRoommateId === currentUserId,
    );
    const newNudges = received.filter(
      (nudge) =>
        !deliveredRef.current.has(nudge.id) &&
        (hadDeliveryRecordRef.current ||
          new Date(nudge.sentAt).getTime() >= mountedAtRef.current),
    );

    // On the first versioned run, establish a baseline for historical nudges
    // instead of replaying an old unread backlog.
    received.forEach((nudge) => deliveredRef.current.add(nudge.id));
    hadDeliveryRecordRef.current = true;
    persistDelivered();
    if (!newNudges.length) return;

    batchRef.current.push(...newNudges.map((nudge) => nudge.id));
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(() => {
      const count = new Set(batchRef.current).size;
      batchRef.current = [];
      showCount(count);
    }, 140);
  }, [appIsActive, currentUserId, nudges, nudgesReady, storageReady]);

  useEffect(() => () => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          top: insets.top + 10,
          backgroundColor: colors.foreground,
          shadowColor: colors.foreground,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.background }]}>{message}</Text>
      <Text style={[styles.copy, { color: colors.background }]}>
        Someone in your Sweet sent you a reminder.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 1000,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    opacity: 0.96,
    elevation: 8,
    shadowOpacity: Platform.OS === "ios" ? 0.18 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  copy: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
});
