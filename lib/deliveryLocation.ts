/**
 * Yetkazib berish manzili — ochiq (loginsiz) xarita sahifasining sof mantiqi.
 * POST /api/delivery-location/ — Authorization sarlavhasisiz yuboriladi.
 */

export type LocOutcome = "ok" | "expired" | "retry" | "error";

export type DeliveryLocationPayload = {
  lead_id: number;
  token: string;
  latitude: number;
  longitude: number;
  address: string;
};

/** URL yo'lidagi lead raqami — faqat musbat butun son qabul qilinadi. */
export function parseLeadId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * `?t=` kodi — O'ZGARTIRILMAYDI va KESILMAYDI (trim ham qilinmaydi):
 * kod buyurtmani himoya qiladi, backend uni aynan solishtiradi.
 */
export function readToken(raw: string | string[] | null | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === "string" ? s : "";
}

/** Koordinata — 7 kasr xonagacha (≈1 sm aniqlik), backend decimal patterniga mos. */
export function coord(n: number): number {
  return Number(n.toFixed(7));
}

export function deliveryPayload(
  leadId: number,
  token: string,
  lat: number,
  lng: number,
  address: string,
): DeliveryLocationPayload {
  return {
    lead_id: leadId,
    token,
    latitude: coord(lat),
    longitude: coord(lng),
    address: (address || "").trim().slice(0, 255),
  };
}

/**
 * Javob → ekran. `SKIPPED` (lead yo'q) va 403 (kod noto'g'ri) mijoz uchun
 * bir xil ko'rinadi — texnik farq ko'rsatilmaydi.
 */
export function locOutcome(status: number, body: unknown): LocOutcome {
  const s = typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined;
  const flag = typeof s === "string" ? s.toUpperCase() : "";
  if (status === 200 || status === 201) {
    if (flag === "SKIPPED" || flag === "REJECTED") return "expired";
    return "ok";
  }
  if (status === 403 || status === 401 || status === 404 || status === 410) return "expired";
  if (status === 400 || status === 422) return "retry";
  return "error";
}

export const LOC_MESSAGE: Record<Exclude<LocOutcome, "ok">, { title: string; text: string }> = {
  expired: {
    title: "Havola eskirgan",
    text: "Iltimos, Instagramda operatorimizga yozing — u sizga yangi havola yuboradi.",
  },
  retry: {
    title: "Manzilni qaytadan belgilang",
    text: "Belgini xaritada aniq nuqtaga qo'ying va yana «Tanlash» tugmasini bosing.",
  },
  error: {
    title: "Yuborib bo'lmadi",
    text: "Internet aloqasini tekshirib, yana bir bor urinib ko'ring.",
  },
};
