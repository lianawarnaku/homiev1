import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface RoommateAvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function RoommateAvatar({
  name,
  color,
  size = 36,
}: RoommateAvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + "22",
          borderColor: color + "55",
        },
      ]}
    >
      <Text style={[styles.initials, { color, fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  initials: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
