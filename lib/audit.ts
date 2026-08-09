import type { AuditLog } from "./types";

/**
 * Audit jurnali TARJIMASI — backend xom `action`/`entity_type` kalitlari va
 * before/after JSON'lari o'zbekcha, odam o'qiydigan ko'rinishga o'giriladi.
 * YAGONA joy: sahifa ham, modal ham shu yerdan foydalanadi.
 */

export type AuditKind = "create" | "update" | "delete" | "stock" | "sale" | "move";

type ActionDef = { label: string; kind: AuditKind };

/** Xom action → o'zbekcha nom + turkum (turkum rang/ikonani belgilaydi) */
const ACTIONS: Record<string, ActionDef> = {
  // sklad
  stock_received: { label: "Sklad kirimi", kind: "stock" },
  stock_movement: { label: "Sklad harakati", kind: "move" },
  packaging_received: { label: "Material kirimi", kind: "stock" },
  packaging_movement: { label: "Material harakati", kind: "move" },
  // katalog
  catalog_sold: { label: "Katalogdan sotildi", kind: "sale" },
  catalog_stock_deducted: { label: "Katalog: sklad yechildi", kind: "stock" },
  catalog_created: { label: "Katalogga qo'shildi", kind: "create" },
  catalog_updated: { label: "Katalog tahrirlandi", kind: "update" },
  catalog_deleted: { label: "Katalogdan o'chirildi", kind: "delete" },
  // buyurtma
  lead_created: { label: "Buyurtma yaratildi", kind: "create" },
  lead_updated: { label: "Buyurtma tahrirlandi", kind: "update" },
  lead_deleted: { label: "Buyurtma o'chirildi", kind: "delete" },
  lead_reordered: { label: "Kanban tartibi", kind: "move" },
  lead_stock_deducted: { label: "Sotildi — sklad yechildi", kind: "sale" },
  lead_stock_restored: { label: "Qaytarildi — sklad tiklandi", kind: "stock" },
  // ma'lumotnoma
  flower_created: { label: "Gul turi qo'shildi", kind: "create" },
  flower_updated: { label: "Gul turi tahrirlandi", kind: "update" },
  flower_deleted: { label: "Gul turi o'chirildi", kind: "delete" },
  flowervariant_created: { label: "Nav qo'shildi", kind: "create" },
  flowervariant_updated: { label: "Nav tahrirlandi", kind: "update" },
  flowervariant_deleted: { label: "Nav o'chirildi", kind: "delete" },
  // mijoz / xodim / post
  customer_created: { label: "Mijoz qo'shildi", kind: "create" },
  customer_updated: { label: "Mijoz tahrirlandi", kind: "update" },
  customer_deleted: { label: "Mijoz o'chirildi", kind: "delete" },
  user_created: { label: "Xodim qo'shildi", kind: "create" },
  user_updated: { label: "Xodim tahrirlandi", kind: "update" },
  user_deactivated: { label: "Xodim nofaollashtirildi", kind: "delete" },
  socialpost_created: { label: "Post qo'shildi", kind: "create" },
  socialpost_updated: { label: "Post tahrirlandi", kind: "update" },
  socialpost_deleted: { label: "Post o'chirildi", kind: "delete" },
  settings_updated: { label: "Sozlamalar yangilandi", kind: "update" },
};

/** Umumiy qo'shimchalar — lug'atda yo'q action'lar uchun zaxira qoida */
const SUFFIX_KINDS: [RegExp, AuditKind, string][] = [
  [/_(created|added)$/, "create", "yaratildi"],
  [/_(updated|changed)$/, "update", "tahrirlandi"],
  [/_(deleted|removed)$/, "delete", "o'chirildi"],
  [/_(sold)$/, "sale", "sotildi"],
];

export const auditAction = (action: string): ActionDef => {
  const known = ACTIONS[action];
  if (known) return known;
  for (const [re, kind, uz] of SUFFIX_KINDS) {
    if (re.test(action)) return { label: `${entityName(action.replace(re, ""))} ${uz}`, kind };
  }
  // oxirgi chora: pastki chiziqlarni bo'shliqqa, birinchi harf katta
  const raw = action.replace(/_/g, " ");
  return { label: raw.charAt(0).toUpperCase() + raw.slice(1), kind: "update" };
};

