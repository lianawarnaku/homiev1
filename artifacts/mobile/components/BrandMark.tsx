import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export const ROOMIE_BROWN = "#111111";

export function BrandMark({
  size = 180,
  color,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
      <Defs>
        <LinearGradient id="roomieBrown" x1="42" y1="28" x2="218" y2="232">
          <Stop offset="0" stopColor={color ?? ROOMIE_BROWN} />
          <Stop offset="0.55" stopColor={color ?? ROOMIE_BROWN} />
          <Stop offset="1" stopColor={color ?? ROOMIE_BROWN} />
        </LinearGradient>
      </Defs>
      <Path
        d="M128 35c4.3 0 8.3 1.7 11.4 4.7l82.8 80.6c5.4 5.3 1.7 14.5-5.9 14.5H39.7c-7.6 0-11.3-9.2-5.9-14.5l82.8-80.6c3.1-3 7.1-4.7 11.4-4.7Z"
        fill="url(#roomieBrown)"
      />
      <Rect x="64" y="139" width="58" height="52" rx="13" fill="url(#roomieBrown)" />
      <Rect x="134" y="139" width="58" height="52" rx="13" fill="url(#roomieBrown)" />
      <Rect x="64" y="198" width="58" height="52" rx="13" fill="url(#roomieBrown)" />
      <Rect x="134" y="198" width="58" height="52" rx="13" fill="url(#roomieBrown)" />
    </Svg>
  );
}
