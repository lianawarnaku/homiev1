import { useAppContext } from "@/context/AppContext";

const blue = {
  // TODO: Fine-tune the blue scheme hex values.
  text: "#1F2937",
  tint: "#4F7FF7",
  background: "#F4F7FF",
  foreground: "#1F2937",
  card: "#FFFFFF",
  cardForeground: "#1F2937",
  primary: "#4F7FF7",
  primaryForeground: "#FFFFFF",
  secondary: "#E8EEFF",
  secondaryForeground: "#3159B7",
  muted: "#E9EEF8",
  mutedForeground: "#667085",
  accent: "#7599F8",
  accentForeground: "#FFFFFF",
  destructive: "#DC4C4C",
  destructiveForeground: "#FFFFFF",
  success: "#4F9D69",
  warning: "#D99A32",
  border: "#D7DEEC",
  input: "#D7DEEC",
  radius: 22,
} as const;

type ThemeTokens = {
  [K in keyof typeof blue]: K extends "radius" ? number : string;
};

const brown: ThemeTokens = {
  // TODO: Fine-tune the brown scheme hex values.
  text: "#33261D", tint: "#8B6F52", background: "#F7F1E8",
  foreground: "#33261D", card: "#FFFCF7", cardForeground: "#33261D",
  primary: "#8B6F52", primaryForeground: "#FFFFFF", secondary: "#EDE1D3",
  secondaryForeground: "#60422F", muted: "#EEE5DA", mutedForeground: "#806B5A",
  accent: "#B98355", accentForeground: "#FFFFFF", destructive: "#C44545",
  destructiveForeground: "#FFFFFF", success: "#7B9C6F", warning: "#D9A24E",
  border: "#DDCDBD", input: "#DDCDBD", radius: 22,
};

const pinkWhite: ThemeTokens = {
  // TODO: Fine-tune the pink-white scheme hex values.
  text: "#35272D", tint: "#F48FB1", background: "#FFF7FA",
  foreground: "#35272D", card: "#FFFFFF", cardForeground: "#35272D",
  primary: "#F48FB1", primaryForeground: "#FFFFFF", secondary: "#FDE7EF",
  secondaryForeground: "#9A4563", muted: "#F7EDF1", mutedForeground: "#806A73",
  accent: "#E96C99", accentForeground: "#FFFFFF", destructive: "#C9455D",
  destructiveForeground: "#FFFFFF", success: "#68A47B", warning: "#D99A45",
  border: "#EED8E1", input: "#EED8E1", radius: 22,
};

const blueWhite: ThemeTokens = {
  // TODO: Fine-tune the blue-white scheme hex values.
  text: "#111827", tint: "#4F7FF7", background: "#FFFFFF",
  foreground: "#111827", card: "#FFFFFF", cardForeground: "#111827",
  primary: "#4F7FF7", primaryForeground: "#FFFFFF", secondary: "#EEF3FF",
  secondaryForeground: "#244A9E", muted: "#F3F4F6", mutedForeground: "#596273",
  accent: "#315FCE", accentForeground: "#FFFFFF", destructive: "#D9363E",
  destructiveForeground: "#FFFFFF", success: "#27864B", warning: "#B87512",
  border: "#D1D5DB", input: "#D1D5DB", radius: 22,
};

export const colorSchemes = { blue, brown, pinkWhite, blueWhite } as const;
export type ColorScheme = keyof typeof colorSchemes;

export function useTheme(): ThemeTokens {
  const { colorScheme } = useAppContext();
  return colorSchemes[colorScheme];
}
