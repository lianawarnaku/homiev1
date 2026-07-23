// Renders `children` when the user has a Supabase session, otherwise shows
// the sign-in screen. Sits inside AppProvider in the root layout so the rest
// of the app can assume it's always running behind a logged-in user.
//
// The brief loading tick (first mount, while the session is being restored
// from AsyncStorage) shows a plain spinner — the native splash is already
// visible on top for the first ~500ms, so users usually don't see this.

import React from "react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { HouseLoader } from "./HouseLoader";
import { HouseholdSetupScreen } from "./HouseholdSetupScreen";
import { PreferencesOnboardingScreen } from "./PreferencesOnboardingScreen";
import { SignInScreen } from "./SignInScreen";
import { useAppContext } from "@/context/AppContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSupabaseSession();
  const {
    householdId,
    householdLoading,
    preferencesLoaded,
    preferencesOnboardingPending,
  } = useAppContext();

  if (loading) {
    return <HouseLoader />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  if (householdLoading || !preferencesLoaded) {
    return <HouseLoader />;
  }

  if (!householdId) return <HouseholdSetupScreen />;
  if (preferencesOnboardingPending) return <PreferencesOnboardingScreen />;

  return <>{children}</>;
}
