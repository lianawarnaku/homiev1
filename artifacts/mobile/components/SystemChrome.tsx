// Keeps the OS chrome in step with the selected accent scheme.
//
// Android's edge-to-edge window (mandatory from SDK 54) draws app content
// under a transparent status bar and nav bar, so icon tone is the only thing
// keeping them legible — and the window background is what shows through
// during screen transitions and behind a dismissed modal.
//
// Renders inside AppProvider so `useTheme()` sees the current scheme.

import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";

import { useTheme } from "@/constants/colors";
import { barStyleForBackground } from "@/lib/contrast";
import { reportRuntimeError } from "@/lib/runtimeDiagnostics";

export function SystemChrome() {
  const colors = useTheme();
  const background = colors.background;

  useEffect(() => {
    // The launch value is set to the brand dark base at module scope in the
    // root layout; once a scheme is known the window should match the app.
    SystemUI.setBackgroundColorAsync(background).catch((error) =>
      reportRuntimeError("set window background color", error),
    );
  }, [background]);

  return <StatusBar style={barStyleForBackground(background)} />;
}
