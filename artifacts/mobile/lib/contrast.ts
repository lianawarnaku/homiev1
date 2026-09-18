// Decides whether system chrome (status bar, nav bar icons) should draw light
// or dark against a themed surface.
//
// Every accent scheme is light today, but the queued dark mode will flip some
// of these, and Android's edge-to-edge status bar is transparent — icons drawn
// in the wrong tone disappear entirely. Deriving the tone from the color keeps
// that automatic.

// Relative luminance per WCAG 2.1, which tracks perceived brightness far
// better than a raw channel average.
function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim().replace(/^#/, "");
  const expanded =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.length === 8
        ? hex.slice(0, 6) // ignore a trailing alpha pair
        : hex;
  if (expanded.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function relativeLuminance(color: string): number | null {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function isDarkColor(color: string): boolean {
  const luminance = relativeLuminance(color);
  // An unparseable color is treated as light, matching the app's light schemes.
  return luminance === null ? false : luminance < 0.5;
}

/** Same hex color at a given opacity, as an `rgba()` string. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHexColor(color);
  const clamped = Math.min(1, Math.max(0, alpha));
  if (!rgb) return `rgba(0, 0, 0, ${clamped})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
}

/** `style` for expo-status-bar: the tone the ICONS should take. */
export function barStyleForBackground(background: string): "light" | "dark" {
  return isDarkColor(background) ? "light" : "dark";
}
