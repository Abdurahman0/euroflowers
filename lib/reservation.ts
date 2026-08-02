import type { ReservationStatus, ReservationPaymentStatus, Fulfillment, PaymentMethod } from "./types";

/** ⚠️ BRON copy — YAGONA manba (o'zbekcha). Label'lar API qiymati bo'yicha, filtrlar API qiymati yuboradi. */
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  active: "Faol",
  fulfilled: "Bajarilgan",
  cancelled: "Bekor qilingan",
};
export const PAYMENT_STATUS_LABEL: Record<ReservationPaymentStatus, string> = {
  unpaid: "To'lanmagan",
  deposit: "Qisman",
  paid: "To'liq",
};
export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  delivery: "Yetkazish",
  pickup: "Olib ketish",
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Naqd",
  card: "Karta",
  transfer: "O'tkazma",
};

/** desired_date (YYYY-MM-DD) shoshilinchligi — bugun (accent), muddati o'tgan (rose), keyin (oddiy). */
export type Urgency = "today" | "overdue" | "soon" | "future" | "none";
export function reservationUrgency(desiredDate: string | null | undefined, today = todayYmd()): Urgency {
  if (!desiredDate) return "none";
  const d = desiredDate.slice(0, 10);
  if (d < today) return "overdue";
  if (d === today) return "today";
  if (d === addDays(today, 1)) return "soon"; // ertaga
  return "future";
}
export const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** To'lov progressi — foiz (0..100), qoldiq, to'liqmi. total 0 bo'lsa 0%. */
export function paymentProgress(paid: string | number | null | undefined, total: string | number | null | undefined): { paid: number; total: number; remaining: number; pct: number; full: boolean } {
  const p = Math.max(Math.round(+(paid ?? 0) || 0), 0);
  const t = Math.max(Math.round(+(total ?? 0) || 0), 0);
  const remaining = Math.max(t - p, 0);
  const pct = t > 0 ? Math.min(Math.round((p / t) * 100), 100) : 0;
  return { paid: p, total: t, remaining, pct, full: t > 0 && p >= t };
}
