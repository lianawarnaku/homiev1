// Local-only credential store. Credentials are kept in the OS Keychain
// (iOS) / Keystore (Android) via expo-secure-store, and the password is
// hashed with SHA-256 + a per-account salt before being persisted, so even
// if a Keychain entry is exfiltrated the plaintext password isn't there.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore keys may contain only alphanumeric characters, `.`, `-`, and
// `_`. The old `homie:auth:` prefix used colons and crashed as soon as a
// roommate profile was selected on platforms that enforce that contract.
const KEY_PREFIX = "roomie.auth.";

interface StoredCredential {
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
}

function keyFor(roommateId: string): string {
  const safeId = roommateId.replace(/[^A-Za-z0-9._-]/g, "_") || "unknown";
  return `${KEY_PREFIX}${safeId}`;
}

// expo-secure-store is native-only in this runtime. Web uses AsyncStorage for
// this legacy local-account layer; Supabase remains the real cloud identity.
const credentialStorage = {
  getItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === "web"
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key),
};

export async function hasCredentials(roommateId: string): Promise<boolean> {
  const raw = await credentialStorage.getItem(keyFor(roommateId));
  return !!raw;
}

async function getCredential(roommateId: string): Promise<StoredCredential | null> {
  const raw = await credentialStorage.getItem(keyFor(roommateId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

export async function getStoredUsername(roommateId: string): Promise<string | null> {
  const cred = await getCredential(roommateId);
  return cred?.username ?? null;
}

export async function getStoredEmail(roommateId: string): Promise<string | null> {
  const cred = await getCredential(roommateId);
  return cred?.email ?? null;
}

export async function setupCredentials(
  roommateId: string,
  username: string,
  email: string,
  password: string
): Promise<void> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const passwordHash = await hashPassword(password, salt);
  const cred: StoredCredential = { username, email, salt, passwordHash };
  await credentialStorage.setItem(keyFor(roommateId), JSON.stringify(cred));
}

export async function verifyCredentials(
  roommateId: string,
  username: string,
  password: string
): Promise<boolean> {
  const cred = await getCredential(roommateId);
  if (!cred) return false;
  if (cred.username !== username) return false;
  const computed = await hashPassword(password, cred.salt);
  return computed === cred.passwordHash;
}

// Replaces the password (and optionally rotates the salt) without changing
// username or email. Used by the forgot-password reset flow.
export async function updatePassword(
  roommateId: string,
  newPassword: string
): Promise<boolean> {
  const cred = await getCredential(roommateId);
  if (!cred) return false;
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const passwordHash = await hashPassword(newPassword, salt);
  await credentialStorage.setItem(
    keyFor(roommateId),
    JSON.stringify({ ...cred, salt, passwordHash } satisfies StoredCredential)
  );
  return true;
}

// Find which roommate (if any) this email belongs to. Iterates known IDs since
// SecureStore has no listing API.
export async function findRoommateIdByEmail(
  email: string,
  candidateIds: string[]
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (const id of candidateIds) {
    const cred = await getCredential(id);
    if (cred && cred.email.toLowerCase() === target) return id;
  }
  return null;
}

export async function clearCredentials(roommateId: string): Promise<void> {
  await credentialStorage.removeItem(keyFor(roommateId));
}
