"use client";
import { Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { ARRANGEMENT_LABEL, CATALOG_STATUS_LABEL } from "./badges";
import { fmt, fmtTime } from "@/lib/format";
import type { CatalogItem } from "@/lib/types";

/**
 * Katalog yozuvining BATAFSIL ko'rinishi — rasm, tarkib (skladdan),
 * narx/soni ko'rsatkichlari va story havolasi. Tahrirlash/o'chirish
 * amallari sahifadan keladi (ruxsat bilan).
 */
export default function KatalogViewModal({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: CatalogItem;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const total = item.quantity_total ?? 1;
  const sold = item.quantity_sold ?? (item.status === "sold" ? total : 0);
  const dedu = item.quantity_stock_deducted ?? (item.stock_deducted_at ? sold : 0);
  const pending = Math.max(sold - dedu, 0);
  const left = Math.max(total - sold, 0);

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3 first:border-t-0">
      <span className="text-[13px] text-[color:var(--text-2)]">{k}</span>
      <span className="text-right text-[13px] font-semibold">{v}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="pt-6">
        <div className="relative h-[200px] overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.image_url && <img src={item.image_url} alt={item.name_uz} className="h-full w-full object-cover" />}
          <span
            className="absolute left-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "color-mix(in srgb, var(--surface-solid) 88%, transparent)", borderColor: "var(--border-strong)" }}
          >
            {(CATALOG_STATUS_LABEL[item.status] ?? item.status).toUpperCase()}
          </span>
          {left > 0 && (
            <span
              className="absolute right-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={{ background: "color-mix(in srgb, var(--surface-solid) 88%, transparent)", borderColor: "var(--border-strong)" }}
            >
              {left} TA QOLDI
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-[18px] font-bold tracking-tight">{item.name_uz || item.name_ru}</h2>
          <span className="whitespace-nowrap text-[16px] font-bold" style={{ color: "var(--acc)" }}>{fmt(item.price)}</span>
        </div>
        {(item.description_uz || item.description_ru) && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{item.description_uz || item.description_ru}</p>
        )}
      </div>

      {/* soni ko'rsatkichlari */}
      <div className="mt-3.5 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
        <span className="rounded-full bg-mint px-2.5 py-0.5 text-mintink">Qoldiq: {left}</span>
        <span className="rounded-full bg-tint px-2.5 py-0.5">Jami: {total}</span>
        <span className="rounded-full bg-tint px-2.5 py-0.5">Sotildi: {sold}</span>
        {pending > 0 && <span className="rounded-full bg-peach px-2.5 py-0.5 text-peachink">Chiqim kutilmoqda: {pending}</span>}
      </div>

      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)]">
        <Row k="Turi" v={ARRANGEMENT_LABEL[item.arrangement_type] ?? item.arrangement_type} />
        {item.height_cm != null && <Row k="Bo'yi" v={`${item.height_cm} sm`} />}
        {item.florist_fee != null && +item.florist_fee > 0 && <Row k="Florist haqi" v={fmt(item.florist_fee)} />}
        <Row k="Qo'shilgan" v={fmtTime(item.created_at)} />
        {item.sold_at && <Row k="Sotilgan" v={fmtTime(item.sold_at)} />}
        {item.stock_deducted_at && <Row k="Skladdan yechilgan" v={fmtTime(item.stock_deducted_at)} />}
      </div>

      {/* tarkib — qaysi partiyadan nechta gul */}
      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>Tarkibi</div>
        {item.composition?.length ? (
          <div className="flex flex-col gap-1">
            {item.composition.map((c, i) => {
              const v = c.batch_detail?.variant_detail;
              return (
                <div key={i} className="flex justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">
                    🌸 {v?.flower_detail?.name_uz ?? "Gul"} {v?.name_uz ?? ""}
                    {v?.color_uz ? ` · ${v.color_uz}` : ""}
                  </span>
                  <span className="shrink-0 font-semibold">{c.quantity_stems} dona</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>Tarkib kiritilmagan.</p>
        )}
      </div>

      {item.instagram_story_url && (
        <a
          href={item.instagram_story_url.startsWith("http") ? item.instagram_story_url : `https://${item.instagram_story_url}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3.5 block rounded-[14px] border px-4 py-3 text-[13px] font-semibold transition-colors duration-150 hover:bg-[var(--hover)]"
          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
        >
          ↗ Instagram storyni ochish
        </a>
      )}

      {(onEdit || onDelete) && (
        <div className="mt-4 flex gap-2 border-t border-[color:var(--border)] pt-4">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:border-[color:var(--acc)]"
            >
              <Pencil size={14} strokeWidth={1.75} /> Tahrirlash
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:bg-[color:var(--hover)]"
              style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border-strong))", color: "var(--danger-ink)" }}
            >
              <Trash2 size={14} strokeWidth={1.75} /> O&apos;chirish
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
