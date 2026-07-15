import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { HomieLogomark } from "@/components/HomieLogomark";

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo flies in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Text fades in after logo lands
      Animated.timing(textFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Navigate to login after a short pause
        const t = setTimeout(() => router.replace("/(auth)/login"), 1200);
        return () => clearTimeout(t);
      });
    });
  }, [fadeAnim, scaleAnim, textFade]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFAF6" />

      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <HomieLogomark size={96} color="#8D5524" />
      </Animated.View>

      <Animated.View style={{ opacity: textFade }}>
        <Text style={styles.wordmark}>Homie</Text>
        <Text style={styles.tagline}>Home, together.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFAF6",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  logoWrapper: {
    marginBottom: 8,
  },
  wordmark: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    color: "#1A120B",
    textAlign: "center",
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#8D5524",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.2,
  },
});
