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
  peony: "/flowers/textures/peony.png",
  pinkRose: "/flowers/textures/pink-rose.png",
  hydrangeaPink: "/flowers/textures/hydrangea-pink.png",
  hydrangeaWhite: "/flowers/textures/hydrangea-white.png",
  hydrangeaBlue: "/flowers/textures/hydrangea-blue.png",
} as const;

export const PETAL_TEXTURES = {
  white: "/flowers/textures/petals/petal_col_white.png",
  cream: "/flowers/textures/petals/petal_col_cream.png",
  blush: "/flowers/textures/petals/petal_col_blush.png",
  pink: "/flowers/textures/petals/petal_col_pink.png",
  rose: "/flowers/textures/petals/petal_col_rose.png",
  red: "/flowers/textures/petals/petal_col_red.png",
} as const;

/** falling_petals.glb ichidagi material nomlari */
export type PetalMaterialName =
  | "Petal_white"
  | "Petal_cream"
  | "Petal_blush"
  | "Petal_pink"
  | "Petal_rose"
  | "Petal_red";
