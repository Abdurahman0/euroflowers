"use client";
import { Flower2 } from "lucide-react";
import type { BouquetVolumeSummary as VolumeRow } from "@/lib/types";

/**
 * BUKETLAR HAJMI BO'YICHA UMUMIY — `catalog.totals.bouquet_volume_summary`.
 *
 * ⚠️ FAQAT BUKETLAR. Savat va boshqa turlar bu summaryga UMUMAN kirmaydi (spec),
 * shuning uchun sarlavhada shu ochiq yozilgan — aks holda operator buni «butun
 * katalog jamisi» deb o'qib, savatlarni yo'qolgan deb o'ylaydi.
 *
 * ⚠️ Sonlar SERVERDAN. `label` ni ham server tayyorlaydi («Katta buket 13 ta») —
 * uni o'zimiz yig'masak, tilga bog'liq matn ikki joyda ikki xil bo'lib ketmaydi.
 * ⚠️ `totals` FILTRGA ergashadi: status/qidiruv o'zgarsa bu sonlar ham o'zgaradi.
 */

/** Hajm bo'yicha tus — katta/o'rta/kichik ajralib tursin (tema tokenlari). */
const HUE: Record<string, string> = {
  large: "var(--primary)",
  medium: "#b3873a",
  small: "#4a7ab5",
};

export default function BouquetVolumeSummary({ rows }: { rows?: VolumeRow[] | null }) {
  const list = (rows ?? []).filter((r) => r && (r.items_count > 0 || r.quantity_total > 0));
  if (!list.length) return null;

  return (
    <section className="mb-3" aria-label="Buketlar hajmi bo'yicha umumiy">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--muted)" }}>
        <Flower2 size={12} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
        {/* ⚠️ «faqat buket» — savatlar bu yerga kirmaydi */}
        Buketlar hajmi bo&apos;yicha <span className="font-semibold normal-case tracking-normal opacity-80">· savatlar kirmaydi</span>
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {list.map((r) => {
          const hue = HUE[r.volume] ?? "var(--muted)";
          return (
            <div key={r.volume} className="glass !rounded-[16px] p-3.5" style={{ borderLeft: `3px solid ${hue}` }}>
              {/* server tayyorlagan sarlavha */}
              <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: hue }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue }} />
                <span className="min-w-0 truncate" title={r.label}>{r.label}</span>
              </div>

              {/* ⚠️ ASOSIY SON — qoldiq (spec): operator uchun «hozir sotishga nechta bor» */}
              <div className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                {r.quantity_remaining.toLocaleString("ru")}
                <span className="ml-1 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>dona qoldi</span>
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px]" style={{ color: "var(--mut)" }}>
                <span>Jami {r.quantity_total.toLocaleString("ru")}</span>
                <span>Sotilgan {r.quantity_sold.toLocaleString("ru")}</span>
                <span>{r.items_count} pozitsiya</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
