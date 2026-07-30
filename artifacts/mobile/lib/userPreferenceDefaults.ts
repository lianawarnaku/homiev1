import {
  normalizeColorScheme,
  type ColorScheme,
} from "../constants/themeTokens.ts";

export const USER_PREFERENCES_VERSION = 2;

export interface StoredDisplayPreferences {
  colorScheme?: unknown;
  pointsEnabled?: boolean;
  roommateActivityEnabled?: boolean;
  plantEnabled?: boolean;
  preferencesVersion?: number;
}

export interface ResolvedDisplayPreferences {
  colorScheme: ColorScheme;
  pointsEnabled: boolean;
  roommateActivityEnabled: boolean;
  plantEnabled: boolean;
  preferencesVersion: number;
}

export function resolveDisplayPreferenceDefaults(
  stored: StoredDisplayPreferences,
): ResolvedDisplayPreferences {
  return {
    colorScheme: normalizeColorScheme(stored.colorScheme),
    pointsEnabled:
      typeof stored.pointsEnabled === "boolean" ? stored.pointsEnabled : false,
    roommateActivityEnabled:
      typeof stored.roommateActivityEnabled === "boolean"
        ? stored.roommateActivityEnabled
        : false,
    plantEnabled:
      typeof stored.plantEnabled === "boolean" ? stored.plantEnabled : true,
    preferencesVersion: USER_PREFERENCES_VERSION,
  };
}
