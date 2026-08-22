"use client";
import { Info, Pencil, Recycle, Send, Sparkles, Trash2, User } from "lucide-react";
import { fmt, fmtTime, initials } from "@/lib/format";
import { catalogRemaining } from "@/lib/rework";
import { deductionState } from "@/lib/catalogStock";
import { floristLabel } from "@/lib/floristLabel";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import type { GroupActions } from "@/components/CatalogGroupCard";
import type { CatalogItem } from "@/lib/types";

/**
 * BITTA KATALOG YOZUVI — RASMLI karta (eski ko'rinish).
 *
 * ⚠️ SAVAT (va quti) shu kartada chiziladi: buketlardan farqli o'laroq ular
 *    guruhlanmaydi — har biri alohida tovar, surati bilan ko'rinishi kerak.
 *    Buketlar esa hajm bo'yicha guruh kartalarida (CatalogGroupCard).
 */
export default function CatalogItemCard({ k, actions }: { k: CatalogItem; actions: GroupActions }) {
  const total = k.quantity_total ?? 1;
  const ded = deductionState(k);
  const sold = ded.sold;
  const pending = ded.pending;
  const left = catalogRemaining(k);
  const sellable = left > 0 && (k.status === "available" || k.status === "reserved" || k.status === "draft");
  const dimmed = k.status === "sold" || k.status === "archived";
  return (
  <article className="glass card-hover group flex flex-col overflow-hidden !rounded-[20px]" style={dimmed ? { opacity: 0.6 } : undefined}>
    <div
      className="relative h-[190px] cursor-pointer bg-bg2"
      role="button"
      tabIndex={0}
      onClick={() => actions.onView(k)}
      onKeyDown={(e) => e.key === "Enter" && actions.onView(k)}
      title="Batafsil ko'rish"
    >
      {k.image_url && <img src={k.image_url} alt={k.name_uz} className="h-full w-full object-cover" />}
      {/* tahrirlash / o'chirish / filialga yuborish — rasm ustida, hover'da */}
      {actions.control && (
        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-[11px] p-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100" style={{ background: "color-mix(in srgb, var(--surface-solid) 82%, transparent)" }}>
          {/* RESTAVRATSIYA — qoldig'i bor mahsulotni buzib yangisini yasash */}
          {catalogRemaining(k) > 0 && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); actions.onRework(k); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); actions.onRework(k); } }} title="Restavratsiya — buzib yangi mahsulot yasash" aria-label={`${k.name_uz || k.name_ru} — restavratsiya`} className="icon-btn !h-7 !w-7">
              <Recycle size={13} strokeWidth={1.9} />
            </span>
          )}
          {/* Filialga yuborish — FAQAT asosiy filial admini, sotilmagan qismi bor bo'lsa */}
          {actions.mainUser && catalogRemaining(k) > 0 && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); actions.onTransfer(k); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); actions.onTransfer(k); } }} title="Filialga yuborish" aria-label={`${k.name_uz || k.name_ru} — filialga yuborish`} className="icon-btn !h-7 !w-7">
              <Send size={13} strokeWidth={1.9} />
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); actions.onEdit(k); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); actions.onEdit(k); } }}
            title="Tahrirlash"
            aria-label={`${k.name_uz || k.name_ru} — tahrirlash`}
            className="icon-btn !h-7 !w-7"
          >
            <Pencil size={13.5} strokeWidth={1.75} />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); actions.onDelete(k); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); actions.onDelete(k); } }}
            title="O'chirish"
            aria-label={`${k.name_uz || k.name_ru} — o'chirish`}
            className="icon-btn icon-btn-danger !h-7 !w-7"
          >
            <Trash2 size={13.5} strokeWidth={1.75} />
          </span>
        </span>
      )}
      <span className={`absolute left-2.5 top-2.5 -rotate-2 rounded-full border border-[color:var(--border-strong)] px-2.5 py-1 text-[11px] font-bold ${k.status === "available" ? "bg-white/85 text-[#221833]" : "text-white"}`} style={k.status !== "available" ? { background: "var(--acc)" } : undefined}>
        {(CATALOG_STATUS_LABEL[k.status] ?? k.status).toUpperCase()}
      </span>
      {/* nechta gul qoldi — kartaning yuqorisida darhol ko'rinadi */}
      {k.quantity_total != null && left > 0 && (
        <span className="absolute right-2.5 top-2.5 rotate-2 rounded-full border border-[color:var(--border-strong)] bg-white/85 px-2.5 py-1 text-[11px] font-bold text-[#221833]">
          {left} TA QOLDI
        </span>
      )}
    </div>
    <div className="flex flex-1 flex-col gap-1.5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold tracking-tight">{k.name_uz || k.name_ru}</h3>
        <span className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--acc)" }}>{fmt(k.price)}</span>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
        {actions.composition(k)}
        {k.height_cm ? ` · bo'yi ${k.height_cm} sm` : ""} · {ARRANGEMENT_LABEL[k.arrangement_type] ?? k.arrangement_type}
      </p>
      {(k.description_uz || k.description_ru) && (
        <p className="text-[13px] italic" style={{ color: "var(--mut)" }}>{k.description_uz || k.description_ru}</p>
      )}
      {/* florist chipi (kim tayyorladi) — ⚠️ FILIAL foydalanuvchisiga UMUMAN chizilmaydi
          (florist kimligi asosiy filial ishi; catalogHasCostData bilan gate). */}
      {actions.costVisible(k) && (k.florist_detail ? (
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
          <span className="avatar-lead flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold">{initials(floristLabel(k.florist_detail, k.florist_name))}</span>
          <span className="truncate" title={floristLabel(k.florist_detail, k.florist_name)}>{floristLabel(k.florist_detail, k.florist_name)}</span>
        </span>
      ) : (
        <span className="text-[12px] italic" style={{ color: "var(--muted)" }}>Florist ko&apos;rsatilmagan</span>
      ))}
      {/* OFORMLENIYA floristi — ALOHIDA chip (accent + Sparkles), yasovchidan farqlansin */}
      {actions.costVisible(k) && k.decoration_florist_detail && (
        <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--acc)" }} title={`Oformleniya: ${floristLabel(k.decoration_florist_detail, k.decoration_florist_name)}`}>
          <Sparkles size={12} strokeWidth={2} className="shrink-0" />
          <span className="truncate">{floristLabel(k.decoration_florist_detail, k.decoration_florist_name)}</span>
        </span>
      )}
      {/* KUTAYAPTI: material+haq hisobda, faqat gul tannarxi yopilganda qo'shiladi → foyda hali to'liq emas */}
      {actions.undistributed(k) && (
        <span className="flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }} title="Material va florist haqi allaqachon tannarxda; faqat gul tannarxi chiqim yopilganda qo'shiladi — foyda shundan keyin to'liq bo'ladi">
          <Info size={11} strokeWidth={2.4} /> Gul taqsimlanmagan
        </span>
      )}
      {/* mijoz chipi (kim sotib oldi) — bosilsa shu mijoz bo'yicha filtr */}
      {k.customer_detail && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); actions.onCustomer(k.customer_detail!.id, `${k.customer_detail!.name || "Mijoz"}${k.customer_detail!.masked_phone ? ` · ${k.customer_detail!.masked_phone}` : ""}`); }}
          className="flex min-w-0 items-center gap-1.5 self-start rounded-full border px-2 py-0.5 text-[11.5px] font-bold transition-colors hover:border-[color:var(--primary)]"
          style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
          title={`Mijoz: ${k.customer_detail.name}${k.customer_detail.masked_phone ? ` · ${k.customer_detail.masked_phone}` : ""} — bo'yicha filtrlash`}
        >
          <User size={11} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
          <span className="truncate">{k.customer_detail.name || "Mijoz"}</span>
          {k.customer_detail.masked_phone && <span className="shrink-0 opacity-70">{k.customer_detail.masked_phone}</span>}
        </button>
      )}
      {/* ichki izoh — bir qatorli preview, to'liq matn tooltip'da */}
      {k.note && (
        <p className="truncate text-[12.5px] italic" style={{ color: "var(--mut)" }} title={k.note}>✎ {k.note}</p>
      )}
      {k.instagram_story_url && (
        <a href={k.instagram_story_url.startsWith("http") ? k.instagram_story_url : `https://${k.instagram_story_url}`} target="_blank" className="text-[13px] font-semibold">
          ↗ Instagram story ({fmtTime(k.created_at)})
        </a>
      )}

      {/* soni: qoldiq / jami / sotildi (+ chiqim kutilmoqda) */}
      {k.quantity_total != null && (
        <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-mintink">Qoldiq: {left}</span>
          <span className="rounded-full bg-tint px-2.5 py-0.5">Jami: {total}</span>
          <span className="rounded-full bg-tint px-2.5 py-0.5">Sotildi: {sold}</span>
          {/* ⚠️ RESTAVRATSIYADA — buzilgan donalar sotuvda KO'RINMAYDI (spec kartochka qatori) */}
          {(k.quantity_reworked ?? 0) > 0 && (
            <span className="rounded-full px-2.5 py-0.5" style={{ background: "color-mix(in srgb, var(--acc) 15%, transparent)", color: "var(--acc)" }}
              title="Restavratsiyada buzilgan — sotuvda ko'rinmaydi">Restavratsiyada: {k.quantity_reworked}</span>
          )}
          {(k.quantity_wasted ?? 0) > 0 && (
            <span className="rounded-full px-2.5 py-0.5" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>Chiqit: {k.quantity_wasted}</span>
          )}
          {pending > 0 && <span className="rounded-full bg-peach px-2.5 py-0.5 text-peachink">Kutilmoqda: {pending}</span>}
          {/* chegirmada sotilgan — ⚠️ FILIALGA yashiriladi (komponent narxidan hisoblanadi, tannarxni oshkor qiladi) */}
          {actions.costVisible(k) && +(k.discount_amount ?? 0) > 0 && (
            <span
              className="rounded-full px-2.5 py-0.5"
              style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}
              title={k.discount_reason || "Chegirma bilan sotilgan"}
            >
              Chegirma: {fmt(k.discount_amount)}
            </span>
          )}
        </div>
      )}

      {pending > 0 && (
        <div className="rounded-[13px] border-[1.5px] bg-tint p-3" style={{ borderColor: "var(--line)" }}>
          <p className="mb-2 text-[13px] font-bold">⚠ {pending} ta sotuv skladdan hali kamaytirilmagan. Kamaytirilsinmi?</p>
          <div className="flex gap-2">
            <button onClick={() => actions.onDeduct(k)} disabled={actions.busyId === k.id} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "var(--side)" }}>
              {actions.busyId === k.id ? "…" : `Ha, kamaytirish (${pending} ta)`}
            </button>
          </div>
        </div>
      )}

      {sold > 0 && pending === 0 && k.stock_deducted_at && (
        <div className="rounded-[11px] bg-mint px-3 py-2 text-xs font-bold text-mintink">✓ Sklad kamaytirilgan · {fmtTime(k.stock_deducted_at)}</div>
      )}

      {/* «Sotish» — modal: soni, ixtiyoriy chegirma narxi va sababi */}
      {sellable && (
        <div className="mt-auto flex gap-2">
          <button onClick={() => actions.onSell(k)} className="flex-1 rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint" style={{ borderColor: "var(--line)" }}>Sotish</button>
          {actions.mainUser && actions.control && <button onClick={() => actions.onTransfer(k, [k])} className="flex-1 rounded-xl border px-2 py-2 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>Filialga chiqarish</button>}
        </div>
      )}
    </div>
  </article>
  );
}
