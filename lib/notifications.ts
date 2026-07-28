import type { Notification, NotificationType } from "./types";

/**
 * BILDIRISHNOMA MARKAZI — yorliq, rang va HAVOLA yagona shu yerdan olinadi
 * (sahifa, header paneli va toast bir xil ko'rinadi/bir xil joyga o'tadi).
 *
 * Backend turlari: stock_pending, low_stock, lead, handoff, supplier_stock,
 * florist_catalog (floristga katalog ishi), florist_salary, attendance (keldi-ketdi).
 */

export type NotifMeta = { label: string; color: string; soft: string };

const FALLBACK: NotifMeta = { label: "Bildirishnoma", color: "var(--primary)", soft: "var(--primary-soft)" };

export const NOTIF_META: Record<NotificationType, NotifMeta> = {
  lead: { label: "Lead", color: "var(--success)", soft: "var(--success-soft)" },
  handoff: { label: "Operator", color: "var(--warning)", soft: "var(--warning-soft)" },
  low_stock: { label: "Kam qoldiq", color: "var(--danger)", soft: "var(--danger-soft)" },
  stock_pending: { label: "Sklad yechimi", color: "var(--info)", soft: "var(--info-soft)" },
  supplier_stock: { label: "Yangi partiya", color: "var(--primary)", soft: "var(--primary-soft)" },
  florist_catalog: { label: "Katalog ishi", color: "var(--primary)", soft: "var(--primary-soft)" },
  florist_salary: { label: "Oylik", color: "var(--success)", soft: "var(--success-soft)" },
  attendance: { label: "Keldi-ketdi", color: "var(--info)", soft: "var(--info-soft)" },
};

export const notifMeta = (t: NotificationType | string): NotifMeta =>
  NOTIF_META[t as NotificationType] ?? FALLBACK;

/** Bildirishnoma turi bo'yicha filtr ro'yxati (sahifa headeri) */
export const NOTIF_TYPE_FILTERS: { value: "" | NotificationType; label: string }[] = [
  { value: "", label: "Barcha turlar" },
  { value: "lead", label: "Leadlar" },
  { value: "handoff", label: "Operator" },
  { value: "florist_catalog", label: "Katalog ishi" },
  { value: "florist_salary", label: "Oylik" },
  { value: "attendance", label: "Keldi-ketdi" },
  { value: "low_stock", label: "Kam qoldiq" },
  { value: "stock_pending", label: "Sklad" },
  { value: "supplier_stock", label: "Yangi partiya" },
];

/**
 * reference_type/reference_id → ilova ichidagi manzil.
 * Backend nomlari turlicha bo'lishi mumkin (catalog / catalog_item), shu bois
 * kalit normallashtiriladi. Mos yo'l topilmasa — turi bo'yicha zaxira sahifa.
 */
export function notifHref(n: Pick<Notification, "notification_type" | "reference_type" | "reference_id">): string {
  const ref = (n.reference_type ?? "").replace(/[\s-]/g, "_").toLowerCase();
  const id = n.reference_id;

  if (id) {
    if (ref === "catalog" || ref === "catalog_item" || ref === "catalogitem") return `/katalog?item=${id}`;
    if (ref === "lead") return `/buyurtmalar?order=${id}`;
    if (ref === "conversation" || ref === "chat") return `/chat?conv=${id}`;
    if (ref === "customer") return `/mijozlar?customer=${id}`;
    if (ref === "stock_batch" || ref === "stockbatch" || ref === "batch") return `/sklad?tab=partiyalar&batch=${id}`;
    if (ref === "florist_attendance" || ref === "attendance" || ref === "floristattendance") return `/floristlar?tab=davomat&attendance=${id}`;
    if (ref === "florist" || ref === "florist_profile") return `/floristlar?florist=${id}`;
    if (ref === "florist_salary" || ref === "floristsalary" || ref === "salary") return `/floristlar?tab=oyliklar`;
    if (ref === "supplier") return `/suppliers?supplier=${id}`;
    if (ref === "social_post" || ref === "socialpost") return `/postlar?post=${id}`;
  }

  switch (n.notification_type) {
    case "lead":
      return "/buyurtmalar";
    case "handoff":
      return "/chat";
    case "low_stock":
    case "supplier_stock":
    case "stock_pending":
      return "/sklad";
    case "florist_catalog":
      return "/katalog";
    case "florist_salary":
      return "/floristlar?tab=oyliklar";
    case "attendance":
      return "/floristlar?tab=davomat";
    default:
      return "/bildirishnomalar";
  }
}

/** Bildirishnoma AYNAN shu foydalanuvchiga yo'naltirilganmi (umumiy emas) */
export const isTargeted = (n: Notification, userId?: number): boolean =>
  n.target_user != null && userId != null && n.target_user === userId;
