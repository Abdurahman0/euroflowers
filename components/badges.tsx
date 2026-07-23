import { Globe, Pencil, Sparkles, Store } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon, TelegramIcon } from "@hugeicons/core-free-icons";
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

/* ===== MANBA (source) badge'lari — YAGONA markazlashgan joy =====
   Xom qiymat → o'zbekcha yorliq + ikonka + manbaga xos yumshoq rang.
   color-mix var(--text) bilan aralashadi — har ikki temada o'zi moslashadi. */

type SourceKind = "instagram" | "telegram" | "mini" | "manual" | "web" | "other";
type SourceDef = { label: string; hue: string; kind: SourceKind };

const SOURCE_DEFS: Record<string, SourceDef> = {
  manual: { label: "Qo'lda", hue: "#8a8173", kind: "manual" },
  mini_app: { label: "Mini do'kon", hue: "var(--primary)", kind: "mini" },
  instagram: { label: "Instagram", hue: "#d6249f", kind: "instagram" },
  instagram_dm: { label: "Instagram DM", hue: "#d6249f", kind: "instagram" },
  story_reply: { label: "Story javobi", hue: "#d6249f", kind: "instagram" },
  post_reply: { label: "Post javobi", hue: "#d6249f", kind: "instagram" },
  comment: { label: "Izoh", hue: "#d6249f", kind: "instagram" },
  telegram: { label: "Telegram", hue: "#229ED9", kind: "telegram" },
  website: { label: "Veb-sayt", hue: "#4a7ab5", kind: "web" },
};

/** Faqat matn kerak bo'lgan joylar uchun (tooltips, ro'yxatlar). */
export const sourceLabel = (source?: string | null): string => {
  if (!source) return "—";
  const def = SOURCE_DEFS[source];
  if (def) return def.label;
  const raw = source.replace(/_/g, " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const SOURCE_ICON: Record<SourceKind, React.ReactNode> = {
  instagram: <HugeiconsIcon icon={InstagramIcon} size={11} strokeWidth={2.2} />,
  telegram: <HugeiconsIcon icon={TelegramIcon} size={11} strokeWidth={2.2} />,
  mini: <Store size={11} strokeWidth={2.2} />,
  manual: <Pencil size={11} strokeWidth={2.2} />,
  web: <Globe size={11} strokeWidth={2.2} />,
  other: <Globe size={11} strokeWidth={2.2} />,
};

/** Manba chip — ikonka + yorliq, manbaga xos yumshoq tinted fon.
    Mini do'kon (o'z kanalimiz) nafis gradient + uchqun bilan ajralib turadi. */
export function SourceBadge({ source, className = "" }: { source?: string | null; className?: string }) {
  const def: SourceDef = (source && SOURCE_DEFS[source]) || { label: sourceLabel(source), hue: "#8a8173", kind: "other" };
  const mini = def.kind === "mini";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] font-bold leading-none ${className}`}
      style={{
        background: mini
          ? `linear-gradient(120deg, color-mix(in srgb, var(--primary) 22%, transparent), color-mix(in srgb, var(--acc) 9%, transparent))`
          : `color-mix(in srgb, ${def.hue} 13%, transparent)`,
        borderColor: `color-mix(in srgb, ${def.hue} ${mini ? 40 : 28}%, transparent)`,
        color: `color-mix(in srgb, ${def.hue} 72%, var(--text))`,
      }}
      title={def.label}
    >
      {SOURCE_ICON[def.kind]}
      {def.label}
      {mini && <Sparkles size={10} strokeWidth={2.2} aria-hidden />}
    </span>
  );
}

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
