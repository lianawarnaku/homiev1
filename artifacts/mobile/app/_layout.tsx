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
import * as SystemUI from "expo-system-ui";
import React, { useCallback, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/AuthGate";
import { NavigationThemeProvider } from "@/components/NavigationThemeProvider";
import { SystemChrome } from "@/components/SystemChrome";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QuickGuideModal } from "@/components/QuickGuideModal";
import { NudgeToast } from "@/components/NudgeToast";
import { AnalyticsConsentManager } from "@/components/AnalyticsConsentManager";
import { HouseholdSetupRouteGuard } from "@/components/HouseholdSetupRouteGuard";
import { BRAND_BASE_DARK } from "@/constants/brand";
import { AppProvider } from "@/context/AppContext";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { setBaseUrl } from "@workspace/api-client-react";
import {
  installGlobalRuntimeDiagnostics,
  reportRuntimeError,
} from "@/lib/runtimeDiagnostics";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore if splash screen is not available (web)
});
SplashScreen.setOptions({ duration: 250, fade: true });

// Matches the native launch screen before any theme is known, so the window
// behind the first frame is never the platform default white.
SystemUI.setBackgroundColorAsync(BRAND_BASE_DARK).catch(() => {
  // ignore where the window background is not settable (web)
});

const queryClient = new QueryClient();

export default function RootLayout() {
  // Restore the auth session exactly once. The same result is shared by the
  // provider and gate, and the lookup can finish behind the launch screen.
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [fontsLoaded, fontError] = useFonts({
    // Keep the established aliases so every existing screen adopts the new
    // condensed SweetMate type system without scattered one-off font changes.
    Inter_400Regular: BarlowCondensed_400Regular,
    Inter_500Medium: BarlowCondensed_500Medium,
    Inter_600SemiBold: BarlowCondensed_600SemiBold,
    Inter_700Bold: BarlowCondensed_700Bold,
  });

  useEffect(() => {
    return installGlobalRuntimeDiagnostics();
  }, []);

  // Hand off only once the branded UI has actually laid out. Hiding on the
  // fonts promise alone left a frame where the native splash was gone but
  // nothing had painted yet, which the OS fills with white.
  const splashHidden = useRef(false);
  const onRootLayout = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Returning null keeps the native splash on screen (it is never hidden
  // before the first layout), so there is no blank frame while fonts load.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, componentStack) =>
          reportRuntimeError("React render", error, { componentStack })
        }
      >
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView
            style={{ flex: 1, backgroundColor: BRAND_BASE_DARK }}
            onLayout={onRootLayout}
          >
            <AppProvider session={session}>
              <NavigationThemeProvider>
                <SystemChrome />
                <AnalyticsConsentManager session={session} />
                <AuthGate session={session} sessionLoading={sessionLoading}>
                  <>
                    <HouseholdSetupRouteGuard />
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
                      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                    <QuickGuideModal />
                    <NudgeToast />
                  </>
                </AuthGate>
              </NavigationThemeProvider>
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
