"use client";
import { VOLUME_LABEL } from "@/lib/inventory";
import type { BouquetVolumeSummary as VolumeRow } from "@/lib/types";
import type { CatalogVolume } from "@/lib/types";

/**
 * BUKETLAR HAJMI BO'YICHA UMUMIY — `catalog.totals.bouquet_volume_summary`.
 *
 * ⚠️ FAQAT BUKETLAR. Savat va boshqa turlar bu summaryga UMUMAN kirmaydi (spec),
 * shuning uchun sarlavhada shu ochiq yozilgan — aks holda operator buni «butun
 * katalog jamisi» deb o'qib, savatlarni yo'qolgan deb o'ylaydi.
 *
 * ⚠️ DOIM UCHTA KARTA: Kichik → O'rta → Katta. Server qo'shimcha qator berishi
 *    mumkin («Belgilanmagan buket») — u KO'RSATILMAYDI, aks holda kartalar soni
 *    filtrga qarab 3 va 4 orasida sakrardi. Hajmi belgilanmagan buketlar
 *    ro'yxatning o'zida ko'rinadi.
 *
 * ⚠️ SARLAVHA — serverning uzun `label` i («Katta buket 15 ta») EMAS, faqat hajm
 *    nomi. Son kartaning o'zida katta shrift bilan turibdi, ikki marta yozilmaydi.
 *
 * ⚠️ Sonlar SERVERDAN; `totals` FILTRGA ergashadi: status/qidiruv o'zgarsa
 *    bu sonlar ham o'zgaradi.
 */

/** Hajm bo'yicha tus — kichik/o'rta/katta ajralib tursin (tema tokenlari). */
const HUE: Record<CatalogVolume, string> = {
  small: "#4a7ab5",
  medium: "#b3873a",
  large: "var(--primary)",
};

/** Ko'rsatiladigan tartib — kichikdan kattaga. */
const ORDER: CatalogVolume[] = ["small", "medium", "large"];

export default function BouquetVolumeSummary({ rows }: { rows?: VolumeRow[] | null }) {
  const list = rows ?? [];
  // ⚠️ Server qatori bo'lmasa NOL bilan chiziladi — kartalar soni doim uchta qoladi
  const cards = ORDER.map((volume) => {
    const r = list.find((x) => x?.volume === volume);
    return {
      volume,
      items_count: r?.items_count ?? 0,
      quantity_total: r?.quantity_total ?? 0,
      quantity_sold: r?.quantity_sold ?? 0,
      quantity_remaining: r?.quantity_remaining ?? 0,
    };
  });
  // umuman ma'lumot bo'lmasa (barcha hajmlar bo'sh) — bo'lim ko'rsatilmaydi
  if (!cards.some((c) => c.items_count > 0 || c.quantity_total > 0)) return null;

  return (
    <section className="mb-3" aria-label="Buketlar hajmi bo'yicha umumiy">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--muted)" }}>
        {/* ⚠️ «faqat buket» — savatlar bu yerga kirmaydi */}
        Buketlar hajmi bo&apos;yicha <span className="font-semibold normal-case tracking-normal opacity-80">· savatlar kirmaydi</span>
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {cards.map((c) => {
          const hue = HUE[c.volume];
          return (
            <div key={c.volume} className="glass !rounded-[16px] p-3.5" style={{ borderLeft: `3px solid ${hue}` }}>
              <div className="text-[12px] font-bold" style={{ color: hue }}>{VOLUME_LABEL[c.volume]}</div>

              {/* ⚠️ ASOSIY SON — qoldiq (spec): operator uchun «hozir sotishga nechta bor» */}
              <div className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                {c.quantity_remaining.toLocaleString("ru")}
                <span className="ml-1 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>dona qoldi</span>
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px]" style={{ color: "var(--mut)" }}>
                <span>Jami {c.quantity_total.toLocaleString("ru")}</span>
                <span>Sotilgan {c.quantity_sold.toLocaleString("ru")}</span>
                <span>{c.items_count} pozitsiya</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
