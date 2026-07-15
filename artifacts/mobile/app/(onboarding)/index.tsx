import { router } from "expo-router";
import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import { HomieLogomark } from "@/components/HomieLogomark";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingIndex() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFAF6" />

      <View style={styles.top}>
        <HomieLogomark size={64} color="#8D5524" />
        <Text style={styles.title}>Welcome to Homie</Text>
        <Text style={styles.subtitle}>
          Create a new household or join one your roommates already set up.
        </Text>
      </View>

      <View style={styles.cards}>
        {/* Create */}
        <Pressable
          style={styles.cardPrimary}
          onPress={() => router.push("/(onboarding)/create")}
        >
          <Text style={styles.cardEmoji}>🏠</Text>
          <Text style={[styles.cardTitle, { color: "#FFF" }]}>Create a household</Text>
          <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.8)" }]}>
            Set up your shared space and invite roommates with a 6-digit code.
          </Text>
        </Pressable>

        {/* Join */}
        <Pressable
          style={styles.cardSecondary}
          onPress={() => router.push("/(onboarding)/join")}
        >
          <Text style={styles.cardEmoji}>🔑</Text>
          <Text style={[styles.cardTitle, { color: "#1A120B" }]}>Join a household</Text>
          <Text style={[styles.cardDesc, { color: "#7A6652" }]}>
            Enter the invite code your roommate shared with you.
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={signOut} style={styles.signOutRow}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFAF6",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  top: { alignItems: "center", gap: 12 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#1A120B",
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#7A6652",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  cards: { gap: 14 },
  cardPrimary: {
    backgroundColor: "#8D5524",
    borderRadius: 20,
    padding: 24,
    gap: 6,
  },
  cardSecondary: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 20,
    padding: 24,
    gap: 6,
  },
  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  signOutRow: { alignItems: "center" },
  signOutText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#B0A090" },
});
