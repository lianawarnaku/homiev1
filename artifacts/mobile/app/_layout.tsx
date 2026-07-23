import {
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/AuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LaunchScreen } from "@/components/LaunchScreen";
import { AppProvider } from "@/context/AppContext";
import { setBaseUrl } from "@workspace/api-client-react";
import {
  installGlobalRuntimeDiagnostics,
  reportRuntimeError,
} from "@/lib/runtimeDiagnostics";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore if splash screen is not available (web)
});

const queryClient = new QueryClient();

export default function RootLayout() {
  const [showLaunch, setShowLaunch] = useState(true);
  const [fontsLoaded] = useFonts({
    // Keep the established aliases so every existing screen adopts the new
    // condensed Roomie type system without scattered one-off font changes.
    Inter_400Regular: BarlowCondensed_400Regular,
    Inter_500Medium: BarlowCondensed_500Medium,
    Inter_600SemiBold: BarlowCondensed_600SemiBold,
    Inter_700Bold: BarlowCondensed_700Bold,
  });

  useEffect(() => {
    return installGlobalRuntimeDiagnostics();
  }, []);

  useEffect(() => {
    // Hide splash as soon as fonts are ready OR after a short timeout (web fallback)
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Web fallback: always hide splash after 500ms
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const finishLaunch = useCallback(() => setShowLaunch(false), []);

  if (!fontsLoaded) return null;

  if (showLaunch) {
    return (
      <SafeAreaProvider>
        <LaunchScreen onFinish={finishLaunch} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
              <ErrorBoundary
                onError={(error, componentStack) =>
                  reportRuntimeError("React render", error, { componentStack })
                }
              >
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <AuthGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "fade_from_bottom",
                    animationDuration: 220,
                    gestureEnabled: true,
                  }}
                  initialRouteName="(tabs)"
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="settings" options={{ headerShown: false, presentation: "card" }} />
                  <Stack.Screen name="planning" options={{ headerShown: false, presentation: "card" }} />
                  <Stack.Screen name="task-difficulty" options={{ headerShown: false, presentation: "card" }} />
                  <Stack.Screen name="alerts" options={{ headerShown: false, presentation: "card" }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </AuthGate>
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
