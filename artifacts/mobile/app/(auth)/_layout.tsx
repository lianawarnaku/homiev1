import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="login" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="register" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
