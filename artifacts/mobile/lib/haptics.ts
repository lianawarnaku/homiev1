import * as Haptics from "expo-haptics";

const safely = (effect: Promise<void>) => {
  effect.catch(() => {
    // Haptics can be unavailable on web/simulator; feedback must never block UI.
  });
};

export function tapLight() {
  safely(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function success() {
  safely(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function error() {
  safely(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
