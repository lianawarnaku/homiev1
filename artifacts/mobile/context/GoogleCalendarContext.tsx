import AsyncStorage from "@react-native-async-storage/async-storage";
// NOTE: lowercase "google" — the package's root redirect file is
// providers/google.js. Metro resolves case-sensitively, so the conventional
// uppercase "Google" only works on case-insensitive filesystems (macOS/Windows)
// and breaks the bundler. The lowercase path re-exports the same module.
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Required for the auth session popup to close correctly on web / return to app.
WebBrowser.maybeCompleteAuthSession();

// Google Calendar OAuth scopes:
//  - calendar.events    → create chore events (POST /add-chore)
//  - calendar.readonly  → read free/busy for availability
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const STORAGE_KEY = "homie.googleCalendar.token";

type StoredToken = { accessToken: string; expiresAt: number };

type GoogleCalendarContextType = {
  /** True if we currently hold a non-expired access token. */
  connected: boolean;
  /** A prompt is in-flight. */
  connecting: boolean;
  /**
   * Returns a valid Google access token, prompting the user to sign in if we
   * don't have one (or it's expired). Returns null if the user cancels or
   * OAuth isn't configured.
   */
  ensureToken: () => Promise<string | null>;
  /** Forget the stored token. */
  disconnect: () => Promise<void>;
};

const GoogleCalendarContext = createContext<GoogleCalendarContextType>({
  connected: false,
  connecting: false,
  ensureToken: async () => null,
  disconnect: async () => {},
});

export function GoogleCalendarProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<StoredToken | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Ref mirror so ensureToken() can read the latest token synchronously.
  const tokenRef = useRef<StoredToken | null>(null);

  // Client IDs come from env. The web client ID already exists in the project;
  // add iOS/Android client IDs from Google Cloud for native builds.
  const [, , promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    scopes: SCOPES,
  });

  const persist = useCallback((t: StoredToken | null) => {
    tokenRef.current = t;
    setToken(t);
    if (t) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  // Rehydrate any previously stored token on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as StoredToken;
        if (parsed.expiresAt > Date.now()) {
          tokenRef.current = parsed;
          setToken(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const isValid = (t: StoredToken | null): t is StoredToken =>
    !!t && t.expiresAt > Date.now() + 60_000; // 60s safety margin

  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (isValid(tokenRef.current)) return tokenRef.current!.accessToken;

    setConnecting(true);
    try {
      const result = await promptAsync();
      if (result?.type === "success" && result.authentication?.accessToken) {
        const { accessToken, expiresIn } = result.authentication;
        const stored: StoredToken = {
          accessToken,
          expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
        };
        persist(stored);
        return accessToken;
      }
      return null;
    } finally {
      setConnecting(false);
    }
  }, [promptAsync, persist]);

  const disconnect = useCallback(async () => {
    persist(null);
  }, [persist]);

  return (
    <GoogleCalendarContext.Provider
      value={{ connected: isValid(token), connecting, ensureToken, disconnect }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  );
}

export const useGoogleCalendar = () => useContext(GoogleCalendarContext);