/**
 * Qatorning ASOSIY yorlig'i. Kontrakt: backend `action_label` bersa —
 * AVTORITATIV (u yerda yangi amallar ham tarjima qilingan); bo'lmasa
 * lokal lug'at ishlaydi. `action` — texnik kod, filtr/debug uchun.
 * Turkum (rang/ikonka) doim lokal `action` bo'yicha aniqlanadi.
 */
export const auditLabel = (row: Pick<AuditLog, "action" | "action_label">): ActionDef => {
  const local = auditAction(row.action);
  const label = row.action_label?.trim();
  return label ? { label, kind: local.kind } : local;
};

/** Har turkumga o'z rangi — badge va ikonka shu rangda */
export const KIND_HUE: Record<AuditKind, string> = {
  create: "#3d8a5f",
  update: "#4a7ab5",
  delete: "#a04a4a",
  stock: "#b3873a",
  sale: "var(--primary)",
  move: "#6a6ac2",
};

/** Backend model nomi → o'zbekcha */
const ENTITIES: Record<string, string> = {
  catalogitem: "Katalog guli",
  stockbatch: "Sklad partiyasi",
  packaging: "Material",
  lead: "Buyurtma",
  customer: "Mijoz",
  user: "Xodim",
  flower: "Gul turi",
  flowervariant: "Gul navi",
  socialpost: "Post",
  leadstatus: "Kanban status",
  conversation: "Suhbat",
  businesssettings: "Sozlamalar",
};

export const entityName = (entity: string): string => {
  const key = entity.replace(/[\s_]/g, "").toLowerCase();
  return ENTITIES[key] ?? entity;
};

/* ===== before/after → odam o'qiydigan o'zgarishlar ===== */

/** JSON kalitlari uchun o'zbekcha yorliqlar */
const FIELDS: Record<string, string> = {
  remaining_stems: "Qoldiq",
  received_stems: "Kelgan",
  quantity: "Soni",
  quantity_sold: "Sotilgan",
  quantity_stock_deducted: "Skladdan yechilgan",
  status: "Status",
  sort_order: "Tartib",
  stock_rows: "Gul qatorlari",
  packaging_rows: "Material qatorlari",
  catalog_rows: "Katalog qatorlari",
  rows: "Qatorlar",
  movement: "Harakat №",
  notification: "Bildirishnoma №",
  name_uz: "Nomi (uz)",
  name_ru: "Nomi (ru)",
  color_uz: "Rangi",
  price: "Narxi",
  is_active: "Faol",
  minimum_sale_stems: "Minimal sotuv",
  default_stems_per_bunch: "Pochkada",
  season_start_month: "Mavsum boshi",
  season_end_month: "Mavsum oxiri",
  description_uz: "Tavsif",
  updated_at: "Yangilangan",
  created_at: "Yaratilgan",
  slug: "Slug",
  flower: "Gul turi",
  id: "ID",
  image_url: "Rasm",
};

export const fieldName = (k: string): string => FIELDS[k] ?? k.replace(/_/g, " ");

/** Texnik kalitlar — diffda ko'rsatilmaydi (shovqin) */
const NOISE = new Set(["id", "slug", "created_at", "updated_at", "image_url", "movement", "notification"]);

/** Enum QIYMATLARI ham tarjima qilinadi — "sold" emas, "Sotildi" ko'rinsin */
const VALUES: Record<string, string> = {
  // lead statuslari
  new: "Yangi",
  qualified: "Malakali",
  contacted: "Aloqada",
  won: "Sotildi",
  lost: "Bekor",
  // katalog holatlari
  draft: "Qoralama",
  available: "Sotuvda",
  reserved: "Band",
  sold: "Sotildi",
  archived: "Arxiv",
  // buyurtma turlari
  bouquet: "Buket",
  basket: "Savat",
  box: "Quti",
  stems: "Donalab",
  catalog: "Katalog",
  // sklad harakati turlari
  in: "Kirim",
  out: "Chiqim",
  adjustment: "Tuzatish",
  waste: "Chiqindi",
};

