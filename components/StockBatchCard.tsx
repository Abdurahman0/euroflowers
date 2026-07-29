"use client";
import { ChevronRight, Truck } from "lucide-react";
import StemGauge from "./StemGauge";
import { fmt } from "@/lib/format";
import { bunches, freshness, stems } from "@/lib/inventory";
import type { StockBatch } from "@/lib/types";

/**
 * GUL PARTIYASI kartasi — sklad "Partiyalar" tabining bosh elementi.
 * Butun karta bosiladi → batafsil (view) modal ochiladi; barcha amallar
 * (chiqit/harakat/tahrirlash/nofaollashtirish) SHU modal ichida. Tema tokenlari.
 */
export default function StockBatchCard({
  batch,
  onOpenSupplier,
  onView,
}: {
  batch: StockBatch;
  onOpenSupplier?: (id: number) => void;
  onView?: () => void;
}) {
  const v = batch.variant_detail;
  const fr = freshness(batch.received_at);

  return (
    <article
      className="glass card-hover group flex cursor-pointer flex-col gap-3 !rounded-[18px] p-4 text-left"
      style={{ opacity: batch.is_active ? 1 : 0.55 }}
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView?.(); } }}
      title="Batafsil ko'rish va amallar"
    >
      {/* header */}
      <div className="flex items-start gap-2.5">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          {(batch.image_url || v?.image_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={batch.image_url || v?.image_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold" title={`${v?.flower_detail?.name_uz ?? ""} — ${v?.name_uz ?? ""}`}>
            {v?.flower_detail?.name_uz} — {v?.name_uz}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-tintink">№{batch.batch_number}</span>
            {batch.supplier_detail && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenSupplier?.(batch.supplier_detail!.id); }}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors duration-150 hover:border-[color:var(--primary)]"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                title={batch.supplier_detail.name}
              >
                <Truck size={10} strokeWidth={2.2} /> <span className="max-w-[90px] truncate">{batch.supplier_detail.name}</span>
              </button>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 15%, transparent)`, color: fr.hue }} title={`Kelgan sana bo'yicha yangilik`}>
          {fr.label}
        </span>
      </div>

      {/* stem gauge — hero */}
      <StemGauge batch={batch} />

      {/* narx qatori */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
        <span>Tannarx <b style={{ color: "var(--text-2)" }}>{fmt(batch.cost_per_stem)}</b>/dona</span>
        <span>→ Sotuv <b style={{ color: "var(--acc)" }}>{fmt(batch.sale_price_per_stem)}</b>/dona</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>{fmt(batch.sale_price_per_bunch)} / {bunches(1)}</span>
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>pochkada {stems(batch.stems_per_bunch)}</span>
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>min. {stems(batch.minimum_sale_stems)}</span>
        {batch.height_label && <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>{batch.height_label}</span>}
      </div>

      {/* batafsil — barcha amallar (chiqit/harakat/tahrirlash) shu modal ichida */}
      <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-[12px] font-bold transition-colors" style={{ borderColor: "var(--line2)", color: "var(--primary)" }}>
        <span>Batafsil va amallar</span>
        <ChevronRight size={16} strokeWidth={2.2} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>
    </article>
  );
}
