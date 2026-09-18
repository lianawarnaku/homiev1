import {
  barStyleForBackground,
  isDarkColor,
  parseHexColor,
  relativeLuminance,
} from "./contrast.ts";
import { colorSchemes } from "../constants/themeTokens.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(isDarkColor("#111111"), "brand dark base must read as dark");
assert(!isDarkColor("#FFFFFF"), "white must read as light");
assert(!isDarkColor("#F7F1E8"), "the brown scheme background must read as light");

// Every shipped scheme is light, so system icons must be dark in all of them.
for (const [name, tokens] of Object.entries(colorSchemes)) {
  assert(
    barStyleForBackground(tokens.background) === "dark",
    `${name} background must ask for dark system icons`,
  );
}

// Shorthand and alpha-suffixed hex both parse.
assert(parseHexColor("#fff")?.r === 255, "3-digit hex must expand");
assert(parseHexColor("#11111180")?.b === 17, "8-digit hex must ignore the alpha pair");
assert(parseHexColor("rgba(0,0,0,1)") === null, "non-hex input must not parse");
assert(!isDarkColor("rgba(0,0,0,1)"), "unparseable colors must fall back to light");

const white = relativeLuminance("#FFFFFF");
const black = relativeLuminance("#000000");
assert(white !== null && white > 0.99, "white luminance must be ~1");
assert(black !== null && black < 0.01, "black luminance must be ~0");

console.log("contrast.test.ts passed");
