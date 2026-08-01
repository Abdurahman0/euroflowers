"use client";
import { Info, Pencil, Plus, Send, Trash2, User, X } from "lucide-react";
import { createPortal } from "react-dom";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtTime, initials } from "@/lib/format";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import KatalogModal from "@/components/KatalogModal";
import KatalogViewModal from "@/components/KatalogViewModal";
import KatalogSellModal from "@/components/KatalogSellModal";
import CatalogTransferDrawer from "@/components/CatalogTransferDrawer";
import { usePerm } from "@/lib/store";
import { isBranchUser } from "@/lib/branch";
import type { CatalogItem, FloristProfile } from "@/lib/types";

/** Florist ismi (user_detail'dan) — bo'lmasa bo'sh */
const floristName = (fp?: FloristProfile | null): string => {
  const u = fp?.user_detail;
  return fp ? [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fp.id}` : "";
};

const compositionText = (k: CatalogItem) =>
  k.composition
    .map((c) => `${c.batch_detail?.variant_detail?.flower_detail?.name_uz ?? ""} ${c.batch_detail?.variant_detail?.name_uz ?? ""} ${c.quantity_stems} dona`.trim())
    .join(" · ") || "Tarkib kiritilmagan";

/** LIMBO: florist katalogi, lekin gul HALI taqsimlanmagan (chiqim yopilmagan) → composition bo'sh.
    Bunday item'ning tannarxi 0, foydasi 100% ko'rinadi — «Gul taqsimlanmagan» chipi bilan belgilanadi. */
const isUndistributed = (k: CatalogItem) => !!k.florist && !(k.composition?.length);

const STATUS_OPTS = [
  { value: "", label: "Barcha holatlar" },
  { value: "available", label: "Sotuvda" },
  { value: "reserved", label: "Band" },
  { value: "sold", label: "Sotildi" },
  { value: "draft", label: "Qoralama" },
  { value: "archived", label: "Arxiv" },
];

const ARR_OPTS = [
  { value: "", label: "Barcha turlar" },
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "box", label: "Quti" },
];

export default function KatalogPage() {
  const { showToast, loadNotifs } = useStore();
  const { canControl } = usePerm();
  const control = canControl("catalog");
  // filial foydalanuvchisi: katalog YARATOLMAYDI (+Katalog yashiriladi) va yuborolmaydi;
  // asosiy filial admini (mainUser) — filialga yuborishi mumkin.
  const branchUser = isBranchUser(useStore((s) => s.user?.profile.branch));
  const mainUser = !branchUser;
  const [transferItem, setTransferItem] = useState<CatalogItem | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // ko'rish / tahrirlash / o'chirish
  const [undistribOnly, setUndistribOnly] = useState(false); // «Gul taqsimlanmagan» klient filtri
  const [viewItem, setViewItem] = useState<CatalogItem | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // server filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [arrType, setArrType] = useState("");
  // florist va katalog turi — SERVER filtrlari (?florist= va ?catalog_kind= mavjud)
  const [floristFilter, setFloristFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  // MIJOZ filtri — URL ?customer=<id> orqali (mijoz sahifasidan / chipdan); tozalanadigan banner
  const [customerFilter, setCustomerFilter] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setItems(await api.catalog({
        ordering: "-created_at",
        search: q || undefined,
        status: status || undefined,
        arrangement_type: arrType || undefined,
        florist: floristFilter || undefined,
        catalog_kind: kindFilter || undefined,
        customer: customerFilter?.id || undefined,
      }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, q, status, arrType, floristFilter, kindFilter, customerFilter]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  // florist ro'yxati — filtr uchun (bir marta)
  useEffect(() => { api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {}); }, []);

  // URL ?customer=<id> — mijoz nomini olib banner ko'rsatamiz (server filtri qo'llanadi)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cid = Number(new URLSearchParams(window.location.search).get("customer"));
    if (!cid) return;
    api.customer(cid)
      .then((c) => setCustomerFilter({ id: cid, label: `${c.name || "Mijoz"}${c.masked_phone ? ` · ${c.masked_phone}` : ""}` }))
      .catch(() => setCustomerFilter({ id: cid, label: `#${cid}` }));
  }, []);

  const undistribCount = items.filter(isUndistributed).length;
  const shownItems = undistribOnly ? items.filter(isUndistributed) : items;

  // ?item=<id> — bildirishnomadan («Sizga yangi katalog ishi biriktirildi»)
  // to'g'ridan-to'g'ri katalog kartasini ochamiz (ro'yxatda bo'lmasa ham).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = Number(new URLSearchParams(window.location.search).get("item"));
    if (!id) return;
    api.catalogItem(id)
      .then((it) => { if (it && typeof it.id === "number") setViewItem(it); else showToast("Katalog yozuvi topilmadi"); })
      .catch(() => showToast("Katalog yozuvi topilmadi"));
  }, [showToast]);

  const patchItem = (upd: CatalogItem) => {
    setItems((xs) => xs.map((x) => (x.id === upd.id ? upd : x)));
    setViewItem((v) => (v?.id === upd.id ? upd : v));
  };

  // «Sotish» — modal orqali: soni + ixtiyoriy chegirma narxi va sababi
  const [sellItem, setSellItem] = useState<CatalogItem | null>(null);

  /** quantity bermasak backend sotilgan-u hali yechilmagan HAMMA sonni yechadi */
  const deduct = async (k: CatalogItem) => {
    setBusyId(k.id);
    try {
      patchItem(await api.deductCatalogStock(k.id));
      showToast(`✓ Sklad kamaytirildi: ${k.name_uz}`);
      notifyReportDataChanged(); // sklad kamaydi → hisobot raqamlari
      loadNotifs();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Kamaytirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  // katalog yozuvini butunlay o'chirish (DELETE /api/catalog/{id}/)
  const doDelete = async () => {
    if (!confirmDel) return;
    const victim = confirmDel;
    setDeleting(true);
    try {
      await api.deleteCatalogItem(victim.id);
      setItems((xs) => xs.filter((x) => x.id !== victim.id));
      setViewItem((v) => (v?.id === victim.id ? null : v));
      setEditItem((v) => (v?.id === victim.id ? null : v));
      setConfirmDel(null);
      showToast("✓ Katalog yozuvi o'chirildi");
      notifyReportDataChanged(); // katalog o'chdi (gullar floristga/skladga qaytdi) → hisobot
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Katalog qidirish" placeholder="Nomi, mijoz ismi yoki telefoni…" />
          <FilterSelect value={status} options={STATUS_OPTS} onChange={setStatus} label="Holat" />
          <FilterSelect value={arrType} options={ARR_OPTS} onChange={setArrType} label="Turi" />
          <FilterSelect value={kindFilter} onChange={setKindFilter} label="Katalog turi" options={[{ value: "", label: "Barcha turlar" }, { value: "standard", label: "Standart" }, { value: "custom", label: "Maxsus" }]} />
          {florists.length > 0 && (
            <FilterSelect
              value={floristFilter}
              onChange={setFloristFilter}
              label="Florist"
              options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]}
            />
          )}
          {/* «Gul taqsimlanmagan» — chiqim yopilmagan florist kataloglari (tannarx/foyda haqiqiy emas) */}
          {undistribCount > 0 && (
            <button
              onClick={() => setUndistribOnly((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: undistribOnly ? "var(--warning-ink, #8a6d1f)" : "var(--border)", color: undistribOnly ? "var(--warning-ink, #8a6d1f)" : "var(--text-2)" }}
              title="Gul hali taqsimlanmagan florist kataloglari"
            >
              <Info size={13} strokeWidth={2.2} /> Gul taqsimlanmagan ({undistribCount}){undistribOnly ? " ✕" : ""}
            </button>
          )}
        </div>
        {/* filialda katalog YARATIB BO'LMAYDI (backend 400) — tugmani ko'rsatmaymiz */}
        {mainUser && (
          <button onClick={() => setFormOpen(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
            <Plus size={18} strokeWidth={1.75} /> Katalogga qo&apos;shish
          </button>
        )}
      </div>

      {customerFilter && (
        <div className="mb-3 flex items-center gap-2 rounded-[12px] border px-3.5 py-2 text-[13px]" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <User size={14} strokeWidth={2} style={{ color: "var(--primary)" }} />
          <span className="font-semibold">Mijoz bo&apos;yicha filtr:</span>
          <span className="truncate" style={{ color: "var(--text-2)" }}>{customerFilter.label}</span>
          <button type="button" onClick={() => setCustomerFilter(null)} className="ml-auto shrink-0 rounded-full p-1 hover:bg-[color:var(--hover)]" title="Filtrni olib tashlash"><X size={15} /></button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
        {shownItems.map((k) => {
          // yangi kontrakt: soni bilan ishlash; eski yozuvlar uchun statusga tayanamiz
          const total = k.quantity_total ?? 1;
          const sold = k.quantity_sold ?? (k.status === "sold" ? total : 0);
          const dedu = k.quantity_stock_deducted ?? (k.stock_deducted_at ? sold : 0);
          const pending = Math.max(sold - dedu, 0);
          const left = Math.max(total - sold, 0);
          const sellable = left > 0 && (k.status === "available" || k.status === "reserved" || k.status === "draft");
          return (
            <article key={k.id} className="glass card-hover group flex flex-col overflow-hidden !rounded-[20px]">
              <div
                className="relative h-[190px] cursor-pointer bg-bg2"
                role="button"
                tabIndex={0}
                onClick={() => setViewItem(k)}
                onKeyDown={(e) => e.key === "Enter" && setViewItem(k)}
                title="Batafsil ko'rish"
              >
                {k.image_url && <img src={k.image_url} alt={k.name_uz} className="h-full w-full object-cover" />}
                {/* tahrirlash / o'chirish / filialga yuborish — rasm ustida, hover'da */}
                {control && (
                  <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-[11px] p-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100" style={{ background: "color-mix(in srgb, var(--surface-solid) 82%, transparent)" }}>
                    {/* Filialga yuborish — FAQAT asosiy filial admini, sotilmagan qismi bor bo'lsa */}
                    {mainUser && ((k.quantity_total ?? 1) - (k.quantity_sold ?? 0)) > 0 && (
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setTransferItem(k); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setTransferItem(k); } }} title="Filialga yuborish" aria-label={`${k.name_uz || k.name_ru} — filialga yuborish`} className="icon-btn !h-7 !w-7">
                        <Send size={13} strokeWidth={1.9} />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditItem(k); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditItem(k); } }}
                      title="Tahrirlash"
                      aria-label={`${k.name_uz || k.name_ru} — tahrirlash`}
                      className="icon-btn !h-7 !w-7"
                    >
                      <Pencil size={13.5} strokeWidth={1.75} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel(k); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDel(k); } }}
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
                  {compositionText(k)}
                  {k.height_cm ? ` · bo'yi ${k.height_cm} sm` : ""} · {ARRANGEMENT_LABEL[k.arrangement_type] ?? k.arrangement_type}
                </p>
                {(k.description_uz || k.description_ru) && (
                  <p className="text-[13px] italic" style={{ color: "var(--mut)" }}>{k.description_uz || k.description_ru}</p>
                )}
                {/* florist chipi (kim tayyorladi) */}
                {k.florist_detail ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                    <span className="avatar-lead flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold">{initials(floristName(k.florist_detail))}</span>
                    <span className="truncate" title={floristName(k.florist_detail)}>{floristName(k.florist_detail)}</span>
                  </span>
                ) : (
                  <span className="text-[12px] italic" style={{ color: "var(--muted)" }}>Florist ko&apos;rsatilmagan</span>
                )}
                {/* LIMBO: florist katalogi, gul hali taqsimlanmagan → tannarx/foyda HAQIQIY EMAS */}
                {isUndistributed(k) && (
                  <span className="flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }} title="Gul chiqim yopilganda taqsimlanadi — tannarx va foyda shundan keyin haqiqiy bo'ladi">
                    <Info size={11} strokeWidth={2.4} /> Gul taqsimlanmagan
                  </span>
                )}
                {/* mijoz chipi (kim sotib oldi) — bosilsa shu mijoz bo'yicha filtr */}
                {k.customer_detail && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCustomerFilter({ id: k.customer_detail!.id, label: `${k.customer_detail!.name || "Mijoz"}${k.customer_detail!.masked_phone ? ` · ${k.customer_detail!.masked_phone}` : ""}` }); }}
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
                    {pending > 0 && <span className="rounded-full bg-peach px-2.5 py-0.5 text-peachink">Kutilmoqda: {pending}</span>}
                    {/* chegirmada sotilgan — sotuv tarixida sabab bilan saqlanadi */}
                    {+(k.discount_amount ?? 0) > 0 && (
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
                      <button onClick={() => deduct(k)} disabled={busyId === k.id} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "var(--side)" }}>
                        {busyId === k.id ? "…" : `Ha, kamaytirish (${pending} ta)`}
                      </button>
                    </div>
                  </div>
                )}

                {sold > 0 && pending === 0 && k.stock_deducted_at && (
                  <div className="rounded-[11px] bg-mint px-3 py-2 text-xs font-bold text-mintink">✓ Sklad kamaytirilgan · {fmtTime(k.stock_deducted_at)}</div>
                )}

                {/* «Sotish» — modal: soni, ixtiyoriy chegirma narxi va sababi */}
                {sellable && (
                  <button
                    onClick={() => setSellItem(k)}
                    className="mt-auto rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint"
                    style={{ borderColor: "var(--line)" }}
                  >
                    Sotish
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {shownItems.length === 0 && <div className="col-span-full"><EmptyState title={floristFilter ? "Bu floristda katalog yo'q" : "Katalog hozircha bo'sh"} sub={floristFilter ? "Boshqa floristni tanlang." : "Birinchi tayyor guldastani qo'shing — story havolasi bilan."} /></div>}
      </div>

      {sellItem && (
        <KatalogSellModal
          item={sellItem}
          onClose={() => setSellItem(null)}
          onSold={(upd) => { patchItem(upd); setSellItem(null); notifyReportDataChanged(); loadNotifs(); load(); }}
        />
      )}

      {transferItem && (
        <CatalogTransferDrawer item={transferItem} onClose={() => setTransferItem(null)} onDone={() => { notifyReportDataChanged(); load(); }} />
      )}

      {formOpen && <KatalogModal onClose={() => setFormOpen(false)} onSaved={load} />}
      {editItem && (
        <KatalogModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load(); }}
        />
      )}
      {viewItem && (
        <KatalogViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={control ? () => { setEditItem(viewItem); setViewItem(null); } : undefined}
          onDelete={control ? () => setConfirmDel(viewItem) : undefined}
          onTransfer={mainUser && control && ((viewItem.quantity_total ?? 1) - (viewItem.quantity_sold ?? 0)) > 0 ? () => { setTransferItem(viewItem); setViewItem(null); } : undefined}
        />
      )}

      {/* o'chirish tasdig'i — body portali (drawer overlay'i ostida qolmasin) */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDel(null)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(400px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Katalogdan o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              «{confirmDel.name_uz || confirmDel.name_ru}» butunlay o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            {(confirmDel.quantity_sold ?? 0) > 0 && (
              <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">
                ⚠ Bu yozuvdan {confirmDel.quantity_sold} ta sotilgan — sotuv tarixi ham yo&apos;qolishi mumkin.
              </p>
            )}
            {/* florist katalogi: gul TAQSIMLANGAN bo'lsa (composition bor) → florist qo'liga qaytadi;
                YOPILMAGAN bo'lsa (composition yo'q) → floristga HECH NARSA qaytmaydi (halol matn). */}
            {confirmDel.florist ? (
              confirmDel.composition?.length ? (
                <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  ↩ Gullar <b>skladga emas, {confirmDel.florist_detail ? floristName(confirmDel.florist_detail) : "floristning"} qo&apos;liga</b> qaytadi.
                </p>
              ) : (
                <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  Bu katalogda gul hali <b>taqsimlanmagan</b> (chiqim yopilmagan) — floristga hech narsa qaytmaydi, faqat yozuv o&apos;chadi.
                </p>
              )
            ) : null}
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDelete} disabled={deleting} className={`btn-danger flex-1 ${deleting ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
