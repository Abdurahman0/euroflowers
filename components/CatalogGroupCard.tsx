"use client";
import { useState } from "react";
import { ChevronDown, Info, Pencil, Recycle, Send, Sparkles, Trash2, User } from "lucide-react";
import { fmt } from "@/lib/format";
import { initials } from "@/lib/format";
import { VOLUME_LABEL } from "@/lib/inventory";
import { catalogRemaining } from "@/lib/rework";
import { deductionState } from "@/lib/catalogStock";
import { floristLabel as floristName } from "@/lib/floristLabel";
import { uniformPrice, pickSellItem, type CatalogGroup } from "@/lib/catalogGroups";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import type { CatalogItem } from "@/lib/types";

/**
 * HAJM GURUHI KARTASI — katalog «umumiy» ko'rinishda: bitta karta = bitta hajm.
 *
 * ⚠️ NEGA: bir xil tovar bir necha marta kiritilgan («kotta», «KOTTA 100 TALI ATIR»…
 *    — hammasi 800 000 so'm). Operatorga «katta 15 ta bor» degani kifoya, qaysi
 *    yozuvdan yechilishi muhim emas (pickSellItem qoldig'i eng ko'pini oladi).
 *
 * ⚠️ POZITSIYALAR YO'QOLMAYDI: karta ochiladi va har bir yozuv o'z amallari bilan
 *    (sotish / tahrir / o'chirish / restavratsiya / filialga yuborish) turadi.
 *
 * ⚠️ NARX HAR XIL bo'lgan guruhda «Sotish» TO'G'RIDAN-TO'G'RI sotmaydi — ro'yxatni
 *    ochadi: qaysi narx ketayotganini operator ko'rib tanlasin (jonli ma'lumotda
 *    o'rta hajmda 400 000 buket va 1 000 000 savat birga turadi).
 */

export type GroupActions = {
  onSell: (k: CatalogItem) => void;
  onView: (k: CatalogItem) => void;
  onEdit: (k: CatalogItem) => void;
  onDelete: (k: CatalogItem) => void;
  onRework: (k: CatalogItem) => void;
  onTransfer: (k: CatalogItem) => void;
  onDeduct: (k: CatalogItem) => void;
  onCustomer: (id: number, label: string) => void;
  busyId: number | null;
  /** tahrirlash huquqi (canControl) */
  control: boolean;
  /** asosiy filial foydalanuvchisi — «filialga yuborish» faqat unga */
  mainUser: boolean;
  /** tannarx/florist ma'lumoti ko'rsatiladimi (filialga yashiriladi) */
  costVisible: (k: CatalogItem) => boolean;
  /** «gul taqsimlanmagan» holati */
  undistributed: (k: CatalogItem) => boolean;
  composition: (k: CatalogItem) => string;
};

const sellable = (k: CatalogItem) =>
  catalogRemaining(k) > 0 && (k.status === "available" || k.status === "reserved" || k.status === "draft");

const VOLUME_HUE: Record<string, string> = { small: "#4a7ab5", medium: "#b3873a", large: "var(--primary)" };

