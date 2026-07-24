"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtTime } from "@/lib/format";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import KatalogModal from "@/components/KatalogModal";
import KatalogViewModal from "@/components/KatalogViewModal";
import { usePerm } from "@/lib/store";
import type { CatalogItem } from "@/lib/types";

const compositionText = (k: CatalogItem) =>
  k.composition
    .map((c) => `${c.batch_detail?.variant_detail?.flower_detail?.name_uz ?? ""} ${c.batch_detail?.variant_detail?.name_uz ?? ""} ${c.quantity_stems} dona`.trim())
    .join(" · ") || "Tarkib kiritilmagan";

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
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // ko'rish / tahrirlash / o'chirish
  const [viewItem, setViewItem] = useState<CatalogItem | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // server filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [arrType, setArrType] = useState("");

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
      }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, q, status, arrType]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const patchItem = (upd: CatalogItem) => setItems((xs) => xs.map((x) => (x.id === upd.id ? upd : x)));

  // «Sotish» bosilganda nechta sotilishi SO'RALADI (kartada doimiy input yo'q)
  const [sellQty, setSellQty] = useState<Record<number, string>>({});
  const [askSell, setAskSell] = useState<Record<number, boolean>>({});

  const markSold = async (k: CatalogItem, qty: number) => {
    setBusyId(k.id);
    try {
      patchItem(await api.sellCatalogItem(k.id, qty > 1 ? qty : undefined));
      showToast(`✓ «${k.name_uz}»: ${qty} ta sotildi deb belgilandi`);
      setSellQty((m) => ({ ...m, [k.id]: "1" }));
      setAskSell((m) => ({ ...m, [k.id]: false }));
      loadNotifs();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Belgilab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  /** quantity bermasak backend sotilgan-u hali yechilmagan HAMMA sonni yechadi */
  const deduct = async (k: CatalogItem) => {
    setBusyId(k.id);
    try {
      patchItem(await api.deductCatalogStock(k.id));
      showToast(`✓ Sklad kamaytirildi: ${k.name_uz}`);
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
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Tayyor gullar katalogi — har biri Instagram story bilan birga tizimga kiritiladi
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Katalog qidirish" />
          <FilterSelect value={status} options={STATUS_OPTS} onChange={setStatus} label="Holat" />
          <FilterSelect value={arrType} options={ARR_OPTS} onChange={setArrType} label="Turi" />
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
          <Plus size={18} strokeWidth={1.75} /> Katalogga qo&apos;shish
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
        {items.map((k) => {
          // yangi kontrakt: soni bilan ishlash; eski yozuvlar uchun statusga tayanamiz
          const total = k.quantity_total ?? 1;
          const sold = k.quantity_sold ?? (k.status === "sold" ? total : 0);
          const dedu = k.quantity_stock_deducted ?? (k.stock_deducted_at ? sold : 0);
          const pending = Math.max(sold - dedu, 0);
          const left = Math.max(total - sold, 0);
          const sellable = left > 0 && (k.status === "available" || k.status === "reserved" || k.status === "draft");
          const qty = Math.min(Math.max(+(sellQty[k.id] ?? "1") || 1, 1), left || 1);
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
                {/* tahrirlash / o'chirish — rasm ustida, hover'da */}
                {control && (
                  <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-[11px] p-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100" style={{ background: "color-mix(in srgb, var(--surface-solid) 82%, transparent)" }}>
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

                {/* faqat «Sotish» — nechta sotilishi bosilganda SO'RALADI */}
                {sellable && !askSell[k.id] && (
                  <button
                    onClick={() => (left <= 1 ? markSold(k, 1) : setAskSell((m) => ({ ...m, [k.id]: true })))}
                    disabled={busyId === k.id}
                    className="mt-auto rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint disabled:opacity-60"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {busyId === k.id ? "…" : "Sotish"}
                  </button>
                )}
                {sellable && askSell[k.id] && (
                  <div className="mt-auto rounded-[13px] border-[1.5px] bg-tint p-2.5" style={{ borderColor: "var(--line)" }}>
                    <p className="mb-1.5 text-[12.5px] font-bold">Nechta sotiladi?</p>
                    <div className="flex items-center gap-2">
                      <input
                        className="inp !w-[56px] shrink-0 text-right"
                        inputMode="numeric"
                        autoFocus
                        value={sellQty[k.id] ?? "1"}
                        onChange={(e) => setSellQty((m) => ({ ...m, [k.id]: e.target.value.replace(/\D/g, "") }))}
                        onKeyDown={(e) => e.key === "Enter" && markSold(k, qty)}
                        aria-label="Nechta sotiladi"
                      />
                      <button onClick={() => markSold(k, qty)} disabled={busyId === k.id} className="min-w-0 flex-1 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "var(--side)" }}>
                        {busyId === k.id ? "…" : "Sotish"}
                      </button>
                      <button onClick={() => setAskSell((m) => ({ ...m, [k.id]: false }))} className="rounded-[10px] border px-3 py-2 text-[13px] font-bold" style={{ borderColor: "var(--line)" }}>
                        Bekor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {items.length === 0 && <div className="col-span-full"><EmptyState title="Katalog hozircha bo&apos;sh" sub="Birinchi tayyor guldastani qo&apos;shing — story havolasi bilan." /></div>}
      </div>

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
