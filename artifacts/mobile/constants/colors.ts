import { useAppContextSelector } from "@/context/AppContext";
import {
  colorSchemes,
  type ThemeTokens,
} from "@/constants/themeTokens";

export {
  colorSchemes,
  normalizeColorScheme,
  type ColorScheme,
  type ThemeTokens,
} from "@/constants/themeTokens";

export function useTheme(): ThemeTokens {
  const colorScheme = useAppContextSelector((context) => context.colorScheme);
  return colorSchemes[colorScheme] ?? colorSchemes.mono;
}
