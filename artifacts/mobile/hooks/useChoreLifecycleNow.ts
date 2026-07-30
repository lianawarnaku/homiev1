import { useEffect, useState } from "react";
import { AppState } from "react-native";

import type { Chore } from "@/context/AppContext";
import { completedRetentionBoundary } from "@/lib/choreLifecycle";
import { choreNow } from "@/lib/choreClock";

export function useChoreLifecycleNow(chores: Chore[]): Date {
  const [now, setNow] = useState(choreNow);

  useEffect(() => {
    const current = choreNow();
    const nextMidnight = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    );
    const nextRetentionBoundary = chores.reduce<number | null>((nearest, chore) => {
      const boundary = completedRetentionBoundary(chore)?.getTime();
      if (!boundary || boundary <= current.getTime()) return nearest;
      return nearest === null || boundary < nearest ? boundary : nearest;
    }, null);
    const nextRefresh = Math.min(
      nextMidnight.getTime(),
      nextRetentionBoundary ?? Number.POSITIVE_INFINITY,
    );
    const timer = setTimeout(
      () => setNow(choreNow()),
      Math.max(1, nextRefresh - current.getTime() + 25),
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(choreNow());
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [chores, now]);

  return now;
}
