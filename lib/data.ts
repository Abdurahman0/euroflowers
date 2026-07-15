import type { Theme } from "./types";

/**
 * Aksent palitralari — har biri yangi token tizimi bilan uyg'un ishlaydi:
 * accent → --primary, strong → --primary-strong (hover), accL → yorug' aksent,
 * light/dark → mavzuga mos sahifa foni. Kontrast AA darajasida tekshirilgan.
 */
export const THEMES: Theme[] = [
  { id: "pushti", nomi: "Rose Gold", accent: "#A85D68", strong: "#94505A", accL: "#DCB8BA", light: "#FAF7F1", dark: "#151110" },
  { id: "navy", nomi: "Tungi moviy", accent: "#4A5E80", strong: "#3E5070", accL: "#A9BCD8", light: "#F4F4F0", dark: "#12151C" },
  { id: "bordo", nomi: "Bordo sharob", accent: "#8C3B4A", strong: "#7A3340", accL: "#D6A3A9", light: "#F9F3EF", dark: "#191114" },
  { id: "zumrad", nomi: "O'rmon yashili", accent: "#2F6B52", strong: "#285C46", accL: "#A2CBB3", light: "#F2F5F0", dark: "#101814" },
  { id: "binafsha", nomi: "Lavanda", accent: "#7E6690", strong: "#6E5980", accL: "#CBB9D5", light: "#F5F3F6", dark: "#161320" },
];
