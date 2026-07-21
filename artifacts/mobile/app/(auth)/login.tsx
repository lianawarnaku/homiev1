import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

// Map Supabase raw error messages → readable copy
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (m.includes("user not found") || m.includes("no user found"))
    return "No account found with that email address.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  return msg;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [debugStatus, setDebugStatus] = useState("");

  function clearError() {
    if (error) setError("");
    if (debugStatus) setDebugStatus("");
  }

  // ── Email / password ──────────────────────────────────────────────────────
  async function handleEmailSignIn() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setDebugStatus("Contacting Supabase…");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setDebugStatus("");
        setError(friendlyError(authError.message) + ` [${authError.message}]`);
        return;
      }

      if (!data.session) {
        setDebugStatus("");
        setError(
          "Sign in completed but no session was returned. " +
          "Your email may not be confirmed — delete your account in the Supabase dashboard and register again in the app."
        );
        return;
      }

      setDebugStatus("Signed in — checking household…");

      // Query the household directly — don't rely on context timing
      const { data: membership, error: memberErr } = await supabase
        .from("household_members")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (memberErr) {
        setDebugStatus("");
        setError(`Household check failed: ${memberErr.message}`);
        return;
      }

      const dest = membership ? "/(tabs)" : "/(onboarding)";
      setDebugStatus(membership ? "Household found — opening app…" : "No household — going to setup…");
      router.replace(dest);
    } catch (e: any) {
      console.error("[login] caught exception:", e);
      setDebugStatus("");
      setError(`Unexpected error: ${e.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const redirectTo = makeRedirectUri();

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (oauthError || !data.url) {
        setError(friendlyError(oauthError?.message ?? "Google sign-in failed."));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === "success") {
        await supabase.auth.exchangeCodeForSession(result.url);
      }
    } catch (e: any) {
      setError(friendlyError(e.message));
    } finally {
      setGoogleLoading(false);
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

        {/* Logo + wordmark */}
        <View style={styles.header}>
          <HomieLogomark size={56} color="#8D5524" />
          <Text style={styles.wordmark}>Homie</Text>
          <Text style={styles.subtitle}>Sign in to your household</Text>
        </View>

        {/* Email / password form */}
        <View style={styles.form}>
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
              onChangeText={(v) => { setEmail(v); clearError(); }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#B0A090"
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleEmailSignIn}
              value={password}
              onChangeText={(v) => { setPassword(v); clearError(); }}
            />
          </View>

          <Pressable style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {!!debugStatus && (
            <View style={styles.debugBox}>
              <Text style={styles.debugText}>{debugStatus}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleEmailSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google */}
        <Pressable
          style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#444" />
          ) : (
            <>
              <GoogleIcon />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Registration is invite-only — not advertised publicly */}
        <Pressable
          style={styles.signupRow}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.signupText}>
            Joining a household?{" "}
            <Text style={styles.signupLink}>Register here</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Minimal Google "G" icon using only RN primitives to avoid extra deps
function GoogleIcon() {
  return (
    <View style={googleIconStyles.container}>
      <Text style={googleIconStyles.g}>G</Text>
    </View>
  );
}

const googleIconStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  g: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
});

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FDFAF6",
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 40,
    alignItems: "stretch",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  wordmark: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#1A120B",
    marginTop: 12,
    letterSpacing: -0.5,
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
  debugBox: {
    backgroundColor: "#EEF4FF",
    borderRadius: 10,
    padding: 12,
  },
  debugText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#3B5998",
    textAlign: "center",
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#8D5524",
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2D5C8",
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#B0A090",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
  },
  googleBtn: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  googleBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "#2C2016",
  },
  signupRow: {
    alignItems: "center",
    marginTop: 28,
  },
  signupText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#7A6652",
  },
  signupLink: {
    fontFamily: "Inter_600SemiBold",
    color: "#8D5524",
  },
});
