import { API_BASE } from "./api";

/**
 * SERVER MEDIA HAVOLASI — to'liq manzilga keltirish.
 *
 * ⚠️ NEGA KERAK: backend ba'zi maydonlarni MUTLAQ
 * (`https://euroflowers.api.cognilabs.org/media/uploads/…` — katalog `image_url`),
 * ba'zilarini esa ILDIZGA NISBIY beradi (`/media/sales/IMG_0220.jpeg` —
 * sotuv `sale_image_url`, jonli tekshiruv 29.08.2026). Nisbiy yo'l `<img src>`
 * da FRONTEND domeniga nisbatan hal qilinadi va 404 bo'ladi — sotuv rasmlari
 * tarixda umuman ko'rinmasdi.
 *
 * Mutlaq havola (http/https), `data:` va `blob:` — O'ZGARISHSIZ qaytadi.
 */
export function mediaUrl(u: string | null | undefined): string {
  const s = (u ?? "").trim();
  if (!s) return "";
  if (/^(https?:)?\/\//i.test(s) || /^(data|blob):/i.test(s)) return s;
  return `${API_BASE}/${s.replace(/^\/+/, "")}`;
}
