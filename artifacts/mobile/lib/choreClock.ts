const DEVELOPMENT_CLOCK_ENV = "EXPO_PUBLIC_CHORE_NOW";

export function choreNow(realNow = new Date()): Date {
  if (!__DEV__) return realNow;
  const injected = process.env[DEVELOPMENT_CLOCK_ENV];
  if (!injected) return realNow;
  const parsed = new Date(injected);
  return Number.isFinite(parsed.getTime()) ? parsed : realNow;
}

export function choreClockDevelopmentHint(): string {
  return `Set ${DEVELOPMENT_CLOCK_ENV} to an ISO timestamp and restart the development app. Production builds always use the device clock.`;
}
