import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

export type PlantStage = "thriving" | "healthy" | "struggling" | "dying";

export function getPlantStage(health: number): PlantStage {
  if (health >= 0.75) return "thriving";
  if (health >= 0.5) return "healthy";
  if (health >= 0.25) return "struggling";
  return "dying";
}

interface HomePlantProps {
  health: number; // 0 to 1
  size?: number;
}

export function HomePlant({ health, size = 140 }: HomePlantProps) {
  const h = Math.max(0, Math.min(1, health));
  const stage = getPlantStage(h);

  // Stem + leaf colors per stage
  const stemColor = {
    thriving: "#15803D",
    healthy: "#16A34A",
    struggling: "#65A30D",
    dying: "#92400E",
  }[stage];

  const leaf1 = {
    thriving: "#16A34A",
    healthy: "#22C55E",
    struggling: "#84CC16",
    dying: "#B45309",
  }[stage];

  const leaf2 = {
    thriving: "#22C55E",
    healthy: "#4ADE80",
    struggling: "#BEF264",
    dying: "#D97706",
  }[stage];

  // Soil richness reflects health too
  const soilDeep = {
    thriving: "#4A2C16",
    healthy: "#5C3D1E",
    struggling: "#7A5030",
    dying: "#A08060",
  }[stage];

  const soilTop = {
    thriving: "#6B4226",
    healthy: "#7C5230",
    struggling: "#9A7050",
    dying: "#C4A882",
  }[stage];

  // Canvas is 140 × 196
  return (
    <Svg
      width={size}
      height={(size / 140) * 196}
      viewBox="0 0 140 196"
      style={{ overflow: "visible" }}
    >
      {/* ── Pot ────────────────────────────────────────── */}
      {/* Pot body */}
      <Path d="M36,148 L104,148 L95,188 L45,188 Z" fill="#C27050" />
      {/* Pot shade band */}
      <Path d="M36,148 L104,148 L102,160 L38,160 Z" fill="#A05438" />
      {/* Pot rim */}
      <Ellipse cx={70} cy={148} rx={37} ry={8} fill="#A05438" />
      {/* Soil deep */}
      <Ellipse cx={70} cy={148} rx={35} ry={7} fill={soilDeep} />
      {/* Soil surface */}
      <Ellipse cx={70} cy={146} rx={33} ry={5} fill={soilTop} />

      {/* ── Plant per stage ────────────────────────────── */}

      {stage === "thriving" && (
        <>
          {/* Straight, sturdy stem */}
          <Path
            d="M70,144 L70,28"
            stroke={stemColor}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
          {/* Bottom-left leaf */}
          <Path
            d="M70,108 C50,88 8,93 5,110 C8,127 50,125 70,108 Z"
            fill={leaf1}
          />
          {/* Right leaf */}
          <Path
            d="M70,82 C90,62 132,66 135,83 C132,100 90,100 70,82 Z"
            fill={leaf1}
          />
          {/* Upper-left leaf */}
          <Path
            d="M70,54 C50,34 12,40 10,56 C12,72 50,70 70,54 Z"
            fill={leaf2}
          />
          {/* Flower bud */}
          <Circle cx={70} cy={24} r={10} fill="#FEF08A" />
          <Circle cx={70} cy={24} r={5} fill="#FACC15" />
        </>
      )}

      {stage === "healthy" && (
        <>
          {/* Slight gentle lean */}
          <Path
            d="M70,144 C70,120 69,78 67,28"
            stroke={stemColor}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
          {/* Left leaf */}
          <Path
            d="M69,106 C49,87 9,91 6,108 C9,125 49,123 69,106 Z"
            fill={leaf1}
          />
          {/* Right leaf */}
          <Path
            d="M69,78 C89,59 128,63 131,80 C128,97 88,97 69,78 Z"
            fill={leaf1}
          />
          {/* Small top leaf */}
          <Path
            d="M68,50 C50,33 16,38 14,54 C16,70 50,68 68,50 Z"
            fill={leaf2}
          />
        </>
      )}

      {stage === "struggling" && (
        <>
          {/* Stem leaning noticeably */}
          <Path
            d="M70,144 C70,124 67,88 60,35"
            stroke={stemColor}
            strokeWidth={4.5}
            fill="none"
            strokeLinecap="round"
          />
          {/* Left leaf — slightly drooping */}
          <Path
            d="M68,115 C45,103 10,118 8,136 C10,152 45,147 68,115 Z"
            fill={leaf1}
          />
          {/* Right leaf */}
          <Path
            d="M66,82 C85,65 122,72 123,90 C120,107 83,105 66,82 Z"
            fill={leaf2}
          />
        </>
      )}

      {stage === "dying" && (
        <>
          {/* Stem drooped heavily to the right */}
          <Path
            d="M70,144 C72,132 85,116 97,98"
            stroke={stemColor}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          {/* Wilted leaf — drooping down-right */}
          <Path
            d="M78,132 C86,146 110,164 116,172 C110,176 86,166 78,132 Z"
            fill={leaf1}
          />
          {/* Wilted leaf 2 */}
          <Path
            d="M90,114 C100,122 120,133 126,142 C120,148 100,140 90,114 Z"
            fill={leaf2}
          />
        </>
      )}
    </Svg>
  );
}
