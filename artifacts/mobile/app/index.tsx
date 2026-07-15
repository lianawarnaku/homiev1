import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/context/AuthContext";

/**
 * Root route — redirects based on auth state.
 * Shows nothing (spinner) while the Supabase session is hydrating.
 */
export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8D5524" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/splash" />;
  }

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
