import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";

/**
 * Root route — the single gating point for the entire app.
 *
 * Loading priority:
 *   1. Auth still hydrating → spinner
 *   2. No session           → splash / login
 *   3. Session, no household → onboarding
 *   4. Session + household   → main tabs
 */
export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (authLoading || (session && householdLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8D5524" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/splash" />;
  if (!household) return <Redirect href="/(onboarding)" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#FDFAF6",
    alignItems: "center",
    justifyContent: "center",
  },
});
