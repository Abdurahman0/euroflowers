/**
 * ORQAGA SANA QO'YISH (backdating) — YAGONA MANBA.
 *
 * Ish qolib ketgan bo'lsa operator yozuvni o'tgan kunga qo'yishi mumkin
 * (floristga chiqim, qaytarish/chiqit, katalog qo'shish va tahriri).
 *
 * ⚠️ NIMA UCHUN AYNAN SHU SHAKL:
 *  1. Server ISO 8601 kutadi. Bizning DatePicker esa "YYYY-MM-DDTHH:mm" ni
 *     OFFSETSIZ qaytaradi — bunday satrni server UTC deb o'qishi mumkin va
 *     23:30 yoki 00:30 BOSHQA KUNGA tushib qoladi. Shuning uchun bu yerda
 *     offset DOIM aniq yoziladi: `+05:00` (O'zbekiston, yozgi vaqt yo'q).
 *  2. Vaqtni operatordan SO'RAMAYMIZ — faqat KUN muhim. O'tgan kunga 12:00
 *     qo'yiladi: sutkaning o'rtasi, ±5 soat siljish ham kunni o'zgartirmaydi.
 *  3. BUGUN tanlansa — HOZIRGI vaqt qo'yiladi. 12:00 qo'ysak, kunduzi soat
 *     18:00 da yozilgan yozuv o'sha kunning 15:00 dagi yozuvidan OLDIN turib
 *     qolardi (kun ichidagi tartib buzilardi).
 *  4. Tegilmagan (bugun) bo'lsa — kalit UMUMAN yuborilmaydi. Server o'zi
 *     hozirgi vaqtni qo'yadi; biz uni takrorlab yozmaymiz.
 */

/** O'zbekiston — doimiy UTC+5, yozgi vaqt yo'q. */
const TZ_OFFSET_HOURS = 5;
const TZ_SUFFIX = "+05:00";
const pad = (n: number) => String(n).padStart(2, "0");

/** Toshkent devor-soati — brauzer qaysi mintaqada bo'lishidan QAT'I NAZAR to'g'ri.
    UTC epoch'ga +5 soat qo'shib, UTC maydonlarini o'qiymiz. */
const tashkentParts = (now: number): { ymd: string; hh: number; mm: number } => {
  const d = new Date(now + TZ_OFFSET_HOURS * 3600_000);
  return {
    ymd: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
  };
};

/** Bugungi kun (Toshkent) — "YYYY-MM-DD". Kalendar yuqori chegarasi ham shu. */
export const todayTashkent = (now: number = Date.now()): string => tashkentParts(now).ymd;

/** Tanlangan kun bugundan oldinmi (ya'ni orqaga sana qo'yilyaptimi). */
export const isBackdated = (ymd: string, now: number = Date.now()): boolean => {
  const d = (ymd ?? "").slice(0, 10);
  return !!d && d < todayTashkent(now);
};

/** Kelajak sana — HECH QACHON ruxsat etilmaydi (kalendar ham bloklaydi, bu ikkinchi qatlam). */
export const isFutureDate = (ymd: string, now: number = Date.now()): boolean => {
  const d = (ymd ?? "").slice(0, 10);
  return !!d && d > todayTashkent(now);
};

/**
 * Tanlangan kundan server uchun ISO satr.
 *   bugun      → o'sha kun + HOZIRGI soat:daqiqa (+05:00)
 *   o'tgan kun → o'sha kun + 12:00 (+05:00)
 *   kelajak    → null (yuborilmaydi)
 */
export function backdateIso(ymd: string, now: number = Date.now()): string | null {
  const d = (ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (isFutureDate(d, now)) return null;
  const t = tashkentParts(now);
  const time = d === t.ymd ? `${pad(t.hh)}:${pad(t.mm)}` : "12:00";
  return `${d}T${time}:00${TZ_SUFFIX}`;
}

/**
 * PAYLOAD BO'LAGI — tegilmagan (bugun/bo'sh) bo'lsa BO'SH obyekt.
 * ⚠️ «O'zgarmagan maydon payload'da ko'rinmasligi» qoidasi shu yerda kafolatlanadi.
 */
export function backdatePayload(
  ymd: string | null | undefined,
  now: number = Date.now(),
  key: string = "created_at",
): Record<string, string> {
  const d = (ymd ?? "").slice(0, 10);
  if (!d) return {};                       // tanlanmagan
  if (d === todayTashkent(now)) return {}; // BUGUN = sukut → kalit yuborilmaydi
  const iso = backdateIso(d, now);
  return iso ? { [key]: iso } : {};        // kelajak → yuborilmaydi
}

/**
 * TAHRIR uchun: mavjud yozuvning sanasi O'ZGARGANDAGINA kalit qo'yiladi.
 * (create'dagi «bugun = sukut» qoidasi bu yerda ishlamaydi — mavjud yozuv
 * bugungi bo'lsa ham, uni bugunga o'zgartirish «o'zgarish yo'q» demakdir.)
 */
export function backdateEditPayload(
  originalIso: string | null | undefined,
  ymd: string | null | undefined,
  now: number = Date.now(),
  key: string = "created_at",
): Record<string, string> {
  const next = (ymd ?? "").slice(0, 10);
  const orig = (originalIso ?? "").slice(0, 10);
  if (!next || next === orig) return {};   // tegilmagan
  const iso = backdateIso(next, now);
  return iso ? { [key]: iso } : {};
}

/**
 * MAVJUD "YYYY-MM-DDTHH:mm" (DatePicker withTime — OFFSETSIZ) satriga aniq +05:00 qo'shadi.
 * ⚠️ Nima uchun: offsetsiz satrni server UTC deb o'qishi mumkin va 23:30 / 00:30
 * BOSHQA KUNGA tushib qoladi. Vaqtni operator o'zi tanlagan joylarda (sotuv sanasi,
 * partiya harakati) uni O'ZGARTIRMAYMIZ — faqat mintaqani aniq aytamiz.
 * Allaqachon offsetli (yoki Z bilan) satr TEGILMAYDI.
 */
export function withTashkentOffset(local: string): string {
  const v = (local ?? "").trim();
  if (!v) return v;
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(v)) return v; // allaqachon mintaqali
  const withSecs = /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  return `${withSecs}${TZ_SUFFIX}`;
}
