"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Tag, PackageMinus, PackagePlus, PenLine, Sparkles, Send, Info, Recycle } from "lucide-react";
import Modal from "./Modal";
import { ARRANGEMENT_LABEL, CATALOG_STATUS_LABEL } from "./badges";
import { KIND_LABEL, catalogWaiting } from "@/lib/inventory";
import { catalogHasCostData } from "@/lib/branch";
import { api } from "@/lib/api";
import { fmt, fmtTime, initials } from "@/lib/format";
import type { CatalogHistory, CatalogHistoryAction, CatalogItem } from "@/lib/types";

/**
 * Katalog yozuvining BATAFSIL ko'rinishi — rasm, tarkib (skladdan),
 * narx/soni ko'rsatkichlari, SOTUV VA CHEGIRMA TARIXI hamda story havolasi.
 * Tahrirlash/o'chirish amallari sahifadan keladi (ruxsat bilan).
 */

const HIST_META: Record<CatalogHistoryAction, { label: string; icon: typeof Tag; hue: string }> = {
  created: { label: "Qo'shildi", icon: Sparkles, hue: "#3d8a5f" },
  updated: { label: "Tahrirlandi", icon: PenLine, hue: "#4a7ab5" },
  sold: { label: "Sotildi", icon: Tag, hue: "var(--primary)" },
  inventory_deducted: { label: "Sklad kamaytirildi", icon: PackageMinus, hue: "#b3873a" },
  inventory_restored: { label: "Sklad qaytarildi", icon: PackagePlus, hue: "#6a6ac2" },
};

const histMeta = (a: string) => HIST_META[a as CatalogHistoryAction] ?? { label: a, icon: PenLine, hue: "var(--muted)" };

const actorOf = (h: CatalogHistory): string => {
  const u = h.created_by_detail;
  if (!u) return "Tizim";
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;
};

