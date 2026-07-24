const configuredDownloadUrl =
  process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL ?? "https://sweetmate.info/";

export const APP_DOWNLOAD_URL = (() => {
  try {
    const url = new URL(configuredDownloadUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
})();

export function buildInviteMessage(inviteCode: string): string {
  const code = inviteCode.trim().toUpperCase();
  return APP_DOWNLOAD_URL
    ? `Join my Sweet on SweetMate! Download SweetMate here: ${APP_DOWNLOAD_URL} and enter code ${code} to join.`
    : `Join my Sweet on SweetMate! Download the app and enter code ${code} to join.`;
}
