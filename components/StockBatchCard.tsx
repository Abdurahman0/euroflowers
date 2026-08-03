"use client";
import { ChevronRight, Pencil, Truck } from "lucide-react";
import StemGauge from "./StemGauge";
import { fmt } from "@/lib/format";
import { bunches, freshness, stems, roundingHint, isFreeBatch, batchCostLabel } from "@/lib/inventory";
import FreeBatchChip from "./FreeBatchChip";
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
  onEdit,
}: {
  batch: StockBatch;
  onOpenSupplier?: (id: number) => void;
  onView?: () => void;
  /** berilsa (faqat boshqarish huquqi bo'lsa) — kartada tahrirlash ikonkasi chiqadi */
  onEdit?: () => void;
}) {
  const v = batch.variant_detail;
  const fr = freshness(batch.received_at);
  // ⚠️ DISPLAY-ONLY: server rounding blokidan aniq hisob izohi (is_rounded=true bo'lganda)
  const free = isFreeBatch(batch);
  // ⚠️ TEKIN partiyada yaxlitlash izohi MA'NOSIZ (tannarx 0) — ko'rsatilmaydi
  const costHint = free ? null : roundingHint(batch.rounding?.cost);
  const saleHint = roundingHint(batch.rounding?.sale);

  return (
    <article
      className="glass card-hover group flex cursor-pointer flex-col gap-3 !rounded-[18px] p-4 text-left"
      style={{ opacity: !batch.is_active ? 0.55 : batch.remaining_stems === 0 ? 0.72 : 1 }}
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
            {free && <FreeBatchChip />}
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
        {batch.remaining_stems === 0
          ? <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--surface-2)", color: "var(--muted)" }} title="Qoldiq tugagan">Tugagan</span>
          : <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 15%, transparent)`, color: fr.hue }} title="Kelgan sana bo'yicha yangilik">{fr.label}</span>}
      </div>

      {/* stem gauge — hero */}
      <StemGauge batch={batch} />

      {/* narx qatori — yaxlitlangan; ostida aniq hisob (is_rounded bo'lganda, DISPLAY-ONLY) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
        <span>Tannarx <b style={{ color: free ? "var(--acc)" : "var(--text-2)" }}>{batchCostLabel(batch, `${fmt(batch.cost_per_stem)}/dona`)}</b>{costHint && <span className="ml-1 text-[10.5px]" style={{ color: "var(--mut)" }}>({costHint})</span>}</span>
        <span>→ Sotuv <b style={{ color: "var(--acc)" }}>{fmt(batch.sale_price_per_stem)}</b>/dona{saleHint && <span className="ml-1 text-[10.5px]" style={{ color: "var(--mut)" }}>({saleHint})</span>}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {batch.cost_per_bunch && +batch.cost_per_bunch > 0 && (
          <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>Tannarx {fmt(batch.cost_per_bunch)} / {bunches(1)}</span>
        )}
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>Sotuv {fmt(batch.sale_price_per_bunch)} / {bunches(1)}</span>
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>pochkada {stems(batch.stems_per_bunch)}</span>
        <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>min. {stems(batch.minimum_sale_stems)}</span>
        {batch.height_label && <span className="rounded-full bg-sfc px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>{batch.height_label}</span>}
      </div>

      {/* batafsil — barcha amallar shu modal ichida; TAHRIRLASH ikonkasi alohida target (kartani ochmaydi) */}
      <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-[12px] font-bold transition-colors" style={{ borderColor: "var(--line2)", color: "var(--primary)" }}>
        <span>Batafsil va amallar</span>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
              className="icon-btn !h-7 !w-7 transition-colors duration-150 hover:bg-[var(--hover)]"
              style={{ color: "var(--text-2)" }}
              title="Partiyani tahrirlash"
              aria-label="Partiyani tahrirlash"
            >
              <Pencil size={13.5} strokeWidth={1.9} />
            </button>
          )}
          <ChevronRight size={16} strokeWidth={2.2} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
      </div>
    </article>
  );
}