export default function KatalogViewModal({
  item,
  onClose,
  onEdit,
  onDelete,
  onTransfer,
  onRestore,
}: {
  item: CatalogItem;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** asosiy filial admini uchun — filialga yuborish (sotilmagan qismi bor bo'lsa) */
  onTransfer?: () => void;
  /** §3 restavratsiya — tarkibdagi so'lgan gulni almashtirish (tarkib bor bo'lsa) */
  onRestore?: () => void;
}) {
  // ro'yxat javobida `history` bo'lmasligi mumkin — batafsil ochilganda o'qiymiz
  const [full, setFull] = useState<CatalogItem>(item);
  useEffect(() => {
    setFull(item);
    if (item.history === undefined) {
      // javob kutilmagan shaklda bo'lsa (proksi/demo) — ro'yxatdagi yozuv qoladi
      api.catalogItem(item.id).then((it) => { if (it && typeof it.id === "number") setFull(it); }).catch(() => {});
    }
  }, [item]);

  const total = full.quantity_total ?? 1;
  const sold = full.quantity_sold ?? (full.status === "sold" ? total : 0);
  const dedu = full.quantity_stock_deducted ?? (full.stock_deducted_at ? sold : 0);
  const pending = Math.max(sold - dedu, 0);
  const left = Math.max(total - sold, 0);
  const discount = Math.round(+(full.discount_amount ?? 0) || 0);
  const salary = Math.round(+(full.florist_salary_amount ?? 0) || 0);
  // ⚠️ FILIAL narx yashirish: tannarx/foyda/florist bloklari MA'LUMOTdan aniqlanadi (profit bor-yo'q).
  // false bo'lsa — bu ustun/qatorlar UMUMAN chizilmaydi (bo'sh «0 so'm»/tire EMAS). [[filial-narx-yashirish]]
  const showCost = catalogHasCostData(full);

  // faqat MA'NOLI tarix: sotuvlar va chegirmalar birinchi navbatda
  const history = (full.history ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const sales = history.filter((h) => h.action === "sold");

  const Row = ({ k, v, hue }: { k: string; v: string; hue?: string }) => (
    <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3 first:border-t-0">
      <span className="text-[13px] text-[color:var(--text-2)]">{k}</span>
      <span className="text-right text-[13px] font-semibold" style={hue ? { color: hue } : undefined}>{v}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="pt-6">
        <div className="relative h-[200px] overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {full.image_url && <img src={full.image_url} alt={full.name_uz} className="h-full w-full object-cover" />}
          <span
            className="absolute left-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "color-mix(in srgb, var(--surface-solid) 88%, transparent)", borderColor: "var(--border-strong)" }}
          >
            {(CATALOG_STATUS_LABEL[full.status] ?? full.status).toUpperCase()}
          </span>
          {left > 0 && (
            <span
              className="absolute right-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={{ background: "color-mix(in srgb, var(--surface-solid) 88%, transparent)", borderColor: "var(--border-strong)" }}
            >
              {left} TA QOLDI
            </span>
          )}
          {showCost && discount > 0 && (
            <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: "var(--danger-ink)" }}>
              CHEGIRMA {fmt(discount)}
            </span>
          )}
        </div>

        {/* KUTAYAPTI: florist katalogi, gul tanlangan lekin soni 0. ⚠️ §0c ANIQ: material va florist
            haqi ALLAQACHON tannarxda (yaratishda yechilgan) — faqat GUL tannarxi hali qo'shilmagan. */}
        {catalogWaiting(full) && (
          <div className="mt-2 flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[12.5px] font-bold leading-snug" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
            <Info size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" /> Chiqim yopilishini kutayapti — material va florist haqi allaqachon hisobda, faqat <b>gul tannarxi</b> hali qo&apos;shilmagan (yopilganda qo&apos;shiladi). Foyda shu bois hozircha to&apos;liq emas.
          </div>
        )}
        <div className="mt-3.5 flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-[18px] font-bold tracking-tight">{full.name_uz || full.name_ru}</h2>
          <span className="whitespace-nowrap text-right">
            <span className="block text-[16px] font-bold" style={{ color: "var(--acc)" }}>{fmt(full.price)}</span>
            {/* asl narx (source_price) — FILIALGA yuborilgan nusxada saqlanadi; filial foydalanuvchisiga
                backend NULL qaytaradi (Toshkent narxi) → faqat asosiy admin ko'radi. */}
            {showCost && full.source_price != null && +full.source_price > 0 && +full.source_price !== +full.price && (
              <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>asl narx {fmt(full.source_price)}</span>
            )}
          </span>
        </div>
        {(full.description_uz || full.description_ru) && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{full.description_uz || full.description_ru}</p>
        )}
      </div>

      {/* soni ko'rsatkichlari */}
      <div className="mt-3.5 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
        <span className="rounded-full bg-mint px-2.5 py-0.5 text-mintink">Qoldiq: {left}</span>
        <span className="rounded-full bg-tint px-2.5 py-0.5">Jami: {total}</span>
        <span className="rounded-full bg-tint px-2.5 py-0.5">Sotildi: {sold}</span>
        {pending > 0 && <span className="rounded-full bg-peach px-2.5 py-0.5 text-peachink">Chiqim kutilmoqda: {pending}</span>}
        {full.catalog_kind && <span className="rounded-full bg-tint px-2.5 py-0.5">{KIND_LABEL[full.catalog_kind]}</span>}
      </div>

      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)]">
        <Row k="Turi" v={ARRANGEMENT_LABEL[full.arrangement_type] ?? full.arrangement_type} />
        {full.height_cm != null && <Row k="Bo'yi" v={`${full.height_cm} sm`} />}
        {/* ⚠️ TANNARX/FOYDA/FLORIST bloki — FILIAL foydalanuvchisiga UMUMAN chizilmaydi (showCost). */}
        {showCost && full.calculated_component_price != null && +full.calculated_component_price > 0 && (
          <Row k="Komponentlar narxi" v={fmt(full.calculated_component_price)} />
        )}
        {showCost && discount > 0 && (
          <Row
            k={`Chegirma${full.discount_percent && +full.discount_percent > 0 ? ` (${Math.round(+full.discount_percent * 10) / 10}%)` : ""}`}
            v={fmt(discount)}
            hue="var(--danger-ink)"
          />
        )}
        {full.discount_reason && <Row k="Chegirma sababi" v={full.discount_reason} />}
        {full.note && <Row k="Ichki izoh" v={full.note} />}
        {showCost && full.florist_fee != null && +full.florist_fee > 0 && <Row k="Floristika xizmati (mijozdan)" v={fmt(full.florist_fee)} />}
        {showCost && salary > 0 && <Row k="Florist oyligiga" v={fmt(salary)} hue="var(--acc)" />}
        {showCost && full.florist_detail && (
          <Row
            k="Florist"
            v={[full.florist_detail.user_detail?.first_name, full.florist_detail.user_detail?.last_name].filter(Boolean).join(" ") || full.florist_detail.user_detail?.username || `#${full.florist_detail.id}`}
          />
        )}
        {full.customer_detail && (
          <Row k="Mijoz" v={`${full.customer_detail.name || "Mijoz"}${full.customer_detail.masked_phone ? ` · ${full.customer_detail.masked_phone}` : ""}`} />
        )}
        <Row k="Qo'shilgan" v={fmtTime(full.created_at)} />
        {full.sold_at && <Row k="Sotilgan" v={fmtTime(full.sold_at)} />}
        {full.stock_deducted_at && <Row k="Skladdan yechilgan" v={fmtTime(full.stock_deducted_at)} />}
      </div>

      {/* tarkib — qaysi partiyadan nechta gul */}
      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>Tarkibi</div>
        {full.composition?.length ? (
          <div className="flex flex-col gap-1">
            {full.composition.map((c, i) => {
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

      {/* SOTUV VA CHEGIRMA TARIXI — kim, qachon, nechta, qanday narxda */}
      {history.length > 0 && (
        <div className="mt-3.5 rounded-2xl border border-[color:var(--border)] px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>Sotuv tarixi</span>
            {sales.length > 0 && (
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                {sales.length} ta sotuv · {sales.reduce((s, h) => s + (h.quantity ?? 0), 0)} dona
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {history.map((h) => {
              const meta = histMeta(h.action);
              const HIcon = meta.icon;
              const disc = Math.round(+(h.discount_amount ?? 0) || 0);
              const listed = Math.round(+(h.listed_unit_price ?? 0) || 0);
              const soldPrice = Math.round(+(h.sold_unit_price ?? 0) || 0);
              return (
                <div key={h.id} className="rounded-[13px] border px-3 py-2.5" style={{ borderColor: "var(--line2)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-bold leading-none"
                      style={{
                        background: `color-mix(in srgb, ${meta.hue} 13%, transparent)`,
                        borderColor: `color-mix(in srgb, ${meta.hue} 28%, transparent)`,
                        color: `color-mix(in srgb, ${meta.hue} 72%, var(--text))`,
                      }}
                    >
                      <HIcon size={11} strokeWidth={2.2} /> {meta.label}
                    </span>
                    {!!h.quantity && <span className="text-[12.5px] font-semibold">{h.quantity} dona</span>}
                    <span className="ml-auto flex items-center gap-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
                      <span className="avatar-lead flex h-[20px] w-[20px] items-center justify-center rounded-[7px] text-[9.5px] font-bold">{initials(actorOf(h))}</span>
                      {actorOf(h)} · {fmtTime(h.created_at)}
                    </span>
                  </div>
                  {(soldPrice > 0 || disc > 0) && (
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px]">
                      {listed > 0 && (
                        <span style={{ color: "var(--muted)" }}>
                          Asl narx: <span className={disc > 0 ? "line-through" : "font-semibold"}>{fmt(listed)}</span>
                        </span>
                      )}
                      {soldPrice > 0 && (
                        <span style={{ color: "var(--text-2)" }}>
                          Sotilgan: <b style={{ color: "var(--acc)" }}>{fmt(soldPrice)}</b>
                        </span>
                      )}
                      {disc > 0 && (
                        <span className="font-semibold" style={{ color: "var(--danger-ink)" }}>
                          −{fmt(disc)}
                          {h.discount_percent && +h.discount_percent > 0 ? ` (${Math.round(+h.discount_percent * 10) / 10}%)` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {(h.discount_reason || h.note) && (
                    <p className="mt-1 text-[12.5px] italic" style={{ color: "var(--muted)" }}>{h.discount_reason || h.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {full.instagram_story_url && (
        <a
          href={full.instagram_story_url.startsWith("http") ? full.instagram_story_url : `https://${full.instagram_story_url}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3.5 block rounded-[14px] border px-4 py-3 text-[13px] font-semibold transition-colors duration-150 hover:bg-[var(--hover)]"
          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
        >
          ↗ Instagram storyni ochish
        </a>
      )}

      {(onEdit || onDelete || onTransfer || onRestore) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-4">
          {onRestore && full.composition?.length ? (
            <button
              type="button"
              onClick={onRestore}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:border-[color:var(--primary)]"
              style={{ color: "var(--primary)" }}
            >
              <Recycle size={14} strokeWidth={1.9} /> Restavratsiya
            </button>
          ) : null}
          {onTransfer && (
            <button
              type="button"
              onClick={onTransfer}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:border-[color:var(--primary)]"
              style={{ color: "var(--primary)" }}
            >
              <Send size={14} strokeWidth={1.9} /> Filialga yuborish
            </button>
          )}
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
