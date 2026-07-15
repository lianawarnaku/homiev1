import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";

type HouseholdPreview = {
  id: string;
  name: string;
  housing_type: string;
  member_count: number;
};

export default function JoinHousehold() {
  const { user } = useAuth();
  const { refresh } = useHousehold();

  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name ?? ""
  );
  const [preview, setPreview] = useState<HouseholdPreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Look up the code ──────────────────────────────────────────────────
  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert("Enter a code", "Invite codes are at least 4 characters.");
      return;
    }
    setLooking(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.rpc("find_household_by_code", {
        code: trimmed,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert("Not found", "No household matched that code. Check with your roommate.");
        return;
      }
      setPreview(data[0] as HouseholdPreview);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong.");
    } finally {
      setLooking(false);
    }
  }

  // ── Join the household ────────────────────────────────────────────────
  async function handleJoin() {
    if (!preview || !displayName.trim()) {
      Alert.alert("Missing info", "Please enter your display name.");
      return;
    }
    setJoining(true);
    try {
      const { error } = await supabase.from("household_members").insert({
        household_id: preview.id,
        user_id: user!.id,
        display_name: displayName.trim(),
        role: "member",
      });
      if (error) throw error;
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not join. You may already be a member.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Join a household</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit invite code from your roommate.
          </Text>

          {/* Code input */}
          <View style={styles.codeRow}>
            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              placeholder="e.g. A3F9B2"
              placeholderTextColor="#B0A090"
              autoCapitalize="characters"
              maxLength={8}
              returnKeyType="search"
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setPreview(null);
              }}
              onSubmitEditing={handleLookup}
            />
            <Pressable
              style={[styles.lookupBtn, looking && styles.btnDisabled]}
              onPress={handleLookup}
              disabled={looking}
            >
              {looking ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.lookupText}>Find</Text>
              )}
            </Pressable>
          </View>

          {/* Preview card */}
          {preview && (
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>{preview.name}</Text>
              <Text style={styles.previewMeta}>
                {preview.housing_type.replace("_", " ")} ·{" "}
                {preview.member_count}{" "}
                {preview.member_count === 1 ? "member" : "members"} so far
              </Text>

              <View style={styles.divider} />

              <Text style={styles.label}>Your display name</Text>
              <TextInput
                style={styles.input}
                placeholder="What should your roommates call you?"
                placeholderTextColor="#B0A090"
                autoCapitalize="words"
                value={displayName}
                onChangeText={setDisplayName}
              />

              <Pressable
                style={[styles.joinBtn, joining && styles.btnDisabled]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.joinBtnText}>Join {preview.name}</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFAF6" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#8D5524" },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#1A120B",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#7A6652",
    lineHeight: 21,
  },
  codeRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: "#1A120B",
    backgroundColor: "#FFF",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  lookupBtn: {
    width: 70,
    height: 52,
    backgroundColor: "#8D5524",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  lookupText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
  },
  btnDisabled: { opacity: 0.5 },
  previewCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    padding: 20,
    gap: 12,
  },
  previewName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#1A120B",
  },
  previewMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#7A6652",
    textTransform: "capitalize",
  },
  divider: { height: 1, backgroundColor: "#EDE3D8" },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#4A3728" },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#1A120B",
    backgroundColor: "#FDFAF6",
  },
  joinBtn: {
    height: 52,
    backgroundColor: "#8D5524",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  joinBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
});