const short = (v: unknown, key?: string): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ha" : "yo'q";
  if (typeof v === "number") return String(v);
  const s = String(v);
  // status/tur kabi kalitlar qiymati lug'atdan o'giriladi
  if (key && /status|type|arrangement/.test(key) && VALUES[s]) return VALUES[s];
  // "3000.000000" kabi o'nliklarni tozalaymiz
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  // ISO sana — qisqa ko'rinish
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 16).replace("T", " ");
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

export type AuditChange = { key: string; label: string; from?: string; to?: string };

/** before/after ni taqqoslab, faqat MA'NOLI o'zgarishlarni qaytaradi */
export function auditChanges(row: AuditLog, includeNoise = false): AuditChange[] {
  const before = row.before ?? {};
  const after = row.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const out: AuditChange[] = [];
  for (const k of keys) {
    if (!includeNoise && NOISE.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    const hasB = k in before;
    const hasA = k in after;
    if (hasB && hasA) {
      if (short(b, k) === short(a, k)) continue;
      out.push({ key: k, label: fieldName(k), from: short(b, k), to: short(a, k) });
    } else if (hasA) {
      out.push({ key: k, label: fieldName(k), to: short(a, k) });
    } else {
      out.push({ key: k, label: fieldName(k), from: short(b, k) });
    }
  }
  return out;
}

/** Jadval uchun bitta qatorlik xulosa — backend `summary` bo'lsa o'sha,
    aks holda before/after diffidan eng muhim o'zgarish(lar). */
export function auditSummary(row: AuditLog): string {
  if (row.summary?.trim()) return row.summary.trim();
  const ch = auditChanges(row);
  if (!ch.length) return "—";
  return ch
    .slice(0, 3)
    .map((c) => (c.from !== undefined && c.to !== undefined ? `${c.label}: ${c.from} → ${c.to}` : `${c.label}: ${c.to ?? c.from}`))
    .join(" · ");
}

/** Xodim ismi — backend `actor_name` ustuvor; bo'lmasa user_detail'dan
    (familiya bilan, aks holda login); tizim amallari uchun «Tizim» */
export const auditActor = (row: AuditLog): string => {
  if (row.actor_name?.trim()) return row.actor_name.trim();
  const u = row.user_detail;
  if (!u) return "Tizim";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return full || u.username;
};

/** Filtr uchun turkum yorliqlari */
export const KIND_LABEL: Record<AuditKind, string> = {
  create: "Yaratish",
  update: "Tahrirlash",
  delete: "O'chirish",
  stock: "Sklad",
  sale: "Sotuv",
  move: "Ko'chirish",
};

/* ===== FILTR TANLAGICHLARI — QATORLARDAN EMAS, STATIK RO'YXATDAN =====
   ⚠️ Ilgari «Amal» va «Obyekt» variantlari EKRANDAGI qatorlardan yig'ilardi.
   Server tomonda sahifalash yoqilgach bu jiddiy nosozlikka aylanadi: 30 qatorlik
   sahifada faqat o'sha 30 tasining amallari ko'rinib, qolganini TANLAB HAM
   BO'LMASDI. Endi ro'yxat shu fayldagi to'liq jadvaldan quriladi. */

/** Barcha ma'lum amallar — turkumi bilan (server `?action=` ni AYNAN shu kod bilan oladi). */
export const AUDIT_ACTION_OPTIONS: { value: string; label: string; kind: AuditKind }[] =
  Object.entries(ACTIONS)
    .map(([value, d]) => ({ value, label: d.label, kind: d.kind }))
    .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Obyekt turlari — ⚠️ SERVER QIYMATLARI PascalCase (Django model nomi).
 * Jonli tekshiruv: `entity_type=CatalogItem` ishlaydi, `catalogitem` esa 0 qaytaradi.
 */
export const AUDIT_ENTITY_VALUES = [
  "CatalogItem", "StockBatch", "StockDelivery", "Packaging", "Lead", "Customer",
  "User", "Flower", "FlowerVariant", "SocialPost", "LeadStatus", "Conversation",
  "BusinessSettings", "FloristProfile",
] as const;
