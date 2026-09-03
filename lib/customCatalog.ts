import type { SellInput } from "./api";
import type { PaymentType } from "./types";

/**
 * MAXSUS (custom) KATALOG — yaratilgandan keyingi HAQIQIY sotuv tanasi.
 *
 * ⚠️ NEGA SHUNDAY: ilgari maxsus yozuv `POST /api/catalog/` ga
 * `status: "sold"` bilan yuborilardi. Backend statusni yozib, gulni skladdan
 * yechardi, lekin SOTUV YARATMASDI — jonli tekshiruv (03.09.2026, id 660):
 *     status: "sold" · sold_at: null · shu yozuv bo'yicha sotuvlar: 0 ta
 *     bugungi hisob-kitob: custom_quantity 0, 1 500 000 so'm KIRMAGAN
 * Ya'ni kartada «Sotildi» turardi, pul esa hech qayerda yo'q edi.
 *
 * Endi yozuv «Sotuvda» bo'lib yaratiladi va darhol
 * `POST /api/catalog/{id}/sell/` chaqiriladi — standart katalogdagi ISBOTLANGAN
 * oqimning aynan o'zi (765 ta sotuv shu yo'l bilan yozilgan).
 */
export type CustomSaleForm = {
  /** formadagi «Soni» — kamida 1 */
  quantity: number;
  /** BIR DONA narxi (`f.price`) */
  unitPrice: string | number;
  payment: PaymentType;
  discountReason?: string;
  /** create javobidan olingan mijoz id — YANGI mijoz IKKI marta yaratilmasin */
  customerId?: number | null;
};

export function customSalePayload(f: CustomSaleForm): SellInput {
  const qty = Math.max(1, Math.floor(Number(f.quantity) || 1));
  const reason = (f.discountReason ?? "").trim();
  const cust = Number(f.customerId);
  return {
    quantity: qty,
    // ⚠️ DONA narxi (jami EMAS) — backend `quantity` ga o'zi ko'paytiradi
    sale_price: (Number(f.unitPrice) || 0).toFixed(2),
    payment_type: f.payment,
    ...(reason ? { discount_reason: reason } : {}),
    ...(Number.isFinite(cust) && cust > 0 ? { customer: cust } : {}),
  };
}