export default function CatalogGroupCard({
  group,
  actions,
  open,
  onToggle,
}: {
  group: CatalogGroup;
  actions: GroupActions;
  /** ⚠️ Ochiq/yopiq holat SAHIFADA turadi: ochilgan karta butun qatorni egallashi kerak
      (tor ustunda 11 ta pozitsiya siqilib ketardi). */
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const [priceHint, setPriceHint] = useState(false);
  const g = group;
  const hue = VOLUME_HUE[g.volume] ?? "var(--muted)";
  const title = g.volume ? VOLUME_LABEL[g.volume] : "Hajmi belgilanmagan";
  const price = uniformPrice(g);
  const sellables = g.items.filter(sellable);
  const target = pickSellItem(sellables);
  const pending = g.items.reduce((s, k) => s + deductionState(k).pending, 0);
  const types = [
    g.typeCounts.bouquet ? `${g.typeCounts.bouquet} buket` : "",
    g.typeCounts.basket ? `${g.typeCounts.basket} savat` : "",
    g.typeCounts.box ? `${g.typeCounts.box} quti` : "",
  ].filter(Boolean).join(" · ");

  const sell = () => {
    if (!target) return;
    // narxlar har xil — jimgina tanlamaymiz, ro'yxatni ochamiz
    if (price == null) { onToggle(true); setPriceHint(true); return; }
    actions.onSell(target);
  };

  return (
    <article className="glass flex flex-col overflow-hidden !rounded-[20px]" style={{ borderLeft: `3px solid ${hue}` }}>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[17px] font-extrabold tracking-tight" style={{ color: hue }}>{title}</h3>
          <span className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--acc)" }}>
            {price != null ? fmt(price) : g.prices.length ? `${fmt(g.prices[0])} – ${fmt(g.prices[g.prices.length - 1])}` : "—"}
          </span>
        </div>

        {/* ASOSIY SON — hozir sotishga nechta bor */}
        <div className="text-[24px] font-extrabold leading-none tabular-nums" style={{ color: "var(--text)" }}>
          {g.remaining.toLocaleString("ru")}
          <span className="ml-1 text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>dona qoldi</span>
        </div>

        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
          <span>Jami {g.total.toLocaleString("ru")}</span>
          <span>Sotildi {g.sold.toLocaleString("ru")}</span>
          {types && <span>{types}</span>}
        </div>

        {/* ⚠️ Skladdan kamaytirilmagan sotuvlar — guruhda ko'rinib tursin (yechish pozitsiya ichida) */}
        {pending > 0 && (
          <button
            type="button"
            onClick={() => onToggle(true)}
            className="flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
            style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}
            title="Pozitsiyani ochib skladdan kamaytiring"
          >
            <Info size={11} strokeWidth={2.4} /> {pending} ta sotuv skladdan kamaytirilmagan
          </button>
        )}

        <div className="mt-1 flex items-center gap-2">
          {target && (
            <button
              onClick={sell}
              className="flex-1 rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint"
              style={{ borderColor: "var(--line)" }}
            >
              Sotish
            </button>
          )}
          <button
            onClick={() => { onToggle(!open); setPriceHint(false); }}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)]"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            {g.items.length} pozitsiya
            <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {priceHint && (
          <p className="text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
            Bu hajmda narxlar har xil — qaysi biri sotilishini tanlang.
          </p>
        )}
      </div>

      {open && (
        <div className="grid border-t" style={{ borderColor: "var(--border)", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))" }}>
          {g.items.map((k) => {
            const left = catalogRemaining(k);
            const ded = deductionState(k);
            const dimmed = k.status === "sold" || k.status === "archived";
            return (
              <div key={k.id} className="flex flex-col gap-1.5 border-b border-r px-4 py-3" style={{ borderColor: "var(--border)", opacity: dimmed ? 0.6 : 1 }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => actions.onView(k)}
                    onKeyDown={(e) => e.key === "Enter" && actions.onView(k)}
                    title="Batafsil ko'rish"
                    className="min-w-0 flex-1 cursor-pointer truncate text-[13.5px] font-bold underline-offset-2 hover:underline"
                  >
                    {k.name_uz || k.name_ru}
                  </span>
                  <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "var(--acc)" }}>{fmt(k.price)}</span>
                </div>

                <p className="text-[12px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  {actions.composition(k)}
                  {k.height_cm ? ` · bo'yi ${k.height_cm} sm` : ""} · {ARRANGEMENT_LABEL[k.arrangement_type] ?? k.arrangement_type}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
                    {(CATALOG_STATUS_LABEL[k.status] ?? k.status).toUpperCase()}
                  </span>
                  <span className="rounded-full bg-mint px-2 py-0.5 text-mintink">Qoldiq: {left}</span>
                  <span className="rounded-full bg-tint px-2 py-0.5">Jami: {k.quantity_total ?? 1}</span>
                  <span className="rounded-full bg-tint px-2 py-0.5">Sotildi: {ded.sold}</span>
                  {(k.quantity_wasted ?? 0) > 0 && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>Chiqit: {k.quantity_wasted}</span>
                  )}
                  {(k.quantity_reworked ?? 0) > 0 && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "color-mix(in srgb, var(--acc) 15%, transparent)", color: "var(--acc)" }}>Restavratsiyada: {k.quantity_reworked}</span>
                  )}
                  {actions.costVisible(k) && +(k.discount_amount ?? 0) > 0 && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }} title={k.discount_reason || "Chegirma bilan sotilgan"}>
                      Chegirma: {fmt(k.discount_amount)}
                    </span>
                  )}
                  {actions.undistributed(k) && (
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }} title="Material va florist haqi allaqachon tannarxda; gul tannarxi chiqim yopilganda qo'shiladi">
                      <Info size={10} strokeWidth={2.4} /> Gul taqsimlanmagan
                    </span>
                  )}
                </div>

                {/* florist / oformleniya / mijoz */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {actions.costVisible(k) && (k.florist_detail ? (
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                      <span className="avatar-lead flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold">{initials(floristName(k.florist_detail, k.florist_name))}</span>
                      <span className="truncate">{floristName(k.florist_detail, k.florist_name)}</span>
                    </span>
                  ) : (
                    <span className="text-[11.5px] italic" style={{ color: "var(--muted)" }}>Florist ko&apos;rsatilmagan</span>
                  ))}
                  {actions.costVisible(k) && k.decoration_florist_detail && (
                    <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--acc)" }} title={`Oformleniya: ${floristName(k.decoration_florist_detail, k.decoration_florist_name)}`}>
                      <Sparkles size={11} strokeWidth={2} className="shrink-0" />
                      <span className="truncate">{floristName(k.decoration_florist_detail, k.decoration_florist_name)}</span>
                    </span>
                  )}
                  {k.customer_detail && (
                    <button
                      type="button"
                      onClick={() => actions.onCustomer(k.customer_detail!.id, `${k.customer_detail!.name || "Mijoz"}${k.customer_detail!.masked_phone ? ` · ${k.customer_detail!.masked_phone}` : ""}`)}
                      className="flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors hover:border-[color:var(--primary)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                      title="Shu mijoz bo'yicha filtrlash"
                    >
                      <User size={10} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
                      <span className="truncate">{k.customer_detail.name || "Mijoz"}</span>
                    </button>
                  )}
                  {k.note && <span className="truncate text-[11.5px] italic" style={{ color: "var(--mut)" }} title={k.note}>✎ {k.note}</span>}
                </div>

                {/* ⚠️ SKLAD KAMAYTIRILMAGAN — pozitsiya ichida, avvalgidek */}
                {ded.pending > 0 && (
                  <div className="rounded-[11px] border-[1.5px] bg-tint p-2.5">
                    <p className="mb-1.5 text-[12px] font-bold">⚠ {ded.pending} ta sotuv skladdan hali kamaytirilmagan.</p>
                    <button
                      onClick={() => actions.onDeduct(k)}
                      disabled={actions.busyId === k.id}
                      className="rounded-[9px] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                      style={{ background: "var(--side)" }}
                    >
                      {actions.busyId === k.id ? "…" : `Ha, kamaytirish (${ded.pending} ta)`}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  {sellable(k) && (
                    <button onClick={() => actions.onSell(k)} className="rounded-[10px] border-[1.5px] px-3 py-1 text-[12px] font-bold hover:bg-mint" style={{ borderColor: "var(--line)" }}>
                      Sotish
                    </button>
                  )}
                  {actions.control && (
                    <span className="ml-auto flex items-center gap-1">
                      {left > 0 && (
                        <button onClick={() => actions.onRework(k)} title="Restavratsiya — buzib yangi mahsulot yasash" aria-label={`${k.name_uz || k.name_ru} — restavratsiya`} className="icon-btn !h-7 !w-7">
                          <Recycle size={13} strokeWidth={1.9} />
                        </button>
                      )}
                      {actions.mainUser && left > 0 && (
                        <button onClick={() => actions.onTransfer(k)} title="Filialga yuborish" aria-label={`${k.name_uz || k.name_ru} — filialga yuborish`} className="icon-btn !h-7 !w-7">
                          <Send size={13} strokeWidth={1.9} />
                        </button>
                      )}
                      <button onClick={() => actions.onEdit(k)} title="Tahrirlash" aria-label={`${k.name_uz || k.name_ru} — tahrirlash`} className="icon-btn !h-7 !w-7">
                        <Pencil size={13.5} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => actions.onDelete(k)} title="O'chirish" aria-label={`${k.name_uz || k.name_ru} — o'chirish`} className="icon-btn icon-btn-danger !h-7 !w-7">
                        <Trash2 size={13.5} strokeWidth={1.75} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
