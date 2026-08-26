/**
 * Teskari geokodlash — koordinatadan matn manzil.
 * Yandex JS API kalitsiz rejimda `geocode` ni bermaydi (scriptError),
 * shuning uchun ochiq OSM/Nominatim ishlatiladi: kalit kerak emas, CORS ochiq,
 * o'zbekcha nomlarni qaytaradi. Xatolikda jim bo'sh satr — manzil ixtiyoriy maydon.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

/** Koordinatani odam o'qiydigan ko'rinishga keltirish (manzil topilmaganda ko'rsatiladi). */
export function fmtCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Nominatim javobidan manzil satrini olish — sof funksiya (test uchun). */
export function pickAddress(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const o = body as { display_name?: unknown; error?: unknown };
  if (o.error) return "";
  return typeof o.display_name === "string" ? o.display_name.trim() : "";
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
  try {
    const url = `${NOMINATIM}?format=jsonv2&zoom=18&accept-language=uz&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return "";
    return pickAddress(await res.json());
  } catch {
    return "";
  }
}
