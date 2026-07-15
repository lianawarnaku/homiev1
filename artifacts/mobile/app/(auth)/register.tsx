import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { HomieLogomark } from "@/components/HomieLogomark";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!displayName || !email || !password || !confirm) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Password mismatch", "Your passwords don't match.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert(
        "Check your email",
        "We sent a confirmation link to " + email + ". Click it to activate your account.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FDFAF6" />

        {/* Back */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <HomieLogomark size={48} color="#8D5524" />
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join or start a Homie household</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex"
              placeholderTextColor="#B0A090"
              autoCapitalize="words"
              returnKeyType="next"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#B0A090"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor="#B0A090"
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#B0A090"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>

          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <Pressable style={styles.signinRow} onPress={() => router.back()}>
          <Text style={styles.signinText}>
            Already have an account?{" "}
            <Text style={styles.signinLink}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FDFAF6",
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 24,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#8D5524",
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#1A120B",
    marginTop: 14,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#7A6652",
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#4A3728",
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#1A120B",
    backgroundColor: "#FFF",
  },
  primaryBtn: {
    height: 52,
    backgroundColor: "#8D5524",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#8D5524",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
    letterSpacing: 0.2,
  },
  signinRow: {
    alignItems: "center",
    marginTop: 28,
  },
  signinText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#7A6652",
  },
  signinLink: {
    fontFamily: "Inter_600SemiBold",
    color: "#8D5524",
  },
});
