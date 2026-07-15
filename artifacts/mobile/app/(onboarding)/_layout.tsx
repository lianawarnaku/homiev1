import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
    </Stack>
  );
}
