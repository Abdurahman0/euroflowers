import type { CustomerPick } from "@/components/CustomerPicker";
import type { Debt, DebtPayMethod } from "./types";
import { backdateIso, isBackdated } from "./backdate";

/**
 * QARZGA SOTISH + QARZNI TO'LASH — sof mantiq (UI'siz, test qilinadigan).
 *
 * ⚠️ ASOSIY QOIDA: qarzga sotilgan katalog SOTILGAN kuni savdoga KIRMAYDI.
 * U TO'LANGAN kuni, TO'LANGAN usul bilan hisobga tushadi. Ya'ni «Qarz» —
 * to'lov turi emas, to'lovning KEYINGA SURILISHI.
 */

/** Qarzga sotishda mijoz MAJBURIY. Serverning 400 matni — AYNAN shu (spec §1). */
export const DEBT_CUSTOMER_REQUIRED =
  "Qarzga sotishda mijozni tanlang yoki ism bilan telefon raqamini kiriting";

/** Ikkinchi marta to'lash — serverning AYNAN matni (spec §4). */
export const DEBT_ALREADY_PAID = "Bu qarz allaqachon to'langan";

/**
 * Qarz uchun mijoz yetarlimi?
 * - `existing` → id tanlangan bo'lishi kerak (0 = hali tanlanmagan)
 * - `new`      → ISM VA TELEFON IKKALASI ham (spec: «ikkalasi ham»).
 *                ⚠️ Umumiy `customerPayload` bittasi bo'lsa ham yuboradi —
 *                qarz uchun bu YETARLI EMAS.
 * - `none`     → hech qachon yetarli emas (rejim o'chirilgan bo'lishi kerak)
 */
export function debtCustomerReady(v: CustomerPick): boolean {
  if (v.mode === "existing") return v.id > 0;
  if (v.mode === "new") return v.name.trim().length > 0 && v.phone.trim().length > 0;
  return false;
}

/** Qarz rejimida «Biriktirmayman» O'CHIRILADI (yashirilmaydi — sababi bilan). */
export const DEBT_NONE_DISABLED_REASON = "Qarzga sotishda mijoz majburiy";

/**
 * Sotuv payload'ining QARZ qismi. Qarz bo'lmasa — BO'SH obyekt (hech narsa qo'shilmaydi,
 * ya'ni naqd/karta yo'llari AYNAN ilgarigidek qoladi).
 * Mijoz yetarli bo'lmasa `null` — chaqiruvchi submit'ni bloklaydi.
 */
export function debtSellPayload(
  isDebt: boolean,
  v: CustomerPick,
  note: string,
): Record<string, unknown> | null {
  if (!isDebt) return {};
  if (!debtCustomerReady(v)) return null;
  const p: Record<string, unknown> = {};
  if (v.mode === "existing") p.customer = v.id;
  else if (v.mode === "new") {
    p.customer_name = v.name.trim();
    p.customer_phone = v.phone.trim();
  }
  const n = note.trim();
  if (n) p.debt_note = n;
  return p;
}

/**
 * POST /api/debts/{id}/pay/ payload.
 * `method` MAJBURIY — savdo qaysi ustunga tushishi shundan bilinadi, shuning uchun
 * sukut qiymat YO'Q (null bo'lsa `null` qaytadi va submit bloklanadi).
 * `paid_at` — faqat O'TGAN kun tanlansa yuboriladi, DOIM +05:00 bilan (lib/backdate).
 */
export function debtPayPayload(
  method: DebtPayMethod | null,
  ymd?: string | null,
  now = Date.now(),
): Record<string, unknown> | null {
  if (method !== "cash" && method !== "card") return null;
  const p: Record<string, unknown> = { method };
  if (ymd && isBackdated(ymd, now)) {
    const iso = backdateIso(ymd, now);
    if (iso) p.paid_at = iso;
  }
  return p;
}

/** Klient tomonida ikki marta to'lashni to'sish (server matni baribir ko'rsatiladi). */
export const canPayDebt = (d: Pick<Debt, "is_paid">): boolean => !d.is_paid;

/** «N ta · M gul» — spec §3 layout. Gul soni yo'q/0 bo'lsa faqat «N ta». */
export function debtQtyLabel(quantity: number, stemsTotal?: number | null): string {
  const q = `${quantity} ta`;
  return stemsTotal && stemsTotal > 0 ? `${q} · ${stemsTotal} gul` : q;
}

/** Naqd/Karta yorlig'i — server `paid_method_label` bermasa shu ishlatiladi. */
export const DEBT_METHOD_LABEL: Record<DebtPayMethod, string> = { cash: "Naqd", card: "Karta" };

/** ⚠️ Jonli server bo'sh holatda `0.0` (NUMBER), spec'da esa "450000.00" (STRING) qaytardi.
    Ikkalasini ham xavfsiz o'qish uchun. */
export const debtNum = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : +v || 0;
