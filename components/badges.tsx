import type { CatalogStatus, ConversationStatus, LeadStatus, LeadStatusDef } from "@/lib/types";

/** Status/manba badge'lari — bitta joyda, hamma sahifada bir xil. */
const B = "rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap";

export const STATUS_BADGE: Record<string, string> = {
  new: `${B} bg-tint text-tintink`,
  qualified: `${B} bg-sfc border [border-color:var(--line2)]`,
  contacted: `${B} bg-peach text-peachink`,
  won: `${B} bg-mint text-mintink`,
  lost: `${B} bg-rose text-roseink`,
};

export const STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  qualified: "Malakali",
  contacted: "Aloqada",
  won: "Sotildi",
  lost: "Bekor",
};

/* ===== DINAMIK statuslar (backend /api/lead-statuses/) ===== */

/** Status nomi: status_detail (yoki statuslar ro'yxati) → eski lug'at → key. */
export const statusName = (key: LeadStatus, detail?: LeadStatusDef | null): string =>
  detail?.name_uz || detail?.name_ru || STATUS_LABEL[key] || key;

/** Rangli badge: backend `color`dan yumshoq fon + to'q matn (har ikkala temada o'qiladi). */
export const statusBadgeProps = (key: LeadStatus, detail?: LeadStatusDef | null): { className: string; style?: React.CSSProperties } => {
  if (detail?.color) {
    return {
      className: `${B} border`,
      style: {
        background: `color-mix(in srgb, ${detail.color} 16%, var(--surface-solid))`,
        borderColor: `color-mix(in srgb, ${detail.color} 40%, transparent)`,
        color: `color-mix(in srgb, ${detail.color} 72%, var(--text))`,
      },
    };
  }
  return { className: STATUS_BADGE[key] ?? `${B} bg-sfc border [border-color:var(--line2)]` };
};

export const SOURCE_BADGE = (source: string): string =>
  source === "instagram"
    ? "rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white [background:var(--acc)] [border-color:var(--acc)]"
    : "rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap bg-sfc [border-color:var(--line2)]";

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  draft: "Qoralama",
  available: "Sotuvda",
  reserved: "Band",
  sold: "Sotildi",
  archived: "Arxiv",
};

export const CONV_STATUS_LABEL: Record<ConversationStatus, string> = {
  ai: "AI faol",
  operator: "Operator",
  closed: "Yopilgan",
};

export const ARRANGEMENT_LABEL: Record<string, string> = {
  bouquet: "Buket",
  basket: "Savat",
  box: "Quti",
  stems: "Donalab",
  catalog: "Katalog",
};

export const ROLE_LABEL: Record<string, string> = {
  developer: "Developer",
  admin: "Administrator",
  operator: "Operator",
  florist: "Florist",
  warehouse: "Skladchi",
  content: "Kontent",
};
