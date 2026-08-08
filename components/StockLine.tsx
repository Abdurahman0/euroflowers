"use client";
import { Flower2 } from "lucide-react";
import type { ReactNode } from "react";
import FreeBatchChip from "./FreeBatchChip";
import type { FloristStockBatchDetail, StockBatch } from "@/lib/types";
import { batchTitle, flowerName, variantName, variantColor } from "@/lib/stockLabel";

/** Ikki yo'nalishda BIR XIL o'qiladigan gul qatori — sklad→florist chiqarish formasi,
    florist balanslari va composer tanlagichi shu grammatikadan foydalanadi:
    rasm + gul · nav · rang · bo'y · №partiya, o'ngda miqdor/qiymat sloti. */
export type StockLineData = {
  image?: string;
  flower?: string;
  variant?: string;
  color?: string;
  height?: string;
  batchNumber?: string;
  /** TEKIN partiya — nom yonida «TEKIN» yorlig'i chiqadi (0 tannarx xato ko'rinmasin) */
  isFree?: boolean;
  /** ⚠️ SERVER bergan tayyor nom (`title`) — bo'lsa qo'lda yig'ilgani O'RNIGA ishlatiladi */
  title?: string;
};

/** Florist balansi/tarixidagi flat batch_detail → StockLineData. Himoyalangan:
    batch_detail yo'q bo'lsa ham QATOR portlamaydi — bo'sh grammatika qaytadi
    (StockLine "Gul" fallback + rasm o'rniga ikonka ko'rsatadi). */
export const lineFromBatchDetail = (b: FloristStockBatchDetail | null | undefined): StockLineData =>
  b ? {
    image: b.image_url,
    flower: flowerName(b), variant: variantName(b), color: variantColor(b),
    height: b.height_label, batchNumber: b.batch_number,
    isFree: !!(b as { is_free?: boolean }).is_free,
    // ⚠️ bu shaklda `title` YO'Q (jonli: florist-stock-balances.batch_detail) —
    // helper bo'laklardan toza yig'adi
    title: batchTitle(b, ""),
  } : {};
/** Sklad partiyasi (nested variant_detail) → StockLineData. */
export const lineFromStockBatch = (b: StockBatch): StockLineData => ({
  image: b.image_url || b.variant_detail?.image_url,
  // ⚠️ NOM `lib/stockLabel.ts` dan — «general» qatorda nav/rang BO'SH qaytadi
  // va osilgan ajratgich chiqmaydi (spec: kirimda nav so'ralmaydi).
  flower: flowerName(b),
  variant: variantName(b),
  color: variantColor(b),
  height: b.height_label,
  batchNumber: b.batch_number,
  isFree: !!b.is_free,
  title: batchTitle(b),
});

/** Bitta gul yozuvi — matnli qism (rasm + nomlar), o'ngda `right` sloti (miqdor/qiymat). */
export default function StockLine({ data, right, size = "md" }: { data: StockLineData; right?: ReactNode; size?: "sm" | "md" }) {
  const thumb = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  // ⚠️ Tayyor `title` bo'lsa O'SHA; aks holda bo'sh bo'laklar TASHLAB yig'iladi
  const title = data.title || [data.flower, data.variant].filter(Boolean).join(" · ") || "Gul";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={`${thumb} shrink-0 overflow-hidden rounded-[11px] border`} style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        {data.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" style={{ color: "var(--muted)" }}><Flower2 size={16} strokeWidth={1.8} /></span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-bold" title={title}>{title}</span>
          {data.isFree && <FreeBatchChip />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
          {data.color && <span className="truncate">{data.color}</span>}
          {data.height && <><span aria-hidden>·</span><span>{data.height}</span></>}
          {data.batchNumber && <span className="rounded-full bg-tint px-1.5 py-px text-[10.5px] font-bold text-tintink">№{data.batchNumber}</span>}
        </div>
      </div>
      {right != null && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}
