import type { CatalogStatus, ConversationStatus, LeadStatus } from "@/lib/types";

/** Status/manba badge'lari — bitta joyda, hamma sahifada bir xil. */
const B = "rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap";

export const STATUS_BADGE: Record<LeadStatus, string> = {
  new: `${B} bg-tint text-tintink`,
  qualified: `${B} bg-sfc border [border-color:var(--line2)]`,
  contacted: `${B} bg-peach text-peachink`,
  won: `${B} bg-mint text-mintink`,
  lost: `${B} bg-rose text-roseink`,
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Yangi",
  qualified: "Malakali",
  contacted: "Aloqada",
  won: "Sotildi",
  lost: "Bekor",
};

export const SOURCE_BADGE = (source: string): string =>
  source === "instagram"
    ? "rounded-full border px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white [background:var(--acc)] [border-color:var(--acc)]"
    : "rounded-full border px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap bg-sfc [border-color:var(--line2)]";

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
  admin: "Administrator",
  operator: "Operator",
  florist: "Florist",
  warehouse: "Skladchi",
  content: "Kontent",
};
