import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MARK_SIZE = 224;

function Roof() {
  return (
    <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 256 256" style={StyleSheet.absoluteFill}>
      <Defs><BrownGradient /></Defs>
      <Path d="M128 35c4.3 0 8.3 1.7 11.4 4.7l82.8 80.6c5.4 5.3 1.7 14.5-5.9 14.5H39.7c-7.6 0-11.3-9.2-5.9-14.5l82.8-80.6c3.1-3 7.1-4.7 11.4-4.7Z" fill="url(#brown)" />
    </Svg>
  );
}

function Block({ x, y }: { x: number; y: number }) {
  return (
    <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 256 256" style={StyleSheet.absoluteFill}>
      <Defs><BrownGradient /></Defs>
      <Rect x={x} y={y} width="58" height="52" rx="13" fill="url(#brown)" />
    </Svg>
  );
}

function BrownGradient() {
  return (
    <LinearGradient id="brown" x1="42" y1="28" x2="218" y2="232">
      <Stop offset="0" stopColor="#8D4F1C" />
      <Stop offset="0.55" stopColor="#A56529" />
      <Stop offset="1" stopColor="#8F501D" />
    </LinearGradient>
  );
}

export function LaunchScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const pieces = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyY = useRef(new Animated.Value(14)).current;

  const pieceStyles = useMemo(
    () => [
      { opacity: pieces[0], transform: [{ translateY: pieces[0].interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }, { scale: pieces[0].interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] },
      { opacity: pieces[1], transform: [{ translateX: pieces[1].interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }, { translateY: pieces[1].interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      { opacity: pieces[2], transform: [{ translateX: pieces[2].interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }, { translateY: pieces[2].interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      { opacity: pieces[3], transform: [{ translateX: pieces[3].interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }, { translateY: pieces[3].interpolate({ inputRange: [0, 1], outputRange: [55, 0] }) }] },
      { opacity: pieces[4], transform: [{ translateX: pieces[4].interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }, { translateY: pieces[4].interpolate({ inputRange: [0, 1], outputRange: [55, 0] }) }] },
    ],
    [pieces]
  );

  useEffect(() => {
    const assemble = Animated.stagger(
      105,
      pieces.map((value) =>
        Animated.spring(value, { toValue: 1, damping: 13, stiffness: 125, mass: 0.72, useNativeDriver: true })
      )
    );
    const animation = Animated.sequence([
      assemble,
      Animated.parallel([
        Animated.timing(copyOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(copyY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(700),
    ]);

    animation.start(({ finished }) => finished && onFinish());
    return () => animation.stop();
  }, [copyOpacity, copyY, onFinish, pieces]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.content}>
        <View style={styles.markStage}>
          <Animated.View style={[styles.piece, pieceStyles[0]]}><Roof /></Animated.View>
          <Animated.View style={[styles.piece, pieceStyles[1]]}><Block x={64} y={139} /></Animated.View>
          <Animated.View style={[styles.piece, pieceStyles[2]]}><Block x={134} y={139} /></Animated.View>
          <Animated.View style={[styles.piece, pieceStyles[3]]}><Block x={64} y={198} /></Animated.View>
          <Animated.View style={[styles.piece, pieceStyles[4]]}><Block x={134} y={198} /></Animated.View>
        </View>

        <Animated.View style={[styles.copy, { opacity: copyOpacity, transform: [{ translateY: copyY }] }]}>
          <Text style={styles.wordmark}>Homie</Text>
          <Text style={styles.tagline}>The home for your roomies</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF6F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  content: { alignItems: "center", marginTop: -30 },
  markStage: { width: MARK_SIZE, height: MARK_SIZE, position: "relative" },
  piece: { ...StyleSheet.absoluteFillObject },
  copy: { alignItems: "center", marginTop: 28 },
  wordmark: { color: "#96571F", fontFamily: "Inter_700Bold", fontSize: 52, letterSpacing: -2.1 },
  tagline: { color: "#5F432D", fontFamily: "Inter_400Regular", fontSize: 18, marginTop: 10 },
});
