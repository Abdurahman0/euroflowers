/**
 * Gul aktivlari manifesti — barcha Blender eksportlari bir joydan.
 * Yo'llar public/flowers/ ostidagi haqiqiy fayllarga mos kelishi shart.
 */

export const FLOWER_MODELS = {
  white: "/flowers/models/white_peony.glb",
  pink: "/flowers/models/pink_peony.glb",
  red: "/flowers/models/red_peony.glb",
  cream: "/flowers/models/cream_peony.glb",
} as const;

export const LOADING_FLOWER = "/flowers/animations/white_peony_loading.glb";
export const FALLING_PETALS = "/flowers/animations/falling_petals.glb";

/** DOM bezaklari uchun haqiqiy gul suratlari va gulbarg teksturalari */
export const FLOWER_PHOTOS = {
  peony: "/flowers/textures/peony.webp",
  pinkRose: "/flowers/textures/pink-rose.webp",
  hydrangeaPink: "/flowers/textures/hydrangea-pink.webp",
  hydrangeaWhite: "/flowers/textures/hydrangea-white.webp",
  hydrangeaBlue: "/flowers/textures/hydrangea-blue.webp",
} as const;

export const PETAL_TEXTURES = {
  white: "/flowers/textures/petals/petal_col_white.webp",
  cream: "/flowers/textures/petals/petal_col_cream.webp",
  blush: "/flowers/textures/petals/petal_col_blush.webp",
  pink: "/flowers/textures/petals/petal_col_pink.webp",
  rose: "/flowers/textures/petals/petal_col_rose.webp",
  red: "/flowers/textures/petals/petal_col_red.webp",
} as const;

/** falling_petals.glb ichidagi material nomlari */
export type PetalMaterialName =
  | "Petal_white"
  | "Petal_cream"
  | "Petal_blush"
  | "Petal_pink"
  | "Petal_rose"
  | "Petal_red";
