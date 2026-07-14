"use client";
import { useStore } from "@/lib/store";
import type { SeasonId } from "@/lib/types";
import type { PetalMaterialName } from "./assets";

/**
 * Fasl dvigateli — butun tajriba (yorug'lik, gulbarglar, fon, changcha)
 * bitta fasl konfiguratsiyasidan oziqlanadi. Fasl almashganda 3D tomonlar
 * rangni kadrma-kadr lerp qiladi, CSS tomonlar @property tranzitsiyasi bilan
 * silliq oqadi — hech qanday sakrash yo'q.
 */

export type SeasonConfig = {
  id: SeasonId;
  nomi: string;
  icon: string;
  /** yorug'lik rigi */
  keyLight: string;
  fillLight: string;
  ambientK: number;
  /** gulbarglar (falling_petals.glb materiallari) */
  petalMaterials: PetalMaterialName[];
  petalDensity: number;
  petalFallSpeed: number;
  /** changcha / qor zarralari */
  pollenColor: string;
  pollenDensity: number;
  /** fon nurlanishlari */
  glowA: string;
  glowB: string;
  glowC: string;
  /** tuman qatlami kuchi 0..1 */
  fog: number;
  /** shamol bazasi 0..1 */
  wind: number;
};

export const SEASONS: SeasonConfig[] = [
  {
    id: "bahor", nomi: "Bahor", icon: "🌸",
    keyLight: "#fff1e0", fillLight: "#f5d5cd", ambientK: 1,
    petalMaterials: ["Petal_white", "Petal_blush", "Petal_cream"],
    petalDensity: 1, petalFallSpeed: 1,
    pollenColor: "#fff4d6", pollenDensity: 1,
    glowA: "#f7c9d4", glowB: "#cfe8d8", glowC: "#fff3e0",
    fog: 0.32, wind: 0.55,
  },
  {
    id: "yoz", nomi: "Yoz", icon: "☀️",
    keyLight: "#ffe9c2", fillLight: "#ffd9a8", ambientK: 1.08,
    petalMaterials: ["Petal_pink", "Petal_rose"],
    petalDensity: 0.7, petalFallSpeed: 0.85,
    pollenColor: "#ffe2a0", pollenDensity: 1.45,
    glowA: "#ffd9a8", glowB: "#f7b9c4", glowC: "#fff7dd",
    fog: 0.16, wind: 0.42,
  },
  {
    id: "kuz", nomi: "Kuz", icon: "🍂",
    keyLight: "#ffd9a4", fillLight: "#e8b48a", ambientK: 0.94,
    petalMaterials: ["Petal_rose", "Petal_red", "Petal_cream"],
    petalDensity: 1.6, petalFallSpeed: 1.3,
    pollenColor: "#f2d8a8", pollenDensity: 0.7,
    glowA: "#e8a86e", glowB: "#d98a94", glowC: "#f2d8b8",
    fog: 0.48, wind: 0.8,
  },
  {
    id: "qish", nomi: "Qish", icon: "❄️",
    keyLight: "#e8eeff", fillLight: "#dfe8f2", ambientK: 0.85,
    petalMaterials: ["Petal_white", "Petal_cream"],
    petalDensity: 0.45, petalFallSpeed: 0.55,
    pollenColor: "#ffffff", pollenDensity: 1.9,
    glowA: "#cddcf0", glowB: "#e6ecf5", glowC: "#f6f9ff",
    fog: 0.58, wind: 0.3,
  },
];

export function seasonById(id: SeasonId): SeasonConfig {
  return SEASONS.find((s) => s.id === id) ?? SEASONS[0];
}

/** Joriy fasl konfiguratsiyasi — store'dagi tanlovdan. */
export function useSeason(): SeasonConfig {
  const id = useStore((s) => s.season);
  return seasonById(id);
}
