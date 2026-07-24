// Renders `children` when the user has a Supabase session, otherwise shows
// the sign-in screen. Sits inside AppProvider in the root layout so the rest
// of the app can assume it's always running behind a logged-in user.
//
// The brief loading state (while session or household data is restored) uses
// the same SweetMate tile mark as the native splash for a continuous handoff.

import React from "react";
import type { Session } from "@supabase/supabase-js";
import { HouseLoader } from "./HouseLoader";
import { HouseholdSetupScreen } from "./HouseholdSetupScreen";
import { PreferencesOnboardingScreen } from "./PreferencesOnboardingScreen";
import { SignInScreen } from "./SignInScreen";
import { useAppContext } from "@/context/AppContext";

export function AuthGate({
  children,
  session,
  sessionLoading,
}: {
  children: React.ReactNode;
  session: Session | null;
  sessionLoading: boolean;
}) {
  const {
    householdId,
    householdLoading,
    preferencesLoaded,
    preferencesOnboardingPending,
  } = useAppContext();

  if (sessionLoading) {
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
