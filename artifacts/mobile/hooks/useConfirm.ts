import { Alert } from "react-native";
import { useAppContext } from "@/context/AppContext";

type ConfirmOpts = {
  confirmText?: string;
  destructive?: boolean;
};

export function useConfirm() {
  const { suppressedAlerts, suppressAlert } = useAppContext();

  function confirm(
    id: string,
    title: string,
    message: string,
    onConfirm: () => void,
    opts: ConfirmOpts = {}
  ) {
    if (suppressedAlerts[id]) {
      onConfirm();
      return;
    }
    const { confirmText = "OK", destructive = false } = opts;
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: onConfirm,
      },
      {
        text: "Don't show again",
        onPress: () => {
          suppressAlert(id);
          onConfirm();
        },
      },
    ]);
  }

  function info(id: string, title: string, message: string) {
    if (suppressedAlerts[id]) return;
    Alert.alert(title, message, [
      { text: "Got it" },
      {
        text: "Don't show again",
        onPress: () => suppressAlert(id),
      },
    ]);
  }

  return { confirm, info };
}
