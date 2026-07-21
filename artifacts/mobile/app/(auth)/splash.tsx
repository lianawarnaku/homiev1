import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

// Logo canvas dimensions (matches HomieLogomark viewBox scale at size=96)
const W = 96;
const H = 104; // 96 × 1.08
const VIEWBOX = "0 0 100 108";
const COLOR = "#8D5524";
const ROOF =
  "M 46.3,21.4 L 23.7,42.6 Q 20,46 25,46 L 75,46 Q 80,46 76.3,42.6 L 53.7,21.4 Q 50,18 46.3,21.4 Z";

// Where each block starts before converging (px offset from its natural position)
const SPREADS: { x: number; y: number }[] = [
  { x: 0,   y: -50 }, // roof   — drops from above
  { x: -50, y: -20 }, // top-left  — slides from left
  { x: 50,  y: -20 }, // top-right — slides from right
  { x: -50, y: 30  }, // bottom-left  — slides from left
  { x: 50,  y: 30  }, // bottom-right — slides from right
];

export default function SplashScreen() {
  const blockAnims = useRef(
    SPREADS.map(({ x, y }) => ({
      x: new Animated.Value(x),
      y: new Animated.Value(y),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // All blocks fade + spring into position simultaneously
    const converge = Animated.parallel(
      blockAnims.flatMap(({ x, y, opacity }) => [
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(x, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.spring(y, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
      ])
    );

    // Gentle breathe loop
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.10,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    converge.start(() => {
      pulseLoop.current?.start();
    });

    // Navigate after blocks land + 2 pulse cycles
    const timer = setTimeout(() => {
      pulseLoop.current?.stop();
      router.replace("/(auth)/login");
    }, 2800);

    return () => {
      clearTimeout(timer);
      pulseLoop.current?.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFAF6" />

      {/* Each block is absolutely stacked; only their transforms differ */}
      <Animated.View style={[styles.logo, { transform: [{ scale: pulse }] }]}>
        {/* Roof */}
        <Animated.View
          style={[
            styles.block,
            {
              opacity: blockAnims[0].opacity,
              transform: [
                { translateX: blockAnims[0].x },
                { translateY: blockAnims[0].y },
              ],
            },
          ]}
        >
          <Svg width={W} height={H} viewBox={VIEWBOX}>
            <Path d={ROOF} fill={COLOR} />
          </Svg>
        </Animated.View>

        {/* Top-left square */}
        <Animated.View
          style={[
            styles.block,
            {
              opacity: blockAnims[1].opacity,
              transform: [
                { translateX: blockAnims[1].x },
                { translateY: blockAnims[1].y },
              ],
            },
          ]}
        >
          <Svg width={W} height={H} viewBox={VIEWBOX}>
            <Rect x={27} y={48} width={22} height={22} rx={4} ry={4} fill={COLOR} />
          </Svg>
        </Animated.View>

        {/* Top-right square */}
        <Animated.View
          style={[
            styles.block,
            {
              opacity: blockAnims[2].opacity,
              transform: [
                { translateX: blockAnims[2].x },
                { translateY: blockAnims[2].y },
              ],
            },
          ]}
        >
          <Svg width={W} height={H} viewBox={VIEWBOX}>
            <Rect x={51} y={48} width={22} height={22} rx={4} ry={4} fill={COLOR} />
          </Svg>
        </Animated.View>

        {/* Bottom-left square */}
        <Animated.View
          style={[
            styles.block,
            {
              opacity: blockAnims[3].opacity,
              transform: [
                { translateX: blockAnims[3].x },
                { translateY: blockAnims[3].y },
              ],
            },
          ]}
        >
          <Svg width={W} height={H} viewBox={VIEWBOX}>
            <Rect x={27} y={72} width={22} height={22} rx={4} ry={4} fill={COLOR} />
          </Svg>
        </Animated.View>

        {/* Bottom-right square */}
        <Animated.View
          style={[
            styles.block,
            {
              opacity: blockAnims[4].opacity,
              transform: [
                { translateX: blockAnims[4].x },
                { translateY: blockAnims[4].y },
              ],
            },
          ]}
        >
          <Svg width={W} height={H} viewBox={VIEWBOX}>
            <Rect x={51} y={72} width={22} height={22} rx={4} ry={4} fill={COLOR} />
          </Svg>
        </Animated.View>
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
  },
  logo: {
    width: W,
    height: H,
  },
  block: {
    ...StyleSheet.absoluteFillObject,
  },
});
